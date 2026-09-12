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
