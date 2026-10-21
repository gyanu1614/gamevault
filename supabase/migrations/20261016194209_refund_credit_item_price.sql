-- Refund rule (owner 2026-10-16; docs/payments/refund-fee-research-2026-10-16.md,
-- docs/superpowers/plans/2026-10-16-not-delivered-cancel-and-refund-rule.md, PR 1).
--
-- Every policy refund now credits the ITEM price (subtotal − promo) as store
-- credit — spent at checkout with no service fee it buys the same item again —
-- and the buyer's fees move refunds → platform_commission ('fee_kept:<order>'),
-- for EVERY fault (buyer, seller, platform). Explicit provider amounts are
-- unchanged.
--
-- A refund to the original payment method (requested from the Wallet or the
-- order page) pays the FULL amount: the store credit (user_wallet →
-- provider_float) + the kept fee (platform_commission → provider_float,
-- 'refund_to_source_fee:<request>'). A failed send reverses both legs.
--
-- The 5-in-7-days seller fee: the fault record now stores fee_due_minor; the
-- fee is charged (order_seller_fault_charge) only when the buyer's card refund
-- is SENT — the only time we pay the buyer's fees back. Seller Agreement 11.1:
-- recoveries are limited to what we actually incur.
--
-- Also: 'not_delivered' fault source (PR 2's "Cancel – Not Delivered"),
-- refund_to_source_quotes for the Wallet list, and crypto rails marked
-- refundable = false (BTCPay has no refund API; CoinGate is off).
--
-- No signature changes: every function keeps its arguments, so the live build
-- keeps working through deploy.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.order_seller_faults
  ADD COLUMN IF NOT EXISTS fee_due_minor bigint NOT NULL DEFAULT 0 CHECK (fee_due_minor >= 0);
COMMENT ON COLUMN public.order_seller_faults.fee_due_minor IS
  'Buyer fees this fault would charge the seller (threshold reached). Posted by order_seller_fault_charge only when the buyer''s card refund is sent.';
ALTER TABLE public.order_seller_faults DROP CONSTRAINT IF EXISTS order_seller_faults_source_check;
ALTER TABLE public.order_seller_faults ADD CONSTRAINT order_seller_faults_source_check
  CHECK (source IN ('seller_cancel', 'admin_cancel', 'dispute', 'not_delivered'));

ALTER TABLE public.refund_to_source_requests
  ADD COLUMN IF NOT EXISTS fee_minor bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0);
COMMENT ON COLUMN public.refund_to_source_requests.fee_minor IS
  'Part of amount_minor paid from platform_commission (the kept service fee); amount_minor − fee_minor comes out of the buyer''s store credit.';

