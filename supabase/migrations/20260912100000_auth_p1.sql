-- ============================================================================
-- AUTH-008 / 009 / 011 / 013 / 014 — P1 authorization fixes (audit 2026-09-11,
-- hotfix/auth-p1). Idempotent: safe to re-run.
--
-- Same model as 20260911120000_auth_p0_column_guards.sql: writes to protected
-- columns are rejected with SQLSTATE 42501 unless public.guarded_write_allowed()
-- (service role / SQL editor / the transaction-local app.guarded_write flag).
--
-- Verified before dropping policies (2026-09-12): no SQL function or trigger in
-- any migration inserts into notifications or referral_earnings — every
-- legitimate writer is the application's service-role client.
-- ============================================================================

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.auth_p1_guards_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.auth_p1_guards_version() FROM PUBLIC, anon, authenticated;

-- ── AUTH-008: referral_earnings — backend writes only ────────────────────────
-- Was: INSERT WITH CHECK (auth.uid() IS NOT NULL)  → any user mints commissions
--      UPDATE USING (uid = referrer_id OR admin)    → referrer marks them paid
-- Now: no user INSERT/UPDATE policy at all (RLS stays enabled ⇒ deny). The app
-- writes through the service role from src/lib/referral/commission.ts.
-- SELECT policies (own rows + admins) are unchanged.
DROP POLICY IF EXISTS "referral_earnings_insert_service" ON public.referral_earnings;
DROP POLICY IF EXISTS "referral_earnings_update_service" ON public.referral_earnings;

-- ── AUTH-009: only sellers publish; publish-policy RPC is self-scoped ─────────
-- Two permissive INSERT policies OR'd together; the bare `uid = seller_id` one
-- made "Sellers can insert their own listings" (role = 'seller' OR active
-- admin) dead. Drop it. KYC-before-listing is an explicit owner decision.
DROP POLICY IF EXISTS "Sellers can create listings" ON public.listings;

-- get_seller_publish_policy — re-created verbatim from its latest definition
-- on main (20260906000000_gemstone_seller_tiers.sql) with:
--   · SET search_path = public (SECURITY DEFINER hygiene)
--   · non-service callers are pinned to auth.uid(): p_user_id is ignored, so a
--     user can no longer read another user's tier/limits/counts (AUTH-022 too)
--   · EXECUTE revoked from anon / PUBLIC
-- NOTE for feat/fee-engine-ranks: its metal-rank re-creation of this function
-- must be rebased on this body or it will silently drop the scoping.
CREATE OR REPLACE FUNCTION "public"."get_seller_publish_policy"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tier               TEXT;
  v_is_verified        BOOLEAN;
  v_listing_limit      INTEGER;
  v_bulk_daily_cap     INTEGER;
  v_auto_single        BOOLEAN;
  v_auto_bulk          BOOLEAN;
  v_pre_mod            INTEGER;
  v_active_count       INTEGER;
  v_approved_count     INTEGER;
  v_bulk_today_count   INTEGER;
