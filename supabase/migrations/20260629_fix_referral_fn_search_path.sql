-- ============================================================
-- Fix: referral functions can't see gen_random_bytes (search_path bug)
-- Created: 2026-06-29
--
-- The 2026-06-29 referral fix (generate_referral_code / _for_new_user /
-- handle_new_user) was defined with `SET search_path = public`. But
-- gen_random_bytes() lives in the `extensions` schema (Supabase installs
-- pgcrypto there), so inside those SECURITY DEFINER functions the call fails
-- with "function gen_random_bytes(integer) does not exist" — the SAME trap
-- that broke order completion and was fixed for the money-layer functions in
-- 20260628_money_fn_search_path.sql.
--
-- Live-verified symptoms BEFORE this fix:
--   * SELECT public.generate_referral_code('x')  → errors
--   * INSERT INTO profiles (... referral_code NULL) → backstop trigger RAISES,
--     insert REJECTED
--   * new signups → handle_new_user catches it → profile created with NULL code
--     (the very bug the 2026-06-29 fix tried to eliminate, reintroduced)
-- (The one-time backfill still ran because it executed in an editor session
--  whose search_path already included `extensions`.)
--
-- FIX: add `extensions` to the search_path of all three functions. `public`
-- stays FIRST so our own objects resolve unqualified and can't be shadowed.
-- Bodies are otherwise unchanged from the 2026-06-29 migration.
-- Idempotent: ALTER FUNCTION ... SET is safe to re-run.
-- ============================================================

ALTER FUNCTION public.generate_referral_code(TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.generate_referral_code_for_new_user()
  SET search_path = public, extensions;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, extensions;

-- Self-verifying tail: prove the generator now works end to end.
DO $$
DECLARE
  code TEXT;
BEGIN
  code := public.generate_referral_code('verifyuser');
  IF code IS NULL OR length(code) < 6 THEN
    RAISE EXCEPTION 'generate_referral_code still not working after search_path fix (got %)', code;
  END IF;
  RAISE NOTICE 'OK: generate_referral_code() works under the fixed search_path (sample: %)', code;
END $$;
