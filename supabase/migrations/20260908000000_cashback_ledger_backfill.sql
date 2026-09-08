-- Cashback onto the ledger (2026-09-07).
--
-- awardCashback (src/lib/loyalty/award.ts) now posts wallet_credit
-- (platform_commission → user_wallet, idempotency key cashback:<order_id>),
-- making cashback spendable store credit; loyalty_credits stays as the
-- display/history table and the profiles.loyalty_balance /
-- lifetime_cashback_earned counters are no longer maintained (they had a
-- lost-update race and were never spendable).
--
-- Two jobs, in order:
--   1. Lock loyalty_credits writes. The old INSERT policy
--      ("loyalty_credits_insert_service", WITH CHECK auth.uid() = user_id)
--      plus the authenticated GRANT let ANY logged-in user forge 'earned'
--      rows via PostgREST — display-only until now, mintable money once a
--      backfill trusts the table. Writes go service-role only (bypasses RLS);
--      the app's history insert already uses the service client.
--   2. Backfill the ledger for cashback earned before the cutover, keyed
--      exactly as the new code keys it (post_journal dedupes on the key, so
--      completed orders can never double-post and re-running is a no-op).
--      Every row must prove provenance — a completed order owned by the
--      credited user, amount within a cent of the 2% rate — and the
--      migration FAILS CLOSED on any row that doesn't, since a forged row
--      here would otherwise become real money.

-- ── 1. Service-role-only writes on the history table ─────────────────────────

REVOKE INSERT, UPDATE, DELETE ON TABLE public.loyalty_credits FROM anon, authenticated;
DROP POLICY IF EXISTS "loyalty_credits_insert_service" ON public.loyalty_credits;
-- SELECT policies (own rows + admin) stay as they are.

-- ── 2. Provenance-checked backfill ───────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  v_bad BIGINT;
  v_minor BIGINT;
  v_ledger_minor BIGINT;
  v_history_minor BIGINT;
BEGIN
  -- Only 'earned' rows are expected: the 2026-09-04 cleanup recomputed the
  -- counters from exactly these (nothing has ever been redeemed/expired).
  -- Any other type appearing means the backfill needs debit handling too.
  PERFORM 1 FROM loyalty_credits WHERE type <> 'earned';
  IF FOUND THEN
    RAISE EXCEPTION 'cashback backfill: non-earned loyalty_credits exist — extend the backfill before applying';
  END IF;

  -- Fail closed on any earned row without provenance: it must belong to a
  -- completed order bought by the credited user, with the amount within one
  -- cent of the 2% rate. Anything else could be a user-forged PostgREST
  -- insert (the pre-lock policy allowed them) and must be hand-audited, not
  -- minted.
  SELECT count(*) INTO v_bad
  FROM loyalty_credits lc
  LEFT JOIN orders o ON o.id = lc.order_id
  WHERE lc.type = 'earned'
    AND (o.id IS NULL
         OR o.buyer_id IS DISTINCT FROM lc.user_id
         OR o.status <> 'completed'
         OR ABS(ROUND(lc.amount * 100) - ROUND(COALESCE(o.subtotal, 0) * 0.02 * 100)) > 1);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'cashback backfill: % earned row(s) without provenance (no completed own order at ~2%%) — audit loyalty_credits before applying', v_bad;
  END IF;

  FOR r IN
    SELECT lc.user_id, lc.order_id, lc.amount, o.currency
    FROM loyalty_credits lc
    JOIN orders o ON o.id = lc.order_id
    WHERE lc.type = 'earned'
  LOOP
    v_minor := ROUND(r.amount * 100)::bigint;
    IF v_minor <= 0 THEN CONTINUE; END IF;
    PERFORM wallet_credit(
      r.user_id,
      v_minor,
      UPPER(COALESCE(r.currency, 'USD'))::character(3),
      'platform_commission'::ledger_account_kind,
      'cashback:' || r.order_id,
      'CASHBACK',
      r.order_id
    );
  END LOOP;

  -- Post-assert: every history dollar is on the ledger, to the cent.
  SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_ledger_minor
  FROM ledger_entries le
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE lt.idempotency_key LIKE 'cashback:%'
    AND la.kind = 'user_wallet' AND le.direction = 'credit';

  SELECT COALESCE(SUM(ROUND(amount * 100)), 0)::bigint INTO v_history_minor
  FROM loyalty_credits WHERE type = 'earned';

  IF v_ledger_minor <> v_history_minor THEN
    RAISE EXCEPTION 'cashback backfill: ledger % <> history % (minor units)',
      v_ledger_minor, v_history_minor;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.loyalty_balance IS
  'DEPRECATED 2026-09-07: cashback lives on the ledger (user_wallet); no longer maintained.';
COMMENT ON COLUMN public.profiles.lifetime_cashback_earned IS
  'DEPRECATED 2026-09-07: derive from loyalty_credits; no longer maintained.';
