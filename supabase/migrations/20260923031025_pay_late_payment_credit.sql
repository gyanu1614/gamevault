-- ============================================================================
-- Checkout fix round B, Part 3 — late-payment and overpayment credit
-- (PAY-009 / PAY-011). Idempotent: safe to re-run.
--
-- Money that arrives for a charge we no longer want — the buyer paid a
-- voucher after the order was cancelled, an invoice the retry had already
-- superseded, a second charge on an order that was paid by the first — used
-- to raise out of order_confirm_payment, mark the webhook failed, page ten
-- admins on every provider retry (up to 7 times) and then sit in a dead-end
-- until someone refunded by hand (PAY-009). An overpayment was silently kept
-- (PAY-011). Both are now the SYSTEM's problem, in one RPC:
--
--   order_credit_late_payment(provider, charge, event, amount, currency, reason)
--     · credits the buyer's wallet (provider_float → user_wallet)
--     · idempotent on reason:provider:charge:event (a provider retry, a
--       reconciler re-run or a replay credits nothing)
--     · records the credit on the attempt (credited_minor, credit_reason)
--     · notifies the buyer once ("Money In Your Wallet") and admins once
--     · NEVER re-opens the order
--
-- order_confirm_payment learns the amounts (p_amount_minor = what the charge
-- asked for, p_paid_minor = what was actually paid, when the provider says)
-- and routes: a closed attempt → late credit of the full payment; a
-- terminal or already-paid order → late credit; a normal confirmation whose
-- paid amount exceeds the charge → confirm, then credit the excess with
-- reason 'overpayment' — all in the confirm transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.late_payment_credit_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.late_payment_credit_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.late_payment_credit_version() TO service_role;

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS credited_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_reason  text;
COMMENT ON COLUMN public.payment_attempts.credited_minor IS 'Round B Part 3: minor units credited to the buyer wallet for money that arrived on this charge and was not (or not fully) the order''s: late_payment (closed attempt / closed or already-paid order) or overpayment (excess over amount_minor).';
COMMENT ON COLUMN public.payment_attempts.credit_reason  IS 'Round B Part 3: late_payment | overpayment — the last reason credited_minor grew.';

