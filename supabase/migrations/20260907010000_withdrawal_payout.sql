-- Withdrawal payout completion — the missing half of the withdrawal flow.
--
-- Money flow today:
--   1. Request created  → withdrawal_debit: seller_available/user_wallet → payout_clearing
--                         (idempotent on 'withdrawal:<requestId>', GROSS amount)
--   2. Reject/cancel    → withdrawal_reversal: exact mirror back
--                         (idempotent on 'withdrawal_reversal:<requestId>')
--   3. Ops sends money  → ??? (nothing — payout_clearing accumulated forever)
--
-- This migration adds step 3: withdrawal_payout settles the hold, idempotent
-- on 'payout:<requestId>':
--
--   DR payout_clearing      (gross — what the hold moved in)
--   CR external_payout      (net   — what ops actually sends the seller)
--   CR platform_commission  (fee   — withdrawal fee, recognized at settlement)
--
-- external_payout is the terminal sink for money that has left the platform
-- (owner_type 'external', platform singleton per currency): its credit
-- balance = lifetime paid out, and it reconciles against real bank/chain
-- outflows precisely BECAUSE the fee leg is booked separately.

ALTER TYPE "public"."ledger_account_kind" ADD VALUE IF NOT EXISTS 'external_payout';

CREATE OR REPLACE FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_existing  UUID;
  v_hold_txn  UUID;
  v_reversed  UUID;
  v_fee_minor BIGINT := 0;
  v_entries   JSONB := '[]'::jsonb;
  v_fee_booked BOOLEAN := FALSE;
  r RECORD;
BEGIN
  -- Idempotent: already paid out → return the existing journal.
  SELECT id INTO v_existing FROM ledger_transactions
  WHERE idempotency_key = 'payout:' || p_request_id::text;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- The hold journal is the authority on how much sits in payout_clearing
  -- for this request (and in which currency) — never the requests row.
  SELECT id INTO v_hold_txn FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal:' || p_request_id::text;
  IF v_hold_txn IS NULL THEN
    RAISE EXCEPTION 'withdrawal_payout: no hold journal for request % — nothing to pay out', p_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- A reversed hold (rejected/cancelled request) already gave the money back
  -- to the seller; paying out on top would drain clearing that belongs to
  -- OTHER requests. App-level status gates should make this unreachable —
  -- this is the ledger refusing regardless.
  SELECT id INTO v_reversed FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal_reversal:' || p_request_id::text;
  IF v_reversed IS NOT NULL THEN
    RAISE EXCEPTION 'withdrawal_payout: hold for request % was reversed — refusing to pay out', p_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Withdrawal fee (USD, platform-wide single currency): ops sends NET, the
  -- fee is platform revenue. Missing row → 0 (pure mirror, ledger-only data).
  SELECT ROUND(fee_amount * 100)::BIGINT INTO v_fee_minor
  FROM withdrawal_requests WHERE id = p_request_id;
  v_fee_minor := COALESCE(v_fee_minor, 0);
  IF v_fee_minor < 0 THEN
    RAISE EXCEPTION 'withdrawal_payout: negative fee for request %', p_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Settle each payout_clearing credit leg of the hold (one per currency):
  -- DR clearing gross / CR external net (+ CR commission fee on the USD leg).
  FOR r IN
    SELECT la.currency, le.amount_minor
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE le.transaction_id = v_hold_txn
      AND la.kind = 'payout_clearing'
      AND le.direction = 'credit'
  LOOP
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','payout_clearing','direction','debit','amount_minor',r.amount_minor,'currency',r.currency)
    );
    IF r.currency = 'USD' AND v_fee_minor > 0 THEN
      IF v_fee_minor >= r.amount_minor THEN
        RAISE EXCEPTION 'withdrawal_payout: fee (% minor) >= held amount (% minor) for request %', v_fee_minor, r.amount_minor, p_request_id
          USING ERRCODE = 'check_violation';
      END IF;
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','external','owner_id',NULL,'kind','external_payout','direction','credit','amount_minor',r.amount_minor - v_fee_minor,'currency',r.currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',r.currency)
      );
      v_fee_booked := TRUE;
    ELSE
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','external','owner_id',NULL,'kind','external_payout','direction','credit','amount_minor',r.amount_minor,'currency',r.currency)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_entries) = 0 THEN
    RAISE EXCEPTION 'withdrawal_payout: hold journal % has no payout_clearing credit legs', v_hold_txn
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_fee_minor > 0 AND NOT v_fee_booked THEN
    RAISE EXCEPTION 'withdrawal_payout: fee is set but hold for request % has no USD clearing leg', p_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN post_journal('payout:' || p_request_id::text, v_entries, 'WITHDRAWAL_PAID', NULL);
END;
$$;

ALTER FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") IS 'Money layer: settles a sent withdrawal (payout_clearing → external_payout net + platform_commission fee), sized from the hold journal. Idempotent on payout:<requestId>; refuses missing or reversed holds. Service-role only.';

-- SECURITY: ALTER DEFAULT PRIVILEGES grants EXECUTE on every new function to
-- anon/authenticated (see baseline; 20260903010000 had to patch the same
-- footgun). Without these revokes any logged-in seller could hit
-- /rest/v1/rpc/withdrawal_payout on their own pending request, then cancel
-- it — keeping the money while the books record a phantom payout.
REVOKE ALL ON FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") FROM "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."withdrawal_payout"("p_request_id" "uuid") TO "service_role";

-- Symmetric guard on the OTHER side: once a payout journal exists, the money
-- left the building — a reversal (reject/cancel) must never hand it back to
-- the seller's balance too. Same body as the baseline withdrawal_reversal
-- plus the payout check.
CREATE OR REPLACE FUNCTION "public"."withdrawal_reversal"("p_request_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_hold_txn UUID;
  v_existing UUID;
  v_paid     UUID;
  v_entries  JSONB := '[]'::jsonb;
  r RECORD;
BEGIN
  SELECT id INTO v_existing FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal_reversal:' || p_request_id::text;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_hold_txn FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal:' || p_request_id::text;
  IF v_hold_txn IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_paid FROM ledger_transactions
  WHERE idempotency_key = 'payout:' || p_request_id::text;
  IF v_paid IS NOT NULL THEN
    RAISE EXCEPTION 'withdrawal_reversal: request % was already paid out — cannot return held funds', p_request_id
      USING ERRCODE = 'check_violation';
  END IF;

  FOR r IN
    SELECT la.owner_type, la.owner_id, la.kind, la.currency, le.direction, le.amount_minor
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE le.transaction_id = v_hold_txn
  LOOP
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'owner_type', r.owner_type,
        'owner_id',   r.owner_id,
        'kind',       r.kind,
        'direction',  CASE WHEN r.direction = 'debit' THEN 'credit' ELSE 'debit' END,
        'amount_minor', r.amount_minor,
        'currency',   r.currency
      )
    );
  END LOOP;

  RETURN post_journal('withdrawal_reversal:' || p_request_id::text, v_entries, 'WITHDRAWAL_REVERSED', NULL);
END;
$$;

COMMENT ON FUNCTION "public"."withdrawal_reversal"("p_request_id" "uuid") IS 'Money layer: exact mirror of a withdrawal hold journal (payout_clearing → original sources) on reject/cancel. Idempotent per request; refuses when the request was already paid out. Service-role only.';

REVOKE ALL ON FUNCTION "public"."withdrawal_reversal"("p_request_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."withdrawal_reversal"("p_request_id" "uuid") FROM "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."withdrawal_reversal"("p_request_id" "uuid") TO "service_role";