-- ── 2. Fault record: count + fee_due, no charge here ─────────────────────────
-- Body from 20260930005449 §2; changes: 'not_delivered' accepted, and the
-- threshold branch stores fee_due_minor instead of posting the journal.
CREATE OR REPLACE FUNCTION public.order_seller_fault_record(p_order_id uuid, p_source text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        RECORD;
  v_s        RECORD;
  v_existing RECORD;
  v_count    integer;
  v_fee      bigint;
BEGIN
  IF p_source NOT IN ('seller_cancel', 'admin_cancel', 'dispute', 'not_delivered') THEN
    RAISE EXCEPTION 'order_seller_fault_record: source must be seller_cancel|admin_cancel|dispute|not_delivered, got %', p_source USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_o.seller_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'fee_charged_minor', 0, 'fee_due_minor', 0);
  END IF;
  SELECT * INTO v_existing FROM order_seller_faults WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('recorded', false, 'fee_charged_minor', v_existing.fee_charged_minor, 'fee_due_minor', v_existing.fee_due_minor, 'fee_txn_id', v_existing.fee_txn_id);
  END IF;
  SELECT * INTO v_s FROM platform_fee_settings WHERE id;
  -- Serialise the count per seller: two faults landing together must not
  -- both read "4" and both skip the fee.
  PERFORM pg_advisory_xact_lock(hashtextextended('seller_fault:' || v_o.seller_id::text, 0));
  INSERT INTO order_seller_faults (order_id, seller_id, source) VALUES (p_order_id, v_o.seller_id, p_source);
  SELECT COUNT(*) INTO v_count FROM order_seller_faults
   WHERE seller_id = v_o.seller_id
     AND occurred_at > now() - make_interval(days => v_s.seller_fault_fee_window_days);
  v_fee := ROUND((COALESCE(v_o.platform_fee, 0) + COALESCE(v_o.payment_processing_fee, 0)) * 100)::bigint;

  PERFORM money_fault_hook('order_seller_fault_record:after_insert');

  -- Threshold reached: the fee is DUE, charged only when the buyer's card
  -- refund is sent (order_seller_fault_charge). A store-credit refund keeps
  -- the buyer's fees with the platform already.
  IF v_count >= v_s.seller_fault_fee_threshold AND v_fee > 0 THEN
    UPDATE order_seller_faults SET fee_due_minor = v_fee WHERE order_id = p_order_id;
  ELSE
    v_fee := 0;
  END IF;
  RETURN jsonb_build_object('recorded', true, 'count_in_window', v_count, 'fee_due_minor', v_fee, 'fee_charged_minor', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.order_seller_fault_record(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_seller_fault_record(uuid, text) TO service_role;
COMMENT ON FUNCTION public.order_seller_fault_record(uuid, text) IS
  'Records a seller fault for an order; from the threshold-th fault in the rolling window stores fee_due_minor (the order''s buyer fees), charged by order_seller_fault_charge when a card refund is sent. Idempotent per order. Service-role only.';

-- ── 3. Charge a due seller fee (the card refund was sent) ────────────────────
CREATE OR REPLACE FUNCTION public.order_seller_fault_charge(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_f   RECORD;
  v_o   RECORD;
  v_s   RECORD;
  v_txn uuid;
  v_cur char(3);
  v_n   integer;
BEGIN
  SELECT * INTO v_f FROM order_seller_faults WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_f.fee_due_minor <= 0 OR v_f.fee_txn_id IS NOT NULL THEN
    RETURN jsonb_build_object('charged', false, 'fee_charged_minor', COALESCE(v_f.fee_charged_minor, 0));
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  SELECT * INTO v_s FROM platform_fee_settings WHERE id;
  v_cur := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  v_txn := post_journal('seller_fault_fee:' || p_order_id::text, jsonb_build_array(
    jsonb_build_object('owner_type','seller','owner_id',v_f.seller_id::text,'kind','seller_available','direction','debit','amount_minor',v_f.fee_due_minor,'currency',v_cur),
    jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_f.fee_due_minor,'currency',v_cur)),
    'SELLER_FAULT_FEE', p_order_id);

  PERFORM money_fault_hook('order_seller_fault_charge:after_journal');

  UPDATE order_seller_faults SET fee_charged_minor = v_f.fee_due_minor, fee_txn_id = v_txn WHERE order_id = p_order_id;
  -- Legacy read-model, kept in step the way safedrop_transition does.
  UPDATE profiles SET seller_balance = COALESCE(seller_balance, 0) - (v_f.fee_due_minor::numeric / 100) WHERE id = v_f.seller_id;
  SELECT COUNT(*) INTO v_n FROM order_seller_faults
   WHERE seller_id = v_f.seller_id
     AND occurred_at > v_f.occurred_at - make_interval(days => v_s.seller_fault_fee_window_days)
     AND occurred_at <= v_f.occurred_at;
  PERFORM notify_once(v_f.seller_id, 'seller_fault_fee', 'Non-Delivery Fee Applied',
    'This was cancelled order number ' || v_n || ' on your account in ' || v_s.seller_fault_fee_window_days ||
    ' days, and the buyer took the refund to their payment method. The buyer''s fees on order #' ||
    COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8))) ||
    ' ($' || to_char(v_f.fee_due_minor::numeric / 100, 'FM999999990.00') || ') were charged to your balance.',
    '/account/orders/' || p_order_id::text, 'seller_fault_fee:' || p_order_id::text);
  RETURN jsonb_build_object('charged', true, 'fee_charged_minor', v_f.fee_due_minor, 'fee_txn_id', v_txn);
END;
$$;
REVOKE ALL ON FUNCTION public.order_seller_fault_charge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_seller_fault_charge(uuid) TO service_role;
COMMENT ON FUNCTION public.order_seller_fault_charge(uuid) IS
  'Posts a due seller-fault fee (seller_available → platform_commission, seller_fault_fee:<order>) once; called when the buyer''s card refund for that order is sent. Idempotent. Service-role only.';

