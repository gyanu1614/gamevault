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
