-- ============================================================================
-- DB-015 / DB-016 / DB-017 (P1) — audit 2026-09-11, fix/money-atomicity.
-- Idempotent: safe to re-run.
--
-- The money core (safedrop_transition, post_journal, wallet_*, withdrawal_*)
-- is atomic; the SEAMS around it were not. App code composed two RPCs or two
-- statements with nothing that compensated or retried when the second one
-- failed. Reproduced on the local stack (src/test/guards/money-atomicity.
-- guard.integration.test.ts, commit "DB-015/016/017 RED"):
--   · createCheckout supersede: transition(CANCELLED) then a separate wallet
--     return → wallet RPC failure leaves the buyer short on a terminal order.
--   · REFUND_COMPLETED webhook: transition(REFUNDED) then a swallowed wallet
--     credit → event marked processed, provider replay deduped, credit lost.
--   · cancel/rejectWithdrawalRequest: status flip BEFORE withdrawal_reversal
--     → "Funds stay in your wallet" while the hold is still (or forever) gone.
--   · deliverCodeToBuyer: unlocked select + two UPDATEs → same code to two
--     buyers; a failed order UPDATE burns a code and the retry sells another.
--   · recordPromoUsage: SELECT total_used / UPDATE n+1 → lost updates.
--   · recordReferralCommission had no caller (app-side fix; the partial
--     unique index below makes the insert race-safe).
--
-- Model: each seam becomes ONE SECURITY DEFINER function (service_role only,
-- SET search_path = public, app.guarded_write on) that does every step in
-- the caller's single transaction and is idempotent on the same keys the app
-- already used, so replays of earlier partial runs converge. Hold returns
-- now MIRROR the checkout hold (escrow_held → user_wallet) instead of posting
-- refunds → user_wallet against a hold that was never released (that left
-- escrow_held inflated for every cancelled pending order — see the read-only
-- query in the FINDINGS entry).
-- ============================================================================

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.money_atomicity_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.money_atomicity_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_atomicity_version() TO service_role;

-- ── Fault hook (tests only) ──────────────────────────────────────────────────
-- Raises when the transaction-local GUC app.money_fault equals p_point. Only a
-- direct database session can set that GUC (SET LOCAL); PostgREST callers
-- cannot, so on prod this is a no-op branch. The GREEN tests open a psql
-- transaction, set the GUC, call the atomic function and prove that a failure
-- at any interior point leaves no partial state. See CLAUDE.md.
CREATE OR REPLACE FUNCTION public.money_fault_hook(p_point text) RETURNS void
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.money_fault', true), '') = p_point THEN
    RAISE EXCEPTION 'money_fault_hook: injected fault at %', p_point USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.money_fault_hook(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_fault_hook(text) TO service_role;

-- ── DB-015a/b (CHARGE_FAILED + supersede): cancel + return the wallet hold ──
-- Wraps safedrop_transition(CANCELLED) and the exact mirror of the checkout
-- hold journal (checkout_wallet:<order>, user_wallet → escrow_held) into one
-- transaction. Idempotent on both keys: a replay after a partial earlier run
-- posts only the missing half. Already-terminal orders that were NOT
-- cancelled (paid/refunded/completed) raise, exactly as the transition does.
CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(p_order_id uuid, p_dedupe_key text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_transition JSONB;
  v_hold_txn   UUID;
  v_wallet_txn UUID;
  v_entries    JSONB := '[]'::jsonb;
  r RECORD;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_cancel_return_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 1. Cancel (no-op when already cancelled; raises on an illegal move).
  v_transition := safedrop_transition(p_order_id, 'CANCELLED', p_dedupe_key, NULL, NULL);

  PERFORM money_fault_hook('order_cancel_return_wallet:after_transition');

  -- 2. Mirror the checkout hold back to the buyer's wallet.
  SELECT id INTO v_hold_txn FROM ledger_transactions
  WHERE idempotency_key = 'checkout_wallet:' || p_order_id::text;
  IF v_hold_txn IS NOT NULL THEN
    FOR r IN
      SELECT la.owner_type, la.owner_id, la.kind, la.currency, le.direction, le.amount_minor
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.transaction_id = v_hold_txn
    LOOP
      v_entries := v_entries || jsonb_build_array(jsonb_build_object(
        'owner_type', r.owner_type,
        'owner_id',   r.owner_id,
        'kind',       r.kind,
        'direction',  CASE WHEN r.direction = 'debit' THEN 'credit' ELSE 'debit' END,
        'amount_minor', r.amount_minor,
        'currency',   r.currency
      ));
    END LOOP;
    v_wallet_txn := post_journal('wallet_refund:' || p_order_id::text, v_entries, 'REFUND_TO_WALLET', p_order_id);
  END IF;

  RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn);
END;
$$;
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text) TO service_role;
COMMENT ON FUNCTION public.order_cancel_return_wallet(uuid, text) IS
  'Money layer (DB-015): safedrop_transition(CANCELLED) + exact mirror of the checkout wallet hold back to user_wallet, in one transaction. Idempotent on order:<id>:CANCELLED and wallet_refund:<id>. Service-role only.';