-- ── 4. The buyer credit leg: the item price for every fault ─────────────────
-- Body from 20260930005449 §3; changes: the policy credit is the item price for
-- every fault, the remainder is kept for every fault, not_delivered:% keys map
-- to the not_delivered source, and fault_fee_due_minor is returned.
CREATE OR REPLACE FUNCTION public.order_refund_buyer_credit(
  p_order_id uuid, p_fault text, p_amount_minor bigint, p_dedupe_key text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o          RECORD;
  v_cur        char(3);
  v_total      bigint;
  v_item       bigint;
  v_policy     boolean;
  v_credit     bigint;
  v_kept       bigint := 0;
  v_wallet_txn uuid;
  v_kept_txn   uuid;
  v_fault      jsonb := NULL;
  v_source     text;
BEGIN
  IF p_fault IS NULL OR p_fault NOT IN ('buyer', 'seller', 'platform') THEN
    RAISE EXCEPTION 'order_refund_buyer_credit: p_fault must be buyer|seller|platform, got %', COALESCE(p_fault, '<null>') USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  v_cur   := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  v_total := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_item  := GREATEST(ROUND((COALESCE(v_o.subtotal, 0) - COALESCE(v_o.promo_discount, 0)) * 100)::bigint, 0);
  -- Policy refund (no explicit provider amount): the item price, every fault.
  v_policy := NOT (p_amount_minor IS NOT NULL AND p_amount_minor > 0 AND p_amount_minor < v_total);
  v_credit := CASE WHEN v_policy THEN LEAST(v_item, v_total) ELSE p_amount_minor END;

  IF v_o.buyer_id IS NOT NULL AND v_credit > 0 THEN
    v_wallet_txn := wallet_credit(v_o.buyer_id, v_credit, v_cur, 'refunds',
                                  'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
  END IF;

  PERFORM money_fault_hook('order_refund_buyer_credit:after_credit');

  -- The fees: kept on every policy refund (a card refund pays them back);
  -- an explicit amount keeps the old rule (only a buyer fault keeps the rest).
  v_kept := v_total - v_credit;
  IF v_kept > 0 AND (v_policy OR p_fault = 'buyer') THEN
    v_kept_txn := post_journal('fee_kept:' || p_order_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','debit','amount_minor',v_kept,'currency',v_cur),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_kept,'currency',v_cur)),
      'BUYER_FEE_KEPT', p_order_id);
  ELSE
    v_kept := 0;
  END IF;

  IF p_fault = 'seller' THEN
    v_source := CASE
      WHEN p_dedupe_key LIKE 'dispute:%' THEN 'dispute'
      WHEN p_dedupe_key LIKE 'cancel_request:%' THEN 'admin_cancel'
      WHEN p_dedupe_key LIKE 'not_delivered:%' THEN 'not_delivered'
      ELSE 'seller_cancel' END;
    v_fault := order_seller_fault_record(p_order_id, v_source);
  END IF;

  RETURN jsonb_build_object(
    'wallet_txn_id', v_wallet_txn, 'credited_minor', v_credit, 'fault', p_fault,
    'fee_kept_minor', v_kept, 'fee_kept_txn_id', v_kept_txn,
    'fault_fee_minor', COALESCE((v_fault->>'fee_charged_minor')::bigint, 0),
    'fault_fee_due_minor', COALESCE((v_fault->>'fee_due_minor')::bigint, 0),
    'fault_count_in_window', (v_fault->>'count_in_window')::integer);
END;
$$;
REVOKE ALL ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) TO service_role;
COMMENT ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) IS
  'Internal leg of the refund seams: buyer store credit = the item price on every policy refund, the fees kept → platform_commission (fee_kept:<order>; a card refund pays them back); seller fault → fault record. Service-role only.';