BEGIN
  -- AUTH-009/022: a JWT caller only ever sees their own policy.
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NOT NULL THEN
    p_user_id := auth.uid();
  END IF;

  SELECT COALESCE(seller_tier, 'quartz'), COALESCE(is_verified, FALSE)
  INTO v_tier, v_is_verified
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'quartz';
    v_is_verified := FALSE;
  END IF;

  SELECT listing_limit, bulk_daily_cap, auto_approve_single,
         auto_approve_bulk, pre_moderation_listings
  INTO v_listing_limit, v_bulk_daily_cap, v_auto_single,
       v_auto_bulk, v_pre_mod
  FROM public.seller_tier_config
  WHERE tier = v_tier;

  SELECT COUNT(*) INTO v_active_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND status = 'active';

  SELECT COUNT(*) INTO v_approved_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND status IN ('active', 'sold', 'archived')
    AND approved_at IS NOT NULL;

  SELECT COUNT(*) INTO v_bulk_today_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND created_at >= NOW() - INTERVAL '24 hours'
    AND (metadata->>'source') = 'bulk';

  RETURN jsonb_build_object(
    'tier',                   v_tier,
    'is_verified',            v_is_verified,
    'listing_limit',          v_listing_limit,
    'active_count',           v_active_count,
    'bulk_daily_cap',         v_bulk_daily_cap,
    'bulk_today_count',       v_bulk_today_count,
    'auto_approve_single',    COALESCE(v_auto_single, FALSE),
    'auto_approve_bulk',      COALESCE(v_auto_bulk, FALSE),
    'approved_listings',      v_approved_count,
    'pre_moderation_listings', COALESCE(v_pre_mod, 0),
    'needs_moderation',       (
      COALESCE(v_pre_mod, 0) > 0
      AND v_approved_count < COALESCE(v_pre_mod, 0)
    ),
    'at_listing_limit', (
      v_listing_limit IS NOT NULL
      AND v_active_count >= v_listing_limit
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION "public"."get_seller_publish_policy"("uuid") FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_seller_publish_policy"("uuid") TO authenticated, service_role;

-- ── AUTH-011: reviews — moderation columns are admin/backend only ────────────
-- "Reviewers can update own reviews within 30 days" re-asserts only
-- reviewer_id + created_at, so the author could clear flagged_for_moderation /
-- moderation_reason on a visible flagged review (a hidden review is already
-- unreachable to them via the SELECT policy). Pin the three moderation columns
-- to trusted writers; admin actions now write through the service role.
CREATE OR REPLACE FUNCTION public.guard_reviews_moderation_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.is_visible IS DISTINCT FROM OLD.is_visible THEN changed := array_append(changed, 'is_visible'); END IF;
  IF NEW.flagged_for_moderation IS DISTINCT FROM OLD.flagged_for_moderation THEN changed := array_append(changed, 'flagged_for_moderation'); END IF;
  IF NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason THEN changed := array_append(changed, 'moderation_reason'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'reviews: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_reviews_moderation_columns ON public.reviews;
CREATE TRIGGER trg_guard_reviews_moderation_columns
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_reviews_moderation_columns();

-- ── AUTH-013: notifications — backend inserts only ───────────────────────────
-- "System can create notifications" was `FOR INSERT TO authenticated WITH
-- CHECK (true)`: any user could push a notification with an arbitrary
-- title/link to ANY user_id (in-app phishing). Every app writer now uses the
-- service role (utils/notifications.ts, payments/notify.ts, checkout nudge,
-- all admin/moderation paths) and filters `link` to an internal path at write
-- time. SELECT/UPDATE/DELETE own-row policies are unchanged.
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- ── AUTH-014: seller_applications — applicants cannot review themselves ──────
-- Nuance found while verifying: "Users can update own pending applications"
-- had no WITH CHECK, and Postgres then reuses USING, so status='approved' was
-- already refused. What WAS open: every review column — reviewed_by /
-- reviewed_at / admin_notes / rejection_* / *_verified — because the policy is
-- column-blind. The policy is re-created with explicit, identical USING and
-- WITH CHECK status sets (+ 'withdrawn' in WITH CHECK, matching the separate
-- withdraw policy), and a trigger pins the review columns.
DROP POLICY IF EXISTS "Users can update own pending applications" ON public.seller_applications;
CREATE POLICY "Users can update own pending applications" ON public.seller_applications
  FOR UPDATE TO authenticated
  USING      (auth.uid() = user_id AND status IN ('pending', 'info_requested'))
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'info_requested', 'withdrawn'));

-- Trusted writers: guarded_write_allowed() OR has_permission('applications.review').
-- The permission door is kept (owner decision 2026-09-12) because admin review
-- writes go through the session client in TWO files (admin-seller-review.ts,
-- admin-sellers.ts) under the existing "Admins can update seller applications"
-- policy. has_permission() is SECURITY DEFINER, search_path=public, and reads
-- only admin_roles + role_permissions.
-- Untrusted (applicant) writers may set admin_notes / reviewed_at / reviewed_by
-- to NULL ONLY when the row is being resubmitted (NEW.status = 'pending') —
-- that is what seller-application.ts does when an info_requested applicant
-- addresses the admin's note. Every other change to a review column → 42501.
CREATE OR REPLACE FUNCTION public.guard_seller_applications_review_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
  resubmit boolean := (NEW.status = 'pending');
BEGIN
  IF public.guarded_write_allowed() OR public.has_permission('applications.review') THEN
    RETURN NEW;
  END IF;
  -- clearable on resubmit only
  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes AND NOT (resubmit AND NEW.admin_notes IS NULL) THEN changed := array_append(changed, 'admin_notes'); END IF;
  IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at AND NOT (resubmit AND NEW.reviewed_at IS NULL) THEN changed := array_append(changed, 'reviewed_at'); END IF;
  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by AND NOT (resubmit AND NEW.reviewed_by IS NULL) THEN changed := array_append(changed, 'reviewed_by'); END IF;
  -- never applicant-writable
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN changed := array_append(changed, 'rejection_reason'); END IF;
  IF NEW.rejection_category IS DISTINCT FROM OLD.rejection_category THEN changed := array_append(changed, 'rejection_category'); END IF;
  IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN changed := array_append(changed, 'rejected_at'); END IF;
  IF NEW.rejected_by IS DISTINCT FROM OLD.rejected_by THEN changed := array_append(changed, 'rejected_by'); END IF;
  IF NEW.identity_verified IS DISTINCT FROM OLD.identity_verified THEN changed := array_append(changed, 'identity_verified'); END IF;
  IF NEW.address_verified IS DISTINCT FROM OLD.address_verified THEN changed := array_append(changed, 'address_verified'); END IF;
  IF NEW.business_verified IS DISTINCT FROM OLD.business_verified THEN changed := array_append(changed, 'business_verified'); END IF;
  IF NEW.tax_verified IS DISTINCT FROM OLD.tax_verified THEN changed := array_append(changed, 'tax_verified'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'seller_applications: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_seller_applications_review_columns ON public.seller_applications;
CREATE TRIGGER trg_guard_seller_applications_review_columns
  BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_applications_review_columns();

-- ── AUTH-030: admin_roles — backend writes only ─────────────────────────────
-- "Users can access own admin role" had NO FOR clause (= ALL commands) with
-- USING/WITH CHECK (uid = user_id): any signed-in user could INSERT their own
-- super_admin row. Reproduced locally 2026-09-12: insert ACCEPTED, is_admin()
-- and is_super_admin_safe() → true. is_admin() / is_super_admin_safe() /
-- has_permission() (the RLS + requireAdmin() sources of truth) read ONLY
-- admin_roles and role_permissions; role_permissions has a SELECT policy only
-- (INSERT verified denied under RLS), and profiles.role is reverted by
-- prevent_profile_privilege_escalation — so admin_roles was the only
-- user-writable input. Drop BOTH write-capable policies: grants/revocations
-- happen through the service role (no super_admin team UI writes this table);
-- the two app-side `last_active_at` touches moved to the service role.
-- SELECT policies (own row; active admins visible for chat) are unchanged.
DROP POLICY IF EXISTS "Users can access own admin role" ON public.admin_roles;
DROP POLICY IF EXISTS "Only super_admin can manage admin roles" ON public.admin_roles;

-- ── AUTH-031: listings — INSERT cannot be born approved / live ──────────────
-- check_listing_moderation_trigger is BEFORE INSERT OR UPDATE and returns early
-- whenever NEW.approved_by IS NOT NULL; the AUTH-006 guard was UPDATE-only. A
-- role='seller' account could INSERT (status='active', approved_by=<self>) and
-- be live with zero moderation (reproduced locally 2026-09-12 for entry and
-- higher tiers). The guard is re-created BEFORE INSERT OR UPDATE: on an
-- untrusted INSERT every moderation column is forced NULL, `sales` to 0, and
-- an 'active' status is coerced to 'pending_approval' (drafts stay drafts).
-- Trusted callers (service role / flag) are untouched — the app's publish
-- paths now insert through the service role AFTER the seller gate and the
-- publish-policy decision, so auto-approve tiers keep working. The UPDATE
-- branch is unchanged from 20260911120000.
-- Trigger order note: `check_listing_moderation_trigger` sorts before
-- `trg_guard_…`, so the moderation trigger runs first; the coercion below is
-- therefore the final word for untrusted inserts.
CREATE OR REPLACE FUNCTION public.guard_listings_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.moderation_notes := NULL;
    NEW.changes_requested_by := NULL;
    NEW.changes_requested_at := NULL;
    NEW.sales := 0;
    IF NEW.status = 'active' THEN
      NEW.status := 'pending_approval';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN changed := array_append(changed, 'approved_by'); END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN changed := array_append(changed, 'approved_at'); END IF;
  IF NEW.rejected_by IS DISTINCT FROM OLD.rejected_by THEN changed := array_append(changed, 'rejected_by'); END IF;
  IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN changed := array_append(changed, 'rejected_at'); END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN changed := array_append(changed, 'rejection_reason'); END IF;
  IF NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes THEN changed := array_append(changed, 'moderation_notes'); END IF;
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN changed := array_append(changed, 'seller_id'); END IF;
  IF NEW.sales IS DISTINCT FROM OLD.sales THEN changed := array_append(changed, 'sales'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'listings: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_listings_protected_columns ON public.listings;
CREATE TRIGGER trg_guard_listings_protected_columns
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listings_protected_columns();

-- ── AUTH-032: seller-application RPCs take the actor from auth.uid() ────────
-- withdraw_seller_application(app, user_id_param) and
-- reject_seller_application(app, admin_id_param, …) were SECURITY DEFINER,
-- EXECUTE-granted to anon + authenticated, and trusted the id PARAMETER.
-- Reproduced locally 2026-09-12: the ANON key withdrew another user's pending
-- application. Both are re-created verbatim from the baseline with:
--   · SET search_path = public
--   · a JWT caller's id parameter is IGNORED — auth.uid() is the actor
--   · withdraw: the row must belong to auth.uid() (service role exempt)
--   · reject: caller must hold has_permission('applications.review')
--     (service role exempt); rejected_by is the caller
--   · EXECUTE revoked from anon / PUBLIC
CREATE OR REPLACE FUNCTION "public"."withdraw_seller_application"("application_id_param" "uuid", "user_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_withdrawal_count integer;
  result jsonb;
BEGIN
  -- AUTH-032: a JWT caller can only act as themselves.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'withdraw_seller_application: authentication required' USING ERRCODE = '42501';
    END IF;
    user_id_param := auth.uid();
  END IF;

  -- Get current withdrawal count
  SELECT withdrawal_count INTO current_withdrawal_count
  FROM public.seller_applications
  WHERE id = application_id_param AND user_id = user_id_param;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or unauthorized');
  END IF;

  -- Increment withdrawal count
  current_withdrawal_count := COALESCE(current_withdrawal_count, 0) + 1;

  -- Update application
  UPDATE public.seller_applications
  SET
    status = 'withdrawn',
    withdrawn_at = now(),
    withdrawal_count = current_withdrawal_count,
    updated_at = now()
  WHERE id = application_id_param;

  -- Check for spam (5+ withdrawals in 30 days)
  result := jsonb_build_object(
    'success', true,
    'withdrawal_count', current_withdrawal_count,
    'flagged_for_spam', current_withdrawal_count >= 5
  );

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION "public"."withdraw_seller_application"("uuid", "uuid") FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."withdraw_seller_application"("uuid", "uuid") TO authenticated, service_role;

CREATE OR REPLACE FUNCTION "public"."reject_seller_application"("application_id_param" "uuid", "admin_id_param" "uuid", "rejection_reason_param" "text", "rejection_category_param" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_rejection_count integer;
  cooldown_period interval;
  result jsonb;
BEGIN
  -- AUTH-032: only a reviewer may reject, and the reviewer is the caller.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_permission('applications.review') THEN
      RAISE EXCEPTION 'reject_seller_application: applications.review permission required' USING ERRCODE = '42501';
    END IF;
    admin_id_param := auth.uid();
  END IF;

  -- Get current rejection count
  SELECT rejection_count INTO current_rejection_count
  FROM public.seller_applications
  WHERE id = application_id_param;

  -- Calculate new rejection count and cooldown
  current_rejection_count := COALESCE(current_rejection_count, 0) + 1;
  cooldown_period := calculate_reapply_cooldown(current_rejection_count - 1);

  -- Update application
  UPDATE public.seller_applications
  SET
    status = 'rejected',
    rejected_at = now(),
    rejected_by = admin_id_param,
    rejection_reason = rejection_reason_param,
    rejection_category = rejection_category_param,
    rejection_count = current_rejection_count,
    can_reapply_at = now() + cooldown_period,
    updated_at = now()
  WHERE id = application_id_param;

  -- Build result
  result := jsonb_build_object(
    'success', true,
    'rejection_count', current_rejection_count,
    'can_reapply_at', now() + cooldown_period,
    'cooldown_days', EXTRACT(day FROM cooldown_period),
    'is_permanent_ban', current_rejection_count >= 4
  );

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION "public"."reject_seller_application"("uuid", "uuid", "text", "text") FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."reject_seller_application"("uuid", "uuid", "text", "text") TO authenticated, service_role;