-- ── DB-015b (REFUND_COMPLETED): refund + credit the buyer's wallet ──────────
-- safedrop_transition(REFUNDED) moves escrow_held → refunds (gross); the buyer
-- credit refunds → user_wallet rides in the SAME transaction. p_amount_minor is
-- what the provider actually refunded, clamped to the order total (partial
-- refunds are real; a provider quirk can never over-credit); NULL/0 = total.
CREATE OR REPLACE FUNCTION public.order_refund_to_wallet(p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_amount_minor bigint DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_transition JSONB;
  v_total      BIGINT;
  v_credit     BIGINT;
  v_wallet_txn UUID;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_refund_to_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  v_transition := safedrop_transition(p_order_id, 'REFUNDED', p_dedupe_key, NULL, NULL);

  PERFORM money_fault_hook('order_refund_to_wallet:after_transition');

  v_total := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
  IF v_order.buyer_id IS NOT NULL AND v_total > 0 THEN
    v_credit := CASE WHEN p_amount_minor IS NOT NULL AND p_amount_minor > 0 AND p_amount_minor < v_total
                     THEN p_amount_minor ELSE v_total END;
    v_wallet_txn := wallet_credit(
      v_order.buyer_id, v_credit, UPPER(COALESCE(v_order.currency, 'USD'))::char(3), 'refunds',
      'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
  END IF;

  RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'credited_minor', v_credit);
END;
$$;
REVOKE ALL ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint) TO service_role;
COMMENT ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint) IS
  'Money layer (DB-015): safedrop_transition(REFUNDED) + buyer wallet credit (refunds → user_wallet, clamped to the order total) in one transaction. Idempotent on order:<id>:REFUNDED[:dedupe] and wallet_refund:<id>. Service-role only.';