-- ── 5. request: the full amount = store credit + kept fee ───────────────────
-- Body from 20260930010758 §3; changes: the kept fee is added to amount_minor
-- and stored in fee_minor; the unspent check stays on the store credit only.
CREATE OR REPLACE FUNCTION public.refund_to_source_request(p_order_id uuid, p_buyer_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        RECORD;
  v_att      RECORD;
  v_fee      RECORD;
  v_txn      uuid;
  v_credited bigint;
  v_kept     bigint := 0;
  v_cur      char(3);
  v_balance  bigint;
  v_existing RECORD;
  v_id       uuid;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_o.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  SELECT * INTO v_existing FROM refund_to_source_requests WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exists', 'request_id', v_existing.id, 'status', v_existing.status);
  END IF;
  IF v_o.status NOT IN ('refunded', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_refunded');
  END IF;
  v_cur := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  -- What the refund seam credited: the user_wallet credit on wallet_refund:<order>.
  SELECT lt.id INTO v_txn FROM ledger_transactions lt WHERE lt.idempotency_key = 'wallet_refund:' || p_order_id::text;
  IF v_txn IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_refunded');
  END IF;
  SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_credited
    FROM ledger_entries le JOIN ledger_accounts la ON la.id = le.account_id
   WHERE le.transaction_id = v_txn AND la.kind = 'user_wallet' AND le.direction = 'credit'
     AND la.owner_id = p_buyer_id;
  IF v_credited <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_refunded');
  END IF;
  -- The service fee the refund kept (fee_kept:<order>) goes back too: a card
  -- refund is the full amount paid. Capped at the order's fee part.
  SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_kept
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    JOIN ledger_accounts la ON la.id = le.account_id
   WHERE lt.idempotency_key = 'fee_kept:' || p_order_id::text
     AND la.kind = 'platform_commission' AND le.direction = 'credit';
  v_kept := LEAST(v_kept, GREATEST(ROUND((COALESCE(v_o.total_amount, 0) - (COALESCE(v_o.subtotal, 0) - COALESCE(v_o.promo_discount, 0))) * 100)::bigint, 0));
  -- The charge that was paid, and whether its rail refunds provider-side.
  SELECT provider, provider_charge_id, pm_id INTO v_att
    FROM payment_attempts
   WHERE order_id = p_order_id AND status = 'paid' AND provider_charge_id IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_provider_charge');
  END IF;
  SELECT refundable INTO v_fee FROM payment_method_fees WHERE method = COALESCE(v_att.pm_id, v_att.provider);
  IF NOT FOUND OR v_fee.refundable IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_refundable');
  END IF;
  -- The credit must still be there to send back.
  v_balance := COALESCE(user_wallet_balance(p_buyer_id, v_cur), 0);
  IF v_balance < v_credited THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'credit_spent', 'balance_minor', v_balance, 'amount_minor', v_credited);
  END IF;
  INSERT INTO refund_to_source_requests (order_id, buyer_id, amount_minor, fee_minor, currency, provider, provider_charge_id)
  VALUES (p_order_id, p_buyer_id, v_credited + v_kept, v_kept, v_cur, v_att.provider, v_att.provider_charge_id)
  RETURNING id INTO v_id;
  PERFORM notify_once(p_buyer_id, 'refund_to_source', 'Refund Request Received',
    'We received your request to refund $' || to_char((v_credited + v_kept)::numeric / 100, 'FM999999990.00') ||
    ' for order #' || COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8))) ||
    ' to your original payment method. Support reviews it within 24 to 48 hours; the store credit stays in your Store Balance until then.',
    '/account/orders/' || p_order_id::text, 'refund_to_source:' || v_id::text || ':received');
  RETURN jsonb_build_object('ok', true, 'request_id', v_id, 'amount_minor', v_credited + v_kept,
                            'credit_minor', v_credited, 'fee_minor', v_kept, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_request(uuid, uuid) TO service_role;

-- ── 6. approve: store credit + kept fee, one transaction ─────────────────────
-- Body from 20260930010758 §4; changes: the wallet spend is the store-credit
-- part, the kept fee is paid platform_commission → provider_float, the outbox
-- row carries the full amount (unchanged call).
CREATE OR REPLACE FUNCTION public.refund_to_source_approve(p_request_id uuid, p_admin_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r       RECORD;
  v_o       RECORD;
  v_balance bigint;
  v_txn     uuid;
  v_outbox  uuid;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_r FROM refund_to_source_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'not_found');
  END IF;
  IF v_r.status <> 'pending' THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'not_pending', 'status', v_r.status);
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = v_r.order_id FOR UPDATE;
  v_balance := COALESCE(user_wallet_balance(v_r.buyer_id, v_r.currency), 0);
  IF v_balance < (v_r.amount_minor - v_r.fee_minor) THEN
    UPDATE refund_to_source_requests SET status = 'rejected', admin_id = p_admin_id, decided_at = now(),
           admin_notes = COALESCE(admin_notes, 'The store credit was spent before approval.') WHERE id = p_request_id;
    RETURN jsonb_build_object('approved', false, 'reason', 'credit_spent', 'balance_minor', v_balance);
  END IF;
  -- The credit leaves the buyer's wallet; the cash leaves our provider float
  -- once the drain sends it. wallet_spend is idempotent on its key.
  v_txn := wallet_spend(v_r.buyer_id, v_r.amount_minor - v_r.fee_minor, v_r.currency, 'provider_float',
                        'refund_to_source:' || p_request_id::text, 'REFUND_TO_SOURCE', v_r.order_id);
  -- The kept service fee goes back with it, from the platform's side.
  IF v_r.fee_minor > 0 THEN
    PERFORM post_journal('refund_to_source_fee:' || p_request_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_r.fee_minor,'currency',v_r.currency),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','provider_float','direction','credit','amount_minor',v_r.fee_minor,'currency',v_r.currency)),
      'REFUND_TO_SOURCE_FEE', v_r.order_id);
  END IF;
  PERFORM money_fault_hook('refund_to_source_approve:after_spend');
  PERFORM money_fault_hook('refund_to_source_approve:after_fee');
  v_outbox := provider_refund_outbox_enqueue(p_request_id, v_r.order_id, v_r.provider, v_r.provider_charge_id, v_r.amount_minor, v_r.currency);
  UPDATE refund_to_source_requests
     SET status = 'approved', admin_id = p_admin_id, decided_at = now(), outbox_id = v_outbox
   WHERE id = p_request_id;
  PERFORM notify_once(v_r.buyer_id, 'refund_to_source', 'Refund Approved',
    'Your refund of $' || to_char(v_r.amount_minor::numeric / 100, 'FM999999990.00') || ' for order #' ||
    COALESCE(v_o.order_number, UPPER(LEFT(v_r.order_id::text, 8))) ||
    ' is on its way to your original payment method. It usually arrives within 5 to 10 business days.',
    '/account/orders/' || v_r.order_id::text, 'refund_to_source:' || p_request_id::text || ':approved');
  RETURN jsonb_build_object('approved', true, 'request_id', p_request_id, 'outbox_id', v_outbox, 'ledger_txn_id', v_txn, 'order_id', v_r.order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_approve(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_approve(uuid, uuid) TO service_role;

-- ── 7. fail: reverse both legs ───────────────────────────────────────────────
-- Body from 20260930010758 §4; changes: the store credit comes back to the
-- wallet, the kept fee back to platform_commission.
CREATE OR REPLACE FUNCTION public.refund_to_source_fail(p_request_id uuid, p_error text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r       RECORD;
  v_txn     uuid;
  v_alerted integer := 0;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_r FROM refund_to_source_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('failed', false, 'reason', 'not_found');
  END IF;
  IF v_r.status <> 'approved' THEN
    RETURN jsonb_build_object('failed', false, 'reason', 'not_approved', 'status', v_r.status);
  END IF;
  v_txn := wallet_credit(v_r.buyer_id, v_r.amount_minor - v_r.fee_minor, v_r.currency, 'provider_float',
                         'refund_to_source_reversal:' || p_request_id::text, 'REFUND_TO_SOURCE_REVERSED', v_r.order_id);
  IF v_r.fee_minor > 0 THEN
    PERFORM post_journal('refund_to_source_fee_reversal:' || p_request_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',v_r.fee_minor,'currency',v_r.currency),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_r.fee_minor,'currency',v_r.currency)),
      'REFUND_TO_SOURCE_FEE_REVERSED', v_r.order_id);
  END IF;
  PERFORM money_fault_hook('refund_to_source_fail:after_reversal');
  UPDATE refund_to_source_requests
     SET status = 'failed', failure_reason = LEFT(COALESCE(p_error, 'provider refund failed'), 500)
   WHERE id = p_request_id;
  v_alerted := admin_alert_once(
    'payment_review',
    'Refund To Source Failed',
    'Refund request ' || UPPER(LEFT(p_request_id::text, 8)) || ' (' || v_r.provider || '/' || v_r.provider_charge_id ||
      ', $' || to_char(v_r.amount_minor::numeric / 100, 'FM999999990.00') || ') could not be sent after every retry (' ||
      COALESCE(LEFT(p_error, 160), 'no detail') || '). The store credit was returned to the buyer. Refund by hand in the provider dashboard if needed.',
    '/account/orders/' || v_r.order_id::text);
  PERFORM notify_once(v_r.buyer_id, 'refund_to_source', 'Refund Could Not Be Sent',
    'We could not send your refund back to your payment method. Your store credit is back in your Store Balance; support will follow up.',
    '/account/orders/' || v_r.order_id::text, 'refund_to_source:' || p_request_id::text || ':failed');
  RETURN jsonb_build_object('failed', true, 'request_id', p_request_id, 'ledger_txn_id', v_txn, 'alerted', v_alerted);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_fail(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_fail(uuid, text) TO service_role;

-- ── 8. mark: a SENT card refund charges a due seller-fault fee ──────────────
-- Body from 20260930010758 §5; change: one call in the refund-ok branch.
CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_mark(p_id uuid, p_ok boolean, p_outcome text, p_error text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_max_attempts CONSTANT integer := 6;
  v_row     provider_cancel_outbox%ROWTYPE;
  v_alerted integer := 0;
  v_fail    jsonb;
BEGIN
  SELECT * INTO v_row FROM provider_cancel_outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider_cancel_outbox_mark: row % not found', p_id USING ERRCODE = 'no_data_found';
  END IF;
  IF p_ok THEN
    UPDATE provider_cancel_outbox
       SET status = 'done', outcome = p_outcome, last_error = NULL, done_at = now()
     WHERE id = p_id;
    IF v_row.kind = 'refund' AND v_row.request_id IS NOT NULL THEN
      UPDATE refund_to_source_requests
         SET status = 'sent', provider_refund_id = p_outcome, sent_at = now()
       WHERE id = v_row.request_id AND status = 'approved';
      -- The buyer's fees went back to them: a due seller-fault fee is charged now.
      IF FOUND AND v_row.order_id IS NOT NULL THEN
        PERFORM order_seller_fault_charge(v_row.order_id);
      END IF;
    END IF;
    RETURN jsonb_build_object('id', p_id, 'status', 'done', 'attempts', v_row.attempts, 'alerted', 0);
  END IF;
  IF v_row.attempts >= c_max_attempts THEN
    UPDATE provider_cancel_outbox SET status = 'failed', last_error = p_error WHERE id = p_id;
    IF v_row.kind = 'refund' AND v_row.request_id IS NOT NULL THEN
      v_fail := refund_to_source_fail(v_row.request_id, p_error);
      RETURN jsonb_build_object('id', p_id, 'status', 'failed', 'attempts', v_row.attempts, 'alerted', COALESCE((v_fail->>'alerted')::integer, 0));
    END IF;
    v_alerted := admin_alert_once(
      'payment_review',
      'Provider Cancel Failed',
      'Charge ' || v_row.provider || '/' || v_row.provider_charge_id || ' could not be voided after ' ||
        v_row.attempts || ' attempts (' || COALESCE(LEFT(p_error, 160), 'no detail') ||
        '). It may still be payable at the provider — close it there by hand; a late payment is credited to the buyer wallet automatically.',
      CASE WHEN v_row.order_id IS NOT NULL THEN '/account/orders/' || v_row.order_id::text ELSE NULL END);
    RETURN jsonb_build_object('id', p_id, 'status', 'failed', 'attempts', v_row.attempts, 'alerted', v_alerted);
  END IF;
  UPDATE provider_cancel_outbox SET last_error = p_error WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'pending', 'attempts', v_row.attempts, 'alerted', 0,
                            'next_attempt_at', v_row.next_attempt_at);
END;
$$;
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_mark(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_cancel_outbox_mark(uuid, boolean, text, text) TO service_role;

-- ── 9. order_dispute_resolve: report what was credited ───────────────────────
-- Body from 20260930005449 §6; changes: refund_full reports the store credit
-- actually posted, and the buyer is told the full amount is available to card.
CREATE OR REPLACE FUNCTION public.order_dispute_resolve(
  p_dispute_id uuid, p_admin_id uuid, p_outcome text, p_refund_minor bigint DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d           RECORD;
  v_order       RECORD;
  v_gross       BIGINT;
  v_seller      BIGINT;
  v_refund      BIGINT := 0;
  v_seller_side BIGINT := 0;
  v_t           JSONB;
  v_post        BOOLEAN;
  v_ref         TEXT;
  v_status      dispute_status_enum;
  v_after       BIGINT;
  v_cur         CHAR(3);
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_outcome NOT IN ('release', 'refund_full', 'refund_partial') THEN
    RAISE EXCEPTION 'order_dispute_resolve: outcome must be release | refund_full | refund_partial' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolved', false, 'reason', 'not_found');
  END IF;
  IF v_d.status IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed') THEN
    RETURN jsonb_build_object('resolved', false, 'reason', 'already_resolved', 'status', v_d.status);
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_d.transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolved', false, 'reason', 'order_not_found');
  END IF;
  IF v_order.status <> 'disputed' THEN
    RETURN jsonb_build_object('resolved', false, 'reason', 'order_not_disputed', 'status', v_order.status);
  END IF;

  v_cur    := UPPER(COALESCE(v_order.currency, 'USD'))::char(3);
  v_gross  := (COALESCE(v_order.total_amount, 0) * 100)::bigint;
  v_seller := (COALESCE(v_order.seller_payout, 0) * 100)::bigint;
  v_post   := v_order.completed_at IS NOT NULL;
  v_ref    := COALESCE(v_order.order_number, LEFT(v_order.id::text, 8));

  IF p_outcome = 'release' THEN
    v_t := safedrop_transition(v_order.id, 'DISPUTE_RESOLVED_SELLER', p_dispute_id::text, 'dispute_resolved', NULL);
    v_status := 'resolved_seller_favor';
  ELSIF p_outcome = 'refund_full' THEN
    -- The refund seam: REFUNDED transition (+ post-completion branch) and the
    -- buyer wallet credit, one transaction. A dispute lost is a SELLER fault:
    -- full credit, fault recorded (refund-policy 2026-09-30).
    v_t := order_refund_to_wallet(v_order.id, 'dispute:' || p_dispute_id::text, NULL, 'seller');
    -- What reached the buyer: the item price as store credit (2026-10-16).
    v_refund := COALESCE((v_t->>'credited_minor')::bigint, v_gross);
    v_seller_side := v_seller;
    v_status := 'resolved_buyer_favor';
  ELSE
    IF p_refund_minor IS NULL OR p_refund_minor <= 0 OR p_refund_minor >= v_gross THEN
      RAISE EXCEPTION 'order_dispute_resolve: partial refund must be in (0, %) minor units', v_gross USING ERRCODE = 'check_violation';
    END IF;
    v_t := safedrop_transition(v_order.id, 'DISPUTE_PARTIAL', p_dispute_id::text, 'dispute_resolved', p_refund_minor);
    IF v_order.buyer_id IS NOT NULL THEN
      PERFORM wallet_credit(v_order.buyer_id, p_refund_minor, v_cur, 'refunds',
        'wallet_refund:' || v_order.id::text || ':partial:' || p_dispute_id::text, 'REFUND_TO_WALLET', v_order.id);
    END IF;
    v_refund := p_refund_minor;
    v_seller_side := LEAST(p_refund_minor, v_seller);
    v_status := 'resolved_partial';
  END IF;

  PERFORM money_fault_hook('order_dispute_resolve:after_money');

  UPDATE disputes
     SET status = v_status,
         resolution_type = CASE p_outcome WHEN 'release' THEN 'no_refund' WHEN 'refund_full' THEN 'refund_full' ELSE 'refund_partial' END,
         resolved_amount = v_refund::numeric / 100,
         resolution_notes = LEFT(COALESCE(p_notes, ''), 4000),
         resolved_by = p_admin_id, resolved_at = now(), updated_at = now()
   WHERE id = p_dispute_id;

  INSERT INTO dispute_resolutions (dispute_id, resolved_by, resolution_type, favored_party, refund_amount, refund_percentage, seller_payout_amount, resolution_notes)
  VALUES (p_dispute_id, p_admin_id,
          CASE p_outcome WHEN 'release' THEN 'release_seller' WHEN 'refund_full' THEN 'refund_buyer' ELSE 'partial_refund' END,
          CASE p_outcome WHEN 'release' THEN 'seller' WHEN 'refund_full' THEN 'buyer' ELSE 'neutral' END,
          CASE WHEN v_refund > 0 THEN v_refund::numeric / 100 END,
          CASE WHEN v_refund > 0 AND v_gross > 0 THEN ROUND(v_refund::numeric * 100 / v_gross, 2) END,
          (v_seller - v_seller_side)::numeric / 100,
          LEFT(COALESCE(p_notes, ''), 4000));

  INSERT INTO order_dispute_events (dispute_id, order_id, actor_id, actor_role, action, reason, refund_minor, seller_side_minor, post_completion)
  VALUES (p_dispute_id, v_order.id, p_admin_id, 'admin',
          CASE p_outcome WHEN 'release' THEN 'resolved_release' WHEN 'refund_full' THEN 'resolved_refund_full' ELSE 'resolved_refund_partial' END,
          LEFT(COALESCE(p_notes, ''), 2000), v_refund, v_seller_side, v_post);

  -- Notified once per transition (dedupe on the dispute id + outcome + party).
  PERFORM notify_once(v_order.buyer_id, 'dispute_resolved',
    CASE WHEN v_refund > 0 THEN 'Store Balance Topped Up' ELSE 'Dispute Resolved' END,
    CASE p_outcome
      WHEN 'release' THEN 'Your dispute for order #' || v_ref || ' was closed in the seller''s favour. Check the order page for details.'
      WHEN 'refund_full' THEN 'Your dispute for order #' || v_ref || ' was resolved in your favour — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' was added to your Store Balance. Spend it at checkout with no service fee, or request the full $' || to_char(v_gross::numeric / 100, 'FM999999990.00') || ' back to your payment method from your Wallet.'
      ELSE 'Your dispute for order #' || v_ref || ' was resolved with a partial refund — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' was added to your Store Balance.'
    END,
    CASE WHEN v_refund > 0 THEN '/account/wallet' ELSE '/account/orders/' || v_order.id::text END,
    'dispute:' || p_dispute_id::text || ':resolved:buyer');
  -- Seller copy depends on whether the seller had been paid (v_post): a
  -- dispute before completion never credited them, so nothing is
  -- "deducted" and a release is a first payout, not money "available again".
  PERFORM notify_once(v_order.seller_id, 'dispute_resolved', 'Dispute Resolved',
    CASE
      WHEN p_outcome = 'release' AND v_post THEN
        'The dispute for order #' || v_ref || ' was resolved in your favour. Your payout is available again.'
      WHEN p_outcome = 'release' THEN
        'The dispute for order #' || v_ref || ' was resolved in your favour. The sale is complete and your payout was added to your balance.'
      WHEN p_outcome = 'refund_full' AND v_post THEN
        'The dispute for order #' || v_ref || ' was resolved in the buyer''s favour — $' || to_char(v_seller_side::numeric / 100, 'FM999999990.00') || ' was deducted from your balance.'
      WHEN p_outcome = 'refund_full' THEN
        'The dispute for order #' || v_ref || ' was resolved in the buyer''s favour. The buyer was refunded, so this sale is not paid out.'
      WHEN v_post THEN
        'The dispute for order #' || v_ref || ' was resolved with a partial refund — $' || to_char(v_seller_side::numeric / 100, 'FM999999990.00') || ' was deducted from your balance.'
      ELSE
        'The dispute for order #' || v_ref || ' was resolved with a partial refund. $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' went back to the buyer and $' || to_char((v_seller - v_seller_side)::numeric / 100, 'FM999999990.00') || ' was added to your balance.'
    END,
    '/account/orders/' || v_order.id::text, 'dispute:' || p_dispute_id::text || ':resolved:seller');

  v_after := seller_matured_balance(v_order.seller_id, v_cur);

  RETURN jsonb_build_object(
    'resolved', true, 'outcome', p_outcome, 'dispute_id', p_dispute_id, 'order_id', v_order.id,
    'order_number', v_order.order_number, 'buyer_id', v_order.buyer_id, 'seller_id', v_order.seller_id,
    'refund_minor', v_refund, 'seller_side_minor', v_seller_side, 'post_completion', v_post,
    'seller_available_after_minor', v_after, 'negative', v_after < 0,
    'order_status', v_t->>'status', 'ledger_txn_id', v_t->>'ledger_txn_id');
END;
$$;
REVOKE ALL ON FUNCTION public.order_dispute_resolve(uuid, uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_dispute_resolve(uuid, uuid, text, bigint, text) TO service_role;

-- ── 10. Wallet list: refunded orders and what each sends back to the card ────
CREATE OR REPLACE FUNCTION public.refund_to_source_quotes(p_buyer_id uuid)
  RETURNS TABLE (order_id uuid, order_number text, credit_minor bigint, fee_minor bigint, total_minor bigint,
                 currency char(3), method_label text, refundable boolean, request_status text, refunded_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number,
         wr.credit::bigint,
         LEAST(COALESCE(fk.kept, 0), GREATEST(ROUND((COALESCE(o.total_amount, 0) - (COALESCE(o.subtotal, 0) - COALESCE(o.promo_discount, 0))) * 100), 0))::bigint,
         (wr.credit + LEAST(COALESCE(fk.kept, 0), GREATEST(ROUND((COALESCE(o.total_amount, 0) - (COALESCE(o.subtotal, 0) - COALESCE(o.promo_discount, 0))) * 100), 0)))::bigint,
         UPPER(COALESCE(o.currency, 'USD'))::char(3),
         pmf.label, COALESCE(pmf.refundable, false), r.status, wr.created_at
    FROM orders o
    JOIN LATERAL (
      SELECT lt.created_at, SUM(le.amount_minor) AS credit
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
       WHERE lt.idempotency_key = 'wallet_refund:' || o.id::text
         AND la.kind = 'user_wallet' AND le.direction = 'credit' AND la.owner_id = p_buyer_id
       GROUP BY lt.created_at) wr ON wr.credit > 0
    LEFT JOIN LATERAL (
      SELECT SUM(le.amount_minor) AS kept
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
       WHERE lt.idempotency_key = 'fee_kept:' || o.id::text
         AND la.kind = 'platform_commission' AND le.direction = 'credit') fk ON true
    JOIN LATERAL (
      SELECT pa.provider, pa.pm_id FROM payment_attempts pa
       WHERE pa.order_id = o.id AND pa.status = 'paid' AND pa.provider_charge_id IS NOT NULL
       ORDER BY pa.created_at DESC LIMIT 1) pa ON true
    LEFT JOIN payment_method_fees pmf ON pmf.method = COALESCE(pa.pm_id, pa.provider)
    LEFT JOIN refund_to_source_requests r ON r.order_id = o.id
   WHERE o.buyer_id = p_buyer_id AND o.status IN ('refunded', 'cancelled')
   ORDER BY wr.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_quotes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_quotes(uuid) TO service_role;
COMMENT ON FUNCTION public.refund_to_source_quotes(uuid) IS
  'Wallet "Refund To Card" list: the buyer''s refunded orders paid through a provider, with the store credit, the kept fee, the full card amount, whether the rail refunds, and any request status. Service-role only (read through a session-checked action).';

-- ── 11. Crypto rails cannot refund provider-side ─────────────────────────────
-- BTCPay has no refund API (a card-route request would fail at the retry cap);
-- CoinGate is off. Crypto refunds stay store credit, or a support job
-- (Refund Policy 9.1).
UPDATE public.payment_method_fees SET refundable = false WHERE method IN ('btcpay', 'coingate');