-- ── 1. order_credit_late_payment ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_credit_late_payment(
  p_provider text, p_provider_charge_id text, p_event_id text,
  p_amount_minor bigint, p_currency text, p_reason text, p_order_id uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attempt_id  uuid;
  v_order_id    uuid;
  v_order       RECORD;
  v_currency    char(3);
  v_key         text;
  v_existing    uuid;
  v_txn         uuid;
  v_reason_text text;
  v_amount_text text;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_reason NOT IN ('late_payment', 'overpayment') THEN
    RAISE EXCEPTION 'order_credit_late_payment: reason must be late_payment|overpayment, got %', p_reason USING ERRCODE = 'check_violation';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'nothing_to_credit', 'credited_minor', 0);
  END IF;
  IF p_provider IS NULL OR p_provider_charge_id IS NULL THEN
    RAISE EXCEPTION 'order_credit_late_payment: provider and charge id are required' USING ERRCODE = 'check_violation';
  END IF;

  -- The charge names its attempt, the attempt its order; a legacy charge
  -- with no attempt row falls back to the order the caller resolved.
  SELECT id, order_id INTO v_attempt_id, v_order_id FROM payment_attempts
   WHERE provider = p_provider AND provider_charge_id = p_provider_charge_id;
  v_order_id := COALESCE(v_order_id, p_order_id);
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_credit_late_payment: charge %/% belongs to no known order', p_provider, p_provider_charge_id USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_credit_late_payment: order % not found', v_order_id USING ERRCODE = 'no_data_found';
  END IF;
  v_currency := UPPER(COALESCE(p_currency, v_order.currency, 'USD'))::char(3);
  IF v_order.currency IS NOT NULL AND UPPER(v_order.currency) <> v_currency THEN
    RAISE EXCEPTION 'order_credit_late_payment: currency % does not match order % (%)', v_currency, v_order_id, v_order.currency USING ERRCODE = 'check_violation';
  END IF;

  -- Idempotent on the reason + charge + provider event.
  v_key := p_reason || ':' || p_provider || ':' || p_provider_charge_id || ':' || COALESCE(p_event_id, 'no-event');
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('changed', false, 'order_id', v_order_id, 'buyer_id', v_order.buyer_id,
                              'wallet_txn_id', v_existing, 'credited_minor', 0, 'reason', 'already_credited');
  END IF;

  -- The provider holds the cash; the buyer gets it as store credit.
  v_txn := post_journal(
    v_key,
    jsonb_build_array(
      jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',p_amount_minor,'currency',v_currency),
      jsonb_build_object('owner_type','buyer','owner_id',v_order.buyer_id::text,'kind','user_wallet','direction','credit','amount_minor',p_amount_minor,'currency',v_currency)
    ),
    'LATE_PAYMENT_CREDIT', v_order_id);

  PERFORM money_fault_hook('order_credit_late_payment:after_journal');

  IF v_attempt_id IS NOT NULL THEN
    UPDATE payment_attempts
       SET credited_minor = credited_minor + p_amount_minor, credit_reason = p_reason
     WHERE id = v_attempt_id;
  END IF;

  v_amount_text := '$' || to_char(p_amount_minor / 100.0, 'FM999999990.00');
  v_reason_text := CASE p_reason
    WHEN 'overpayment' THEN 'you paid more than the order total'
    ELSE 'the payment arrived after the order closed' END;
  -- Buyer: once — this insert only runs when the journal was new.
  INSERT INTO notifications (user_id, type, title, message, link, is_read)
  VALUES (v_order.buyer_id, 'late_payment_credit', 'Money In Your Wallet',
          v_amount_text || ' store credit added · #' || COALESCE(v_order.order_number, UPPER(LEFT(v_order_id::text, 8))) ||
            ' — ' || v_reason_text || '. Spend it instantly or withdraw it.',
          '/account/wallet', false);
  -- Admins: one informational note per order (deduped on title + link).
  PERFORM admin_alert_once(
    'payment_review',
    'Late Payment Credited',
    'Charge ' || p_provider || '/' || p_provider_charge_id || ' paid ' || v_amount_text || ' on order ' ||
      COALESCE(v_order.order_number, UPPER(LEFT(v_order_id::text, 8))) || ' (' || v_order.status || ') — ' ||
      v_reason_text || '. Credited to the buyer wallet automatically; nothing to do unless the provider needs a manual close.',
    '/account/orders/' || v_order_id::text);

  RETURN jsonb_build_object('changed', true, 'order_id', v_order_id, 'buyer_id', v_order.buyer_id,
                            'wallet_txn_id', v_txn, 'credited_minor', p_amount_minor, 'reason', p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.order_credit_late_payment(text, text, text, bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_credit_late_payment(text, text, text, bigint, text, text, uuid) TO service_role;
COMMENT ON FUNCTION public.order_credit_late_payment(text, text, text, bigint, text, text, uuid) IS
  'Round B Part 3 (PAY-009/011): credit the buyer wallet (provider_float → user_wallet) for money that arrived on a charge the order no longer wanted (late_payment) or above the charge (overpayment). Idempotent on reason:provider:charge:event; records on the attempt; buyer notified once, admins once; never touches the order status. Service-role only.';

-- ── 2. order_confirm_payment — amounts + the late / duplicate / overpay routes
DROP FUNCTION IF EXISTS public.order_confirm_payment(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.order_confirm_payment(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL,
  p_amount_minor bigint DEFAULT NULL, p_paid_minor bigint DEFAULT NULL, p_currency text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order            RECORD;
  v_attempt_id       uuid := NULL;
  v_attempt_order_id uuid := NULL;
  v_attempt_status   text := NULL;
  v_attempt_amount   bigint := NULL;
  v_paid             bigint := COALESCE(p_paid_minor, p_amount_minor);
  v_credit           JSONB;
  v_listing          RECORD;
  v_transition       JSONB;
  v_refund           JSONB;
  v_ok               BOOLEAN := TRUE;
  v_reason           TEXT := NULL;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_confirm_payment: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 0. The charge that pays must be THIS order's (round B Part 1).
  IF p_provider IS NOT NULL AND p_provider_charge_id IS NOT NULL THEN
    SELECT id, order_id, status, amount_minor INTO v_attempt_id, v_attempt_order_id, v_attempt_status, v_attempt_amount
      FROM payment_attempts
     WHERE provider = p_provider AND provider_charge_id = p_provider_charge_id FOR UPDATE;
    IF v_attempt_id IS NOT NULL AND v_attempt_order_id <> p_order_id THEN
      RAISE EXCEPTION 'order_confirm_payment: charge %/% is bound to order %, not %',
        p_provider, p_provider_charge_id, v_attempt_order_id, p_order_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 0b. Money we no longer wanted (Part 3): the charge's attempt is closed
  --     (superseded by a retry, voided, provider-failed), or the order is
  --     terminal / already paid by another charge. Credit the buyer's
  --     wallet with what they paid; the order is never re-opened.
  IF p_provider_charge_id IS NOT NULL AND v_paid IS NOT NULL AND (
       (v_attempt_id IS NOT NULL AND v_attempt_status IN ('superseded', 'void', 'failed'))
    OR (v_order.status IN ('cancelled', 'refunded'))
    OR (v_order.status <> 'pending' AND (v_attempt_id IS NULL OR v_attempt_status <> 'paid'))
  ) THEN
    v_credit := order_credit_late_payment(p_provider, p_provider_charge_id, p_dedupe_key, v_paid, p_currency, 'late_payment', p_order_id);
    RETURN jsonb_build_object(
      'order_id', p_order_id, 'status', v_order.status, 'escrow_status', v_order.escrow_status,
      'changed', false, 'outcome', 'late_credited',
      'credit_changed', v_credit->'changed', 'credited_minor', v_credit->'credited_minor',
      'wallet_txn_id', v_credit->'wallet_txn_id', 'attempt_id', v_attempt_id);
  END IF;

  -- 1. pending → paid (no-op when already paid; raises on a terminal order).
  v_transition := safedrop_transition(p_order_id, 'CHARGE_CONFIRMED', p_dedupe_key, NULL, NULL);
  IF NOT COALESCE((v_transition->>'changed')::boolean, false) THEN
    RETURN v_transition || jsonb_build_object('outcome', 'noop');
  END IF;

  -- 2. The delivery SLA starts at PAYMENT; first stamp wins.
  UPDATE orders SET paid_at = COALESCE(paid_at, NOW()) WHERE id = p_order_id;

  PERFORM money_fault_hook('order_confirm_payment:after_transition');

  -- 2b. Close the attempt as paid.
  IF v_attempt_id IS NOT NULL THEN
    UPDATE payment_attempts
       SET status = 'paid', paid_event_id = p_dedupe_key, closed_at = now(), close_reason = 'paid'
     WHERE id = v_attempt_id;
  ELSE
    UPDATE payment_attempts
       SET status = 'paid', paid_event_id = p_dedupe_key, closed_at = now(), close_reason = 'paid'
     WHERE order_id = p_order_id AND status IN ('created', 'active');
  END IF;

  -- 3. Claim the stock under the listing row lock (PAY-003).
  IF v_order.stock_claimed_at IS NULL THEN
    SELECT id, is_unlimited, quantity, status INTO v_listing
      FROM listings WHERE id = v_order.listing_id FOR UPDATE;
    IF NOT FOUND THEN
      v_ok := FALSE; v_reason := 'listing_missing';
    ELSIF COALESCE(v_listing.is_unlimited, false) THEN
      v_ok := TRUE;
    ELSIF COALESCE(v_listing.quantity, 0) >= v_order.quantity THEN
      UPDATE listings
         SET quantity = quantity - v_order.quantity,
             status   = CASE WHEN status = 'active' AND quantity - v_order.quantity <= 0 THEN 'sold' ELSE status END
       WHERE id = v_listing.id;
    ELSE
      v_ok := FALSE; v_reason := 'insufficient_stock';
    END IF;
    IF v_ok THEN
      UPDATE orders SET stock_claimed_at = NOW() WHERE id = p_order_id;
    END IF;
  END IF;

  PERFORM money_fault_hook('order_confirm_payment:after_stock');

  -- 4. Oversold: refund to the wallet NOW, in this transaction.
  IF NOT v_ok THEN
    v_refund := order_refund_to_wallet(p_order_id, 'oversold', NULL);
    RETURN v_transition || jsonb_build_object(
      'outcome', 'oversold_refunded',
      'reason', v_reason,
      'status', v_refund->>'status',
      'escrow_status', v_refund->>'escrow_status',
      'wallet_txn_id', v_refund->'wallet_txn_id',
      'credited_minor', v_refund->'credited_minor');
  END IF;

  -- 5. Overpayment (PAY-011): the buyer paid more than the charge asked for
  --    → the excess is theirs, as wallet credit, keyed on this event.
  IF v_attempt_id IS NOT NULL AND p_paid_minor IS NOT NULL AND v_attempt_amount IS NOT NULL
     AND p_paid_minor > v_attempt_amount THEN
    v_credit := order_credit_late_payment(p_provider, p_provider_charge_id, p_dedupe_key,
                                          p_paid_minor - v_attempt_amount, p_currency, 'overpayment', p_order_id);
  END IF;

  RETURN v_transition || jsonb_build_object('outcome', 'paid', 'stock_claimed', v_order.stock_claimed_at IS NULL,
                                            'attempt_id', v_attempt_id,
                                            'overpaid_minor', COALESCE(v_credit->'credited_minor', '0'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.order_confirm_payment(uuid, text, text, text, bigint, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_confirm_payment(uuid, text, text, text, bigint, bigint, text) TO service_role;
COMMENT ON FUNCTION public.order_confirm_payment(uuid, text, text, text, bigint, bigint, text) IS
  'Money layer (PAY-003 + round B): CHARGE_CONFIRMED + paid_at + row-locked stock claim in one transaction; the (provider, charge id) must be bound to this order and its attempt is closed as paid. A payment on a closed attempt / closed or already-paid order is credited to the buyer wallet instead (outcome late_credited); paid above the charge credits the excess (overpayment). Sold out → refunded to the wallet in the same transaction. Idempotent. Service-role only.';