-- ── DB-015c: withdrawal cancel / reject — reversal FIRST, then the flip ─────
-- Both lock the request row, run withdrawal_reversal (which raises when the
-- hold was already paid out — the row then stays as it was), and only then
-- flip status. Returns {changed:false} when the row is no longer pending.
CREATE OR REPLACE FUNCTION public.withdrawal_cancel(p_request_id uuid, p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req  RECORD;
  v_txn  UUID;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'status', v_req.status);
  END IF;

  v_txn := withdrawal_reversal(p_request_id);
  PERFORM money_fault_hook('withdrawal_cancel:after_reversal');

  UPDATE withdrawal_requests SET status = 'cancelled', updated_at = NOW() WHERE id = p_request_id;
  RETURN jsonb_build_object('request_id', p_request_id, 'changed', true, 'status', 'cancelled', 'reversal_txn_id', v_txn);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_cancel(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_cancel(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.withdrawal_cancel(uuid, uuid) IS
  'Money layer (DB-015): owner cancels a pending withdrawal — withdrawal_reversal then status=cancelled in one transaction; a refused reversal leaves the row pending. Service-role only.';

CREATE OR REPLACE FUNCTION public.withdrawal_reject(p_request_id uuid, p_admin_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req  RECORD;
  v_txn  UUID;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'status', v_req.status);
  END IF;

  v_txn := withdrawal_reversal(p_request_id);
  PERFORM money_fault_hook('withdrawal_reject:after_reversal');

  UPDATE withdrawal_requests
     SET status = 'rejected', rejected_at = NOW(), processed_by = p_admin_id, admin_notes = p_reason, updated_at = NOW()
   WHERE id = p_request_id;
  RETURN jsonb_build_object(
    'request_id', p_request_id, 'changed', true, 'status', 'rejected', 'reversal_txn_id', v_txn,
    'user_id', v_req.user_id, 'amount', v_req.amount, 'method_id', v_req.method_id, 'method_name', v_req.method_name);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_reject(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_reject(uuid, uuid, text) TO service_role;
COMMENT ON FUNCTION public.withdrawal_reject(uuid, uuid, text) IS
  'Money layer (DB-015): admin rejects a pending withdrawal — withdrawal_reversal then status=rejected in one transaction; a refused reversal leaves the row pending. Service-role only.';

-- ── DB-016a: claim one inventory code for an order ──────────────────────────
-- Locks the order, returns the existing claim on retry, otherwise takes ONE
-- available row with FOR UPDATE SKIP LOCKED and stamps both the inventory row
-- and the order in the same transaction. delivery_data stays encrypted (the
-- app decrypts with DELIVERY_ENCRYPTION_KEY); service-role callers only.
CREATE OR REPLACE FUNCTION public.inventory_claim_for_order(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_inv   RECORD;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT id, listing_id, buyer_id, status, instant_delivery_inventory_id
    INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_claim_for_order: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.instant_delivery_inventory_id IS NOT NULL THEN
    SELECT id, delivery_data, delivery_type INTO v_inv
      FROM instant_delivery_inventory WHERE id = v_order.instant_delivery_inventory_id;
    RETURN jsonb_build_object('inventory_id', v_inv.id, 'delivery_data', v_inv.delivery_data,
                              'delivery_type', v_inv.delivery_type, 'already_claimed', true);
  END IF;

  UPDATE instant_delivery_inventory
     SET status = 'sold', sold_to_order_id = p_order_id, sold_at = NOW(),
         decrypted_at = NOW(), decrypted_by_user_id = v_order.buyer_id
   WHERE id = (
     SELECT id FROM instant_delivery_inventory
      WHERE listing_id = v_order.listing_id AND status = 'available'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1)
  RETURNING id, delivery_data, delivery_type INTO v_inv;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('inventory_id', NULL, 'already_claimed', false);
  END IF;

  PERFORM money_fault_hook('inventory_claim_for_order:after_inventory');

  UPDATE orders
     SET instant_delivery_inventory_id = v_inv.id,
         instant_delivery_delivered_at = COALESCE(instant_delivery_delivered_at, NOW())
   WHERE id = p_order_id;

  RETURN jsonb_build_object('inventory_id', v_inv.id, 'delivery_data', v_inv.delivery_data,
                            'delivery_type', v_inv.delivery_type, 'already_claimed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_claim_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_claim_for_order(uuid) TO service_role;
COMMENT ON FUNCTION public.inventory_claim_for_order(uuid) IS
  'DB-016: atomic FOR UPDATE SKIP LOCKED claim of one available inventory row for an order, stamping inventory + order together; returns the existing claim on retry. Service-role only.';

-- ── DB-016b: promo usage — one row + counter, serialized on the promo row ───
-- Locks the promo_codes row (serializes concurrent redemptions), records the
-- usage once per (promo, order) and increments total_used in place.
CREATE OR REPLACE FUNCTION public.promo_usage_record(p_promo_code_id uuid, p_order_id uuid, p_user_id uuid, p_discount_amount numeric)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM 1 FROM promo_codes WHERE id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'promo_usage_record: promo % not found', p_promo_code_id USING ERRCODE = 'no_data_found';
  END IF;
  IF EXISTS (SELECT 1 FROM promo_code_usages WHERE promo_code_id = p_promo_code_id AND order_id = p_order_id) THEN
    SELECT total_used INTO v_total FROM promo_codes WHERE id = p_promo_code_id;
    RETURN jsonb_build_object('recorded', false, 'total_used', v_total);
  END IF;
  INSERT INTO promo_code_usages (promo_code_id, user_id, order_id, discount_amount)
  VALUES (p_promo_code_id, p_user_id, p_order_id, p_discount_amount);
  PERFORM money_fault_hook('promo_usage_record:after_usage');
  UPDATE promo_codes SET total_used = total_used + 1 WHERE id = p_promo_code_id RETURNING total_used INTO v_total;
  RETURN jsonb_build_object('recorded', true, 'total_used', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) TO service_role;
COMMENT ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) IS
  'DB-016: records one promo usage per (promo, order) and increments total_used atomically under the promo row lock. Service-role only.';

-- ── DB-017: one purchase commission per order ──────────────────────────────
-- referral_earnings has never held a purchase_commission row (the recorder
-- had no caller), so the partial unique index cannot collide on prod. It
-- turns recordReferralCommission's select-then-insert into a race-safe
-- upsert (23505 = already recorded).
CREATE UNIQUE INDEX IF NOT EXISTS referral_earnings_one_commission_per_order
  ON public.referral_earnings (order_id)
  WHERE type = 'purchase_commission' AND order_id IS NOT NULL;

-- ── Test helper: cleanup of a withdrawal request's journals ────────────────
-- withdrawal_debit/payout/reversal key on the request id, which the
-- ledger_test_cleanup prefix rail (test:ledger:%) refuses. Same shape as
-- ledger_test_cleanup_by_order. Service-role only.
CREATE OR REPLACE FUNCTION public.ledger_test_cleanup_by_withdrawal(p_request_id uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  v_keys  TEXT[] := ARRAY['withdrawal:' || p_request_id::text, 'withdrawal_reversal:' || p_request_id::text, 'payout:' || p_request_id::text];
BEGIN
  ALTER TABLE ledger_entries      DISABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions DISABLE TRIGGER trg_ledger_transactions_immutable;
  DELETE FROM ledger_entries
   WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE idempotency_key = ANY (v_keys));
  DELETE FROM ledger_transactions WHERE idempotency_key = ANY (v_keys);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE ledger_entries      ENABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions ENABLE TRIGGER trg_ledger_transactions_immutable;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.ledger_test_cleanup_by_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_test_cleanup_by_withdrawal(uuid) TO service_role;

-- ── DB-015d: a FAILED webhook event can be claimed again ────────────────────
-- webhook_event_claim deduped on (provider, provider_event_id) regardless of
-- status, so once dispatch had failed (and the router answered 500 so the
-- provider would retry) the retry was deduped and the event stayed 'failed'
-- forever — the "replay worker (Phase 6)" it counted on does not exist. The
-- provider's own retry IS the replay: a row in 'failed' is re-claimed (back
-- to 'received'); 'received' (in flight) and 'processed' still dedupe. Every
-- transition the dispatch runs is idempotent, so a re-run converges.
CREATE OR REPLACE FUNCTION "public"."webhook_event_claim"("p_provider" "text", "p_provider_event_id" "text", "p_payload_hash" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_claimed UUID;
BEGIN
  INSERT INTO webhook_events (provider, provider_event_id, payload_hash)
  VALUES (p_provider, p_provider_event_id, p_payload_hash)
  ON CONFLICT (provider, provider_event_id) DO UPDATE
    SET status = 'received', result = NULL, payload_hash = COALESCE(EXCLUDED.payload_hash, webhook_events.payload_hash)
    WHERE webhook_events.status = 'failed'
  RETURNING id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;  -- TRUE = freshly claimed (new or re-run of a failed one); FALSE = duplicate
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_event_claim(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_event_claim(text, text, text) TO service_role;
COMMENT ON FUNCTION public.webhook_event_claim(text, text, text) IS
  'Webhook dedupe claim. TRUE for a new event or for one whose previous run ended failed (provider retry = replay); FALSE for received/processed. Service-role only.';
