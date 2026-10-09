-- Moderation tools (2026-10-09): takedowns, strikes, avatar lock, buyer reports.
--
--   · takedown_listing / restore_listing — moderator RPCs (same shape as
--     approve_listing: guarded_write flag + assert_moderator). A takedown
--     is status 'suspended' (allowed by listings_status_check since the
--     baseline, never used until now) with the reason in moderation_notes.
--   · seller_strikes — one row per admin action against a seller
--     (takedown, image removed, avatar reset, report upheld). Service-role
--     only; the app escalates at 2 (restricted) and 3 (banned).
--   · profiles.avatar_locked_at — set by an admin avatar reset; while set a
--     JWT caller cannot change avatar_url (small dedicated trigger, so the
--     big guard_profiles_protected_columns body stays untouched).
--   · listing_reports + listing_report_file() — a buyer reports a live
--     listing (one report per buyer per listing); the third open report
--     auto-hides the listing (suspended) until a moderator looks.

-- ── 1. Takedown / restore ───────────────────────────────────────────────
-- Attribution is auth.uid() (NULL for the service role), never a parameter.
CREATE OR REPLACE FUNCTION public.takedown_listing(listing_id uuid, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();
  IF reason IS NULL OR length(btrim(reason)) < 3 THEN
    RAISE EXCEPTION 'takedown_listing: a reason is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.listings
  SET status = 'suspended',
      moderation_notes = 'Taken down: ' || btrim(reason),
      changes_requested_by = auth.uid(),
      changes_requested_at = now()
  WHERE id = listing_id
    AND status IN ('active', 'paused', 'pending_approval', 'changes_requested');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'takedown_listing: listing is not live (nothing to take down)' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.takedown_listing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.takedown_listing(uuid, text) TO authenticated, service_role;

-- Back to active only while the seller is in good standing; a restricted or
-- banned seller's listing comes back paused (their other listings are paused).
CREATE OR REPLACE FUNCTION public.restore_listing(listing_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
  n int;
  v_standing text;
  v_status text;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();
  SELECT p.seller_status INTO v_standing
  FROM public.listings l JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.id = listing_id;
  v_status := CASE WHEN v_standing IN ('restricted', 'banned') THEN 'paused' ELSE 'active' END;
  UPDATE public.listings
  SET status = v_status,
      moderation_notes = NULL,
      approved_by = COALESCE(approved_by, auth.uid()),
      approved_at = COALESCE(approved_at, now())
  WHERE id = listing_id AND status = 'suspended';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'restore_listing: listing is not taken down' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_listing(uuid) TO authenticated, service_role;

-- A taken-down listing leaves 'suspended' ONLY through restore_listing (which
-- sets the app.guarded_write flag). The app's own service-role writes do not
-- set the flag, so a seller edit cannot flip it back to active/paused.
CREATE OR REPLACE FUNCTION public.guard_listing_suspended() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'suspended' AND NEW.status IS DISTINCT FROM 'suspended'
     AND COALESCE(current_setting('app.guarded_write', true), '') <> 'on' THEN
    RAISE EXCEPTION 'listings: a taken-down listing is restored only by a moderator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_listings_suspended_guard ON public.listings;
CREATE TRIGGER trg_listings_suspended_guard BEFORE UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_suspended();

-- ── 2. Strikes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_strikes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind        text NOT NULL CHECK (kind IN ('listing_takedown', 'image_removed', 'avatar_reset', 'report_upheld', 'other')),
  reason      text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  listing_id  uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  revoked_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS seller_strikes_seller_idx ON public.seller_strikes (seller_id, created_at DESC);
ALTER TABLE public.seller_strikes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_strikes FROM anon, authenticated;
-- A seller may read their own strikes (the restrictions page shows them) —
-- never who issued or revoked them (column-level grant).
CREATE POLICY seller_strikes_owner_read ON public.seller_strikes
  FOR SELECT TO authenticated USING (seller_id = auth.uid());
GRANT SELECT (id, seller_id, kind, reason, listing_id, created_at, revoked_at) ON public.seller_strikes TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_strike_count(p_seller uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
  SELECT count(*)::int FROM public.seller_strikes WHERE seller_id = p_seller AND revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.seller_strike_count(uuid) FROM PUBLIC, anon, authenticated;

-- One transaction: strike row → active count → escalation (2 = restricted,
-- 3 = banned: status, pause live listings, seller_restrictions row). Service
-- role only; the app decides WHO may escalate (moderators cannot) and passes
-- p_escalate accordingly. Interior steps carry money_fault_hook points so the
-- atomicity proof can be written like the money seams.
CREATE OR REPLACE FUNCTION public.seller_strike_issue(
  p_seller uuid, p_issued_by uuid, p_kind text, p_reason text, p_listing uuid, p_escalate boolean
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
  v_count int;
  v_standing text;
  v_new text;
  v_why text;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  INSERT INTO public.seller_strikes (seller_id, issued_by, kind, reason, listing_id)
  VALUES (p_seller, p_issued_by, p_kind, btrim(p_reason), p_listing);
  PERFORM public.money_fault_hook('seller_strike_issue:after_insert');
  SELECT count(*)::int INTO v_count FROM public.seller_strikes WHERE seller_id = p_seller AND revoked_at IS NULL;
  SELECT seller_status INTO v_standing FROM public.profiles WHERE id = p_seller;
  IF NOT p_escalate OR v_count < 2 OR v_standing = 'banned' THEN
    RETURN jsonb_build_object('count', v_count, 'escalated', false, 'status', v_standing);
  END IF;
  v_new := CASE WHEN v_count >= 3 THEN 'banned' ELSE 'restricted' END;
  IF v_standing = v_new THEN
    RETURN jsonb_build_object('count', v_count, 'escalated', false, 'status', v_standing);
  END IF;
  v_why := CASE WHEN v_count >= 3 THEN 'Third' ELSE 'Second' END || ' strike: ' || btrim(p_reason);
  UPDATE public.profiles
  SET seller_status = v_new, seller_restriction_reason = v_why, seller_restricted_at = now(), seller_restricted_by = p_issued_by
  WHERE id = p_seller;
  PERFORM public.money_fault_hook('seller_strike_issue:after_status');
  UPDATE public.listings SET status = 'paused'
  WHERE seller_id = p_seller AND status IN ('active', 'pending_approval');
  INSERT INTO public.seller_restrictions (seller_id, restricted_by, restriction_type, reason, metadata)
  VALUES (p_seller, p_issued_by, v_new, v_why, jsonb_build_object('source', 'strikes', 'count', v_count));
  RETURN jsonb_build_object('count', v_count, 'escalated', true, 'status', v_new);
END;
$$;
REVOKE ALL ON FUNCTION public.seller_strike_issue(uuid, uuid, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── 3. Avatar lock ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_profiles_avatar_lock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.avatar_locked_at IS DISTINCT FROM OLD.avatar_locked_at THEN
    RAISE EXCEPTION 'profiles: avatar_locked_at is protected' USING ERRCODE = '42501';
  END IF;
  IF OLD.avatar_locked_at IS NOT NULL AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    RAISE EXCEPTION 'profiles: the profile picture is locked by moderation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profiles_avatar_lock ON public.profiles;
CREATE TRIGGER trg_profiles_avatar_lock BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_avatar_lock();

-- ── 4. Buyer reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('scam', 'prohibited', 'offsite', 'wrong_item', 'inappropriate', 'other')),
  details      text CHECK (details IS NULL OR length(details) <= 500),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  resolved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS listing_reports_open_idx ON public.listing_reports (status, created_at DESC);
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_reports FROM anon, authenticated;
CREATE POLICY listing_reports_owner_read ON public.listing_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
GRANT SELECT (id, listing_id, reason, details, status, created_at) ON public.listing_reports TO authenticated;

-- Files a report as the signed-in buyer. Auto-hide needs 3 open reports
-- from reporters who COUNT (account ≥ 7 days old, or at least one completed
-- purchase): three fresh sock-puppets cannot hide a competitor. No auto-hide
-- for verified sellers (moderators are told instead), and none for 7 days
-- after a moderator dismissed reports on the same listing.
CREATE OR REPLACE FUNCTION public.listing_report_file(p_listing uuid, p_reason text, p_details text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_seller    uuid;
  v_status    text;
  v_verified  boolean;
  v_open      int;
  v_weighted  int;
  v_cooldown  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'listing_report_file: sign in to report' USING ERRCODE = '42501';
  END IF;
  SELECT l.seller_id, l.status, COALESCE(p.is_verified, false) INTO v_seller, v_status, v_verified
  FROM public.listings l JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.id = p_listing;
  -- Only live listings are reportable (drafts / sold rows are not an oracle).
  IF v_seller IS NULL OR v_status NOT IN ('active', 'paused', 'suspended') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_seller = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'own_listing');
  END IF;
  IF EXISTS (SELECT 1 FROM public.listing_reports WHERE listing_id = p_listing AND reporter_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reported');
  END IF;
  IF (SELECT count(*) FROM public.listing_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  INSERT INTO public.listing_reports (listing_id, reporter_id, reason, details)
  VALUES (p_listing, v_uid, p_reason, NULLIF(btrim(COALESCE(p_details, '')), ''));

  SELECT count(*) INTO v_open FROM public.listing_reports WHERE listing_id = p_listing AND status = 'open';
  SELECT count(*) INTO v_weighted
  FROM public.listing_reports r JOIN public.profiles rp ON rp.id = r.reporter_id
  WHERE r.listing_id = p_listing AND r.status = 'open'
    AND (rp.created_at <= now() - interval '7 days'
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = r.reporter_id AND o.status = 'completed'));
  SELECT EXISTS (
    SELECT 1 FROM public.listing_reports WHERE listing_id = p_listing AND status = 'dismissed' AND resolved_at > now() - interval '7 days'
  ) INTO v_cooldown;

  IF v_weighted >= 3 AND v_status = 'active' AND NOT v_verified AND NOT v_cooldown THEN
    PERFORM set_config('app.guarded_write', 'on', true);
    UPDATE public.listings
    SET status = 'suspended', moderation_notes = 'Auto-hidden: ' || v_open || ' buyer reports, awaiting review'
    WHERE id = p_listing AND status = 'active';
    RETURN jsonb_build_object('ok', true, 'hidden', true, 'open', v_open);
  END IF;
  RETURN jsonb_build_object('ok', true, 'hidden', false, 'open', v_open, 'weighted', v_weighted);
END;
$$;
REVOKE ALL ON FUNCTION public.listing_report_file(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listing_report_file(uuid, text, text) TO authenticated, service_role;

-- Probe for tests.
CREATE OR REPLACE FUNCTION public.moderation_tools_version() RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.moderation_tools_version() FROM PUBLIC, anon, authenticated;
