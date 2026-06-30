-- ============================================================
-- MONEY LAYER — fix SECURITY DEFINER search_path (add `extensions`)
-- Created: 2026-06-28
--
-- Why: the money-layer functions were created with `SET search_path = public`.
-- That hides Supabase's `extensions` schema, where pgcrypto's gen_random_bytes
-- lives. safedrop_transition() flips an order to `completed`, which fires the
-- Trustpilot trigger chain → generate_trustpilot_token() → gen_random_bytes().
-- Under search_path=public that call fails with
-- "function gen_random_bytes(integer) does not exist", aborting the whole
-- transaction — even though pgcrypto IS installed (in `extensions`, on the
-- normal session search_path). The restricted search_path inside our
-- SECURITY DEFINER functions is what masked it.
--
-- Fix: append `extensions` to the search_path of every money-layer function so
-- transitively-called extension functions resolve. `public` stays FIRST so our
-- own tables/functions still resolve unqualified (and so a same-named object in
-- public always wins — no hijack risk from the extensions schema).
--
-- The CREATE OR REPLACE bodies in 20260628_ledger.sql /
-- 20260628_safedrop_transition.sql have been updated to match; this ALTER
-- patches the ALREADY-APPLIED live functions without re-running those files.
-- Idempotent: ALTER FUNCTION ... SET is safe to re-run.
-- ============================================================

ALTER FUNCTION post_journal(TEXT, JSONB, TEXT, UUID)
  SET search_path = public, extensions;

ALTER FUNCTION ledger_resolve_account(ledger_owner_type, UUID, ledger_account_kind, CHAR)
  SET search_path = public, extensions;

ALTER FUNCTION ledger_balance(ledger_owner_type, UUID, ledger_account_kind, CHAR)
  SET search_path = public, extensions;

ALTER FUNCTION safedrop_transition(UUID, TEXT, TEXT)
  SET search_path = public, extensions;
