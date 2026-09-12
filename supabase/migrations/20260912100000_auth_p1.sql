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

