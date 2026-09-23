-- ============================================================================
-- PAY-001 (P0) — audit pass 6 (docs/audit/pass-6-checkout.md), fix/checkout-p0.
-- Idempotent: safe to re-run.
--
-- wallet_spend guarded the balance with a plain read of the derived aggregate
-- user_wallet_balance(): no row lock, nothing to conflict on. Two concurrent
-- spends with DIFFERENT idempotency keys (two checkout tabs on two different
-- listings, key checkout_wallet:<orderId>) both read the same pre-spend
-- balance, both pass the guard, both post — the wallet goes negative.
-- Reproduced: src/test/guards/pay-001-wallet-double-spend.repro.integration
-- .test.ts (final balance −1000 on a 1000 wallet).
--
-- Fix: serialise every spend on ONE per-user transaction-scoped advisory lock
-- taken BEFORE the balance read. The second spender blocks until the first
-- commits, re-reads the post-commit balance and is refused. Transaction-scoped
-- (pg_advisory_xact_lock) so a rolled-back spend releases it automatically;
-- keyed on the user only (not the currency) so the guard is coarse and simple.
-- The idempotency short-circuit stays BEFORE the lock (a replay never waits),
-- and is re-checked AFTER it (a same-key race that committed while we waited
-- returns that journal instead of double-posting).
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."wallet_spend"("p_user_id" "uuid", "p_amount_minor" bigint, "p_currency" character, "p_target" "public"."ledger_account_kind", "p_idempotency_key" "text", "p_event_ref" "text" DEFAULT NULL::"text", "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

  -- PAY-001: one spender per wallet at a time. Held until COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtextextended('wallet_spend:' || p_user_id::text, 0));

  -- Re-check under the lock: a same-key call may have committed while we waited.
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Balance guard (derived) — now serialised, so it sees every committed spend.
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

-- Posture unchanged (20260913100000): service_role only.
REVOKE ALL ON FUNCTION public.wallet_spend(uuid, bigint, character, ledger_account_kind, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_spend(uuid, bigint, character, ledger_account_kind, text, text, uuid) TO service_role;
COMMENT ON FUNCTION public.wallet_spend(uuid, bigint, character, ledger_account_kind, text, text, uuid) IS
  'Money layer: debit user_wallet → p_target, balance-guarded under a per-user advisory xact lock (PAY-001), idempotent on p_idempotency_key. Service-role only.';
