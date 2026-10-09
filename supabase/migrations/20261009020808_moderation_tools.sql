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
CREATE OR REPLACE FUNCTION public.takedown_listing(listing_id uuid, admin_id uuid, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();
  IF reason IS NULL OR length(btrim(reason)) < 3 THEN
    RAISE EXCEPTION 'takedown_listing: a reason is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.listings
  SET status = 'suspended',
      moderation_notes = 'Taken down: ' || btrim(reason),
      changes_requested_by = admin_id,
      changes_requested_at = now()
  WHERE id = listing_id
    AND status IN ('active', 'paused', 'pending_approval', 'changes_requested');
END;
$$;
REVOKE ALL ON FUNCTION public.takedown_listing(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.takedown_listing(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_listing(listing_id uuid, admin_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();
  UPDATE public.listings
  SET status = 'active',
      moderation_notes = NULL,
      approved_by = COALESCE(approved_by, admin_id),
      approved_at = COALESCE(approved_at, now())
  WHERE id = listing_id AND status = 'suspended';
END;
$$;
REVOKE ALL ON FUNCTION public.restore_listing(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_listing(uuid, uuid) TO authenticated, service_role;

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
-- A seller may read their own strikes (the restrictions page shows them).
CREATE POLICY seller_strikes_owner_read ON public.seller_strikes
  FOR SELECT TO authenticated USING (seller_id = auth.uid());
GRANT SELECT ON public.seller_strikes TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_strike_count(p_seller uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
  SELECT count(*)::int FROM public.seller_strikes WHERE seller_id = p_seller AND revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.seller_strike_count(uuid) FROM PUBLIC, anon, authenticated;

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
GRANT SELECT ON public.listing_reports TO authenticated;

-- Files a report as the signed-in buyer; the 3rd open report hides the listing.
CREATE OR REPLACE FUNCTION public.listing_report_file(p_listing uuid, p_reason text, p_details text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_seller uuid;
  v_status text;
  v_open   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'listing_report_file: sign in to report' USING ERRCODE = '42501';
  END IF;
  SELECT seller_id, status INTO v_seller, v_status FROM public.listings WHERE id = p_listing;
  IF v_seller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_seller = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'own_listing');
  END IF;
  IF EXISTS (SELECT 1 FROM public.listing_reports WHERE listing_id = p_listing AND reporter_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reported');
  END IF;
  -- At most 10 reports per reporter per day (abuse of the abuse tool).
  IF (SELECT count(*) FROM public.listing_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  INSERT INTO public.listing_reports (listing_id, reporter_id, reason, details)
  VALUES (p_listing, v_uid, p_reason, NULLIF(btrim(COALESCE(p_details, '')), ''));

  SELECT count(*) INTO v_open FROM public.listing_reports WHERE listing_id = p_listing AND status = 'open';
  IF v_open >= 3 AND v_status = 'active' THEN
    PERFORM set_config('app.guarded_write', 'on', true);
    UPDATE public.listings
    SET status = 'suspended', moderation_notes = 'Auto-hidden: ' || v_open || ' buyer reports, awaiting review'
    WHERE id = p_listing AND status = 'active';
    RETURN jsonb_build_object('ok', true, 'hidden', true, 'open', v_open);
  END IF;
  RETURN jsonb_build_object('ok', true, 'hidden', false, 'open', v_open);
END;
$$;
REVOKE ALL ON FUNCTION public.listing_report_file(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listing_report_file(uuid, text, text) TO authenticated, service_role;

-- Probe for tests.
CREATE OR REPLACE FUNCTION public.moderation_tools_version() RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.moderation_tools_version() FROM PUBLIC, anon, authenticated;
