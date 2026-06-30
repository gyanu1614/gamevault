-- ============================================================
-- MONEY LAYER — Phase 6a, part 2/2: wallet genesis + ops + lockdown
-- Created: 2026-06-29
-- RUN AFTER part 1 (which adds the user_wallet / genesis_clearing enum kinds).
--
-- 1. GENESIS import: each user's CURRENT available_balance → one opening
--    journal (DR genesis_clearing / CR user_wallet), in the balance's
--    historical currency (USD). Idempotent on a per-user fixed key.
-- 2. Reconciliation guard: SUM(user_wallet ledger) must equal SUM(legacy
--    available_balance); raises otherwise (we abort rather than ship drift).
-- 3. wallet_credit / wallet_spend RPCs (refund-in / checkout-debit), balanced
--    + balance-guarded + idempotent.
-- 4. user_wallet_balance() derived reader.
-- 5. Lock the old float tables' RLS (close the USING(true) mint-balance hole).
--
-- Idempotent. Service-role only.
-- ============================================================

-- ─── 1. GENESIS import ────────────────────────────────────────────
-- One opening journal per user with a nonzero available_balance. Key is fixed
-- per user so re-running never double-imports.
DO $$
DECLARE
  r RECORD;
  v_minor BIGINT;
BEGIN
  FOR r IN
    SELECT user_id, available_balance
    FROM wallet_balances
    WHERE available_balance > 0
  LOOP
    v_minor := (r.available_balance * 100)::BIGINT;  -- exact NUMERIC math
    -- DR genesis_clearing / CR user_wallet  (USD = the balance's historical currency)
    PERFORM post_journal(
      'wallet_genesis:' || r.user_id::text,
      jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','genesis_clearing','direction','debit','amount_minor',v_minor,'currency','USD'),
        jsonb_build_object('owner_type','buyer','owner_id',r.user_id::text,'kind','user_wallet','direction','credit','amount_minor',v_minor,'currency','USD')
      ),
      'WALLET_GENESIS',
      NULL
    );
  END LOOP;
END $$;

-- ─── 2. Reconciliation guard ──────────────────────────────────────
DO $$
DECLARE
  v_ledger_usd BIGINT;
  v_legacy_usd BIGINT;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN le.direction='credit' THEN le.amount_minor ELSE -le.amount_minor END),0)
    INTO v_ledger_usd
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE la.kind = 'user_wallet' AND la.currency = 'USD';

  SELECT COALESCE(SUM((available_balance*100)::BIGINT),0) INTO v_legacy_usd
  FROM wallet_balances WHERE available_balance > 0;

  IF v_ledger_usd <> v_legacy_usd THEN
    RAISE EXCEPTION 'Wallet genesis reconciliation FAILED: ledger user_wallet USD=% but legacy balances=%',
      v_ledger_usd, v_legacy_usd;
  END IF;
  RAISE NOTICE 'Wallet genesis reconciled OK: % minor units (USD)', v_ledger_usd;
END $$;

-- ─── 3. Wallet ops RPCs ───────────────────────────────────────────
-- wallet_credit: add funds to a user's wallet (refund-in, cashback). Balanced
-- against a source account kind (e.g. 'refunds' for a refund, 'platform_commission'
-- inverse for cashback — caller picks the counterparty). Idempotent on key.
CREATE OR REPLACE FUNCTION wallet_credit(
  p_user_id        UUID,
  p_amount_minor   BIGINT,
  p_currency       CHAR(3),
  p_counterparty   ledger_account_kind,  -- the source: 'refunds', 'platform_commission', ...
  p_idempotency_key TEXT,
  p_event_ref      TEXT DEFAULT NULL,
  p_order_id       UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'wallet_credit: amount must be > 0' USING ERRCODE='check_violation';
  END IF;
  RETURN post_journal(
    p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind',p_counterparty::text,'direction','debit','amount_minor',p_amount_minor,'currency',p_currency),
      jsonb_build_object('owner_type','buyer','owner_id',p_user_id::text,'kind','user_wallet','direction','credit','amount_minor',p_amount_minor,'currency',p_currency)
    ),
    COALESCE(p_event_ref,'WALLET_CREDIT'),
    p_order_id
  );
END;
$$;

-- wallet_spend: debit a user's wallet to pay toward an order (checkout credit).
-- Guards against overspend: refuses if the derived balance is insufficient.
CREATE OR REPLACE FUNCTION wallet_spend(
  p_user_id        UUID,
  p_amount_minor   BIGINT,
  p_currency       CHAR(3),
  p_target         ledger_account_kind,  -- where it goes: 'escrow_held' (toward an order)
  p_idempotency_key TEXT,
  p_event_ref      TEXT DEFAULT NULL,
  p_order_id       UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_bal BIGINT;
  v_existing UUID;
BEGIN
  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'wallet_spend: amount must be > 0' USING ERRCODE='check_violation';
  END IF;

  -- Idempotent: if already posted, return it without re-checking balance.
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Balance guard (derived).
  SELECT user_wallet_balance(p_user_id, p_currency) INTO v_bal;
  IF v_bal < p_amount_minor THEN
    RAISE EXCEPTION 'wallet_spend: insufficient wallet balance (have %, need %)', v_bal, p_amount_minor
      USING ERRCODE='check_violation';
  END IF;

  RETURN post_journal(
    p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('owner_type','buyer','owner_id',p_user_id::text,'kind','user_wallet','direction','debit','amount_minor',p_amount_minor,'currency',p_currency),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind',p_target::text,'direction','credit','amount_minor',p_amount_minor,'currency',p_currency)
    ),
    COALESCE(p_event_ref,'WALLET_SPEND'),
    p_order_id
  );
END;
$$;

-- ─── 4. Derived balance reader ────────────────────────────────────
CREATE OR REPLACE FUNCTION user_wallet_balance(p_user_id UUID, p_currency CHAR(3))
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(SUM(CASE WHEN le.direction='credit' THEN le.amount_minor ELSE -le.amount_minor END),0)::BIGINT
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE la.owner_type='buyer' AND la.owner_id = p_user_id AND la.kind='user_wallet' AND la.currency = p_currency;
$$;

-- ─── 5. Lock down the old float tables (close the mint-balance hole) ─
-- Replace the permissive USING(true) policies (audit Critical) with
-- service-role-only access. The app's user-bound client can no longer write
-- these tables; the ledger is now the source of truth.
DROP POLICY IF EXISTS "System can manage wallet balances"     ON public.wallet_balances;
DROP POLICY IF EXISTS "System can manage wallet transactions"  ON public.wallet_transactions;
-- (No replacement policy for authenticated → RLS denies all non-service-role
--  writes. The per-user SELECT policies from 20260225 remain for read.)

REVOKE ALL ON FUNCTION wallet_credit(UUID, BIGINT, CHAR, ledger_account_kind, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wallet_spend(UUID, BIGINT, CHAR, ledger_account_kind, TEXT, TEXT, UUID)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION user_wallet_balance(UUID, CHAR)                                            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_credit(UUID, BIGINT, CHAR, ledger_account_kind, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_spend(UUID, BIGINT, CHAR, ledger_account_kind, TEXT, TEXT, UUID)   TO service_role;
GRANT EXECUTE ON FUNCTION user_wallet_balance(UUID, CHAR)                                            TO service_role;

COMMENT ON FUNCTION user_wallet_balance(UUID, CHAR) IS
  'Money layer: derived buyer wallet balance (sum of user_wallet ledger entries). The wallet is now ledger-backed; wallet_balances float table is a legacy read-model, writes locked to service_role.';
