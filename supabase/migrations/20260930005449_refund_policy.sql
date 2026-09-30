-- Refund policy (docs/design/buyer-fee-refund-policy.md, owner 2026-09-29).
--
-- Every refund still lands as store credit, instantly, through the two money
-- seams — they now take a FAULT:
--   buyer    the buyer cancelled a paid order / asked to: the ITEM price
--            (subtotal − promo) is credited; the fees they paid move
--            refunds → platform_commission ('fee_kept:<order>').
--   seller   the seller failed (cancel, non-delivery, dispute lost): FULL
--            credit; a row in order_seller_faults. From the seller's
--            threshold-th fault inside the rolling window (5 in 7 days) that
--            order's buyer fees are charged to the seller
--            (seller_available → platform_commission, 'seller_fault_fee:<order>').
--   platform DEFAULT — full credit, nothing recorded. Every caller that is
--            not updated (oversold at payment, a provider REFUND_COMPLETED
--            webhook, older builds during deploy) keeps today's behaviour.
-- Cancelling a PENDING (unpaid) order still returns the wallet hold in full.
--
-- Also: a provider refund event for an order already refunded/cancelled with
-- its wallet credit posted is a no-op (the refund-to-source flow ends with
-- exactly that webhook), and the withdrawal gate refuses buyers
-- ('not_a_seller') — store credit is spent at checkout; buyers contact support.
--
-- Signatures grow with DEFAULTs (DROP + CREATE): PostgREST named-parameter
-- calls from the old build still resolve.

-- ── 1. Config ────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS seller_fault_fee_threshold   integer NOT NULL DEFAULT 5 CHECK (seller_fault_fee_threshold >= 1),
  ADD COLUMN IF NOT EXISTS seller_fault_fee_window_days integer NOT NULL DEFAULT 7 CHECK (seller_fault_fee_window_days >= 1);
COMMENT ON COLUMN public.platform_fee_settings.seller_fault_fee_threshold IS
  'From this many seller-fault cancels inside the window, each further one charges that order''s buyer fees to the seller.';
COMMENT ON COLUMN public.platform_fee_settings.seller_fault_fee_window_days IS
  'Rolling window (days) for seller_fault_fee_threshold.';

-- ── 2. Seller faults ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_seller_faults (
  order_id          uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source            text NOT NULL CHECK (source IN ('seller_cancel', 'admin_cancel', 'dispute')),
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  fee_charged_minor bigint NOT NULL DEFAULT 0,
  fee_txn_id        uuid REFERENCES public.ledger_transactions(id)
);
CREATE INDEX IF NOT EXISTS order_seller_faults_seller_idx ON public.order_seller_faults (seller_id, occurred_at DESC);
ALTER TABLE public.order_seller_faults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_seller_faults FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_seller_faults TO service_role;
COMMENT ON TABLE public.order_seller_faults IS
  'One row per order the seller failed (cancelled it, did not deliver, lost the dispute). Drives the rolling non-delivery fee. Service-role only.';

-- Record a seller fault; from the threshold-th fault inside the window,
-- charge that order's buyer fees (platform_fee + payment_processing_fee) to
-- the seller. Idempotent per order. Called inside the refund seams.
CREATE OR REPLACE FUNCTION public.order_seller_fault_record(p_order_id uuid, p_source text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        RECORD;
  v_s        RECORD;
  v_existing RECORD;
  v_count    integer;
  v_fee      bigint;
  v_txn      uuid;
  v_cur      char(3);
BEGIN
  IF p_source NOT IN ('seller_cancel', 'admin_cancel', 'dispute') THEN
    RAISE EXCEPTION 'order_seller_fault_record: source must be seller_cancel|admin_cancel|dispute, got %', p_source USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_o.seller_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'fee_charged_minor', 0);
  END IF;
  SELECT * INTO v_existing FROM order_seller_faults WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('recorded', false, 'fee_charged_minor', v_existing.fee_charged_minor, 'fee_txn_id', v_existing.fee_txn_id);
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
  v_cur := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);

  PERFORM money_fault_hook('order_seller_fault_record:after_insert');

  IF v_count >= v_s.seller_fault_fee_threshold AND v_fee > 0 THEN
    v_txn := post_journal('seller_fault_fee:' || p_order_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','seller','owner_id',v_o.seller_id::text,'kind','seller_available','direction','debit','amount_minor',v_fee,'currency',v_cur),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee,'currency',v_cur)),
      'SELLER_FAULT_FEE', p_order_id);
    UPDATE order_seller_faults SET fee_charged_minor = v_fee, fee_txn_id = v_txn WHERE order_id = p_order_id;
    -- Legacy read-model, kept in step the way safedrop_transition does.
    UPDATE profiles SET seller_balance = COALESCE(seller_balance, 0) - (v_fee::numeric / 100) WHERE id = v_o.seller_id;
    PERFORM notify_once(v_o.seller_id, 'seller_fault_fee', 'Non-Delivery Fee Applied',
      'This is cancelled order number ' || v_count || ' on your account in the last ' || v_s.seller_fault_fee_window_days ||
      ' days. The buyer''s fees on order #' || COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8))) ||
      ' ($' || to_char(v_fee::numeric / 100, 'FM999999990.00') || ') were charged to your balance.',
      '/account/orders/' || p_order_id::text, 'seller_fault_fee:' || p_order_id::text);
  ELSE
    v_fee := 0;
  END IF;
  RETURN jsonb_build_object('recorded', true, 'count_in_window', v_count, 'fee_charged_minor', v_fee, 'fee_txn_id', v_txn);
END;
$$;
REVOKE ALL ON FUNCTION public.order_seller_fault_record(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_seller_fault_record(uuid, text) TO service_role;
COMMENT ON FUNCTION public.order_seller_fault_record(uuid, text) IS
  'Records a seller fault for an order; from the threshold-th fault in the rolling window charges that order''s buyer fees seller_available → platform_commission (seller_fault_fee:<order>). Idempotent per order. Service-role only.';

-- ── 3. The buyer credit + fee-kept leg shared by both refund seams ──────────
-- Assumes the caller already ran safedrop_transition (escrow_held → refunds,
-- gross) inside this transaction and holds the order row lock.
CREATE OR REPLACE FUNCTION public.order_refund_buyer_credit(
  p_order_id uuid, p_fault text, p_amount_minor bigint, p_dedupe_key text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o          RECORD;
  v_cur        char(3);
  v_total      bigint;
  v_item       bigint;
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
  v_credit := CASE
    WHEN p_amount_minor IS NOT NULL AND p_amount_minor > 0 AND p_amount_minor < v_total THEN p_amount_minor
    WHEN p_fault = 'buyer' THEN LEAST(v_item, v_total)
    ELSE v_total END;

  IF v_o.buyer_id IS NOT NULL AND v_credit > 0 THEN
    v_wallet_txn := wallet_credit(v_o.buyer_id, v_credit, v_cur, 'refunds',
                                  'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
  END IF;

  PERFORM money_fault_hook('order_refund_buyer_credit:after_credit');

  -- Buyer fault: what was not credited is ours (the fees they agreed to).
  v_kept := v_total - v_credit;
  IF p_fault = 'buyer' AND v_kept > 0 THEN
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
      ELSE 'seller_cancel' END;
    v_fault := order_seller_fault_record(p_order_id, v_source);
  END IF;

  RETURN jsonb_build_object(
    'wallet_txn_id', v_wallet_txn, 'credited_minor', v_credit, 'fault', p_fault,
    'fee_kept_minor', v_kept, 'fee_kept_txn_id', v_kept_txn,
    'fault_fee_minor', COALESCE((v_fault->>'fee_charged_minor')::bigint, 0),
    'fault_count_in_window', (v_fault->>'count_in_window')::integer);
END;
$$;
REVOKE ALL ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) TO service_role;
COMMENT ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint, text) IS
  'Internal leg of the refund seams: fault-aware buyer wallet credit (buyer = item price, fees kept → platform_commission; seller/platform = full) + seller-fault record. Service-role only.';

-- ── 4. order_refund_to_wallet (+ p_fault, no-op replay guard) ───────────────
DROP FUNCTION IF EXISTS public.order_refund_to_wallet(uuid, text, bigint);
CREATE OR REPLACE FUNCTION public.order_refund_to_wallet(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_amount_minor bigint DEFAULT NULL, p_fault text DEFAULT 'platform')
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_transition JSONB;
  v_leg        JSONB;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_refund_to_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;
  -- Already settled with the buyer (refund-to-source ends with the provider's
  -- own refunded webhook; a manual provider refund replays the same way):
  -- nothing to move, nothing to credit twice.
  IF v_order.status IN ('refunded', 'cancelled')
     AND EXISTS (SELECT 1 FROM ledger_transactions WHERE idempotency_key = 'wallet_refund:' || p_order_id::text) THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', v_order.status, 'escrow_status', v_order.escrow_status,
                              'changed', false, 'reason', 'already_refunded');
  END IF;

  v_transition := safedrop_transition(p_order_id, 'REFUNDED', p_dedupe_key, NULL, NULL);

  PERFORM money_fault_hook('order_refund_to_wallet:after_transition');

  v_leg := order_refund_buyer_credit(p_order_id, COALESCE(p_fault, 'platform'), p_amount_minor, p_dedupe_key);

  RETURN v_transition || v_leg;
END;
$$;
REVOKE ALL ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) TO service_role;
COMMENT ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) IS
  'Money layer: safedrop_transition(REFUNDED) + fault-aware buyer credit (buyer fault = item price, fees kept; seller = full + fault record; platform = full) in one transaction. Idempotent on order:<id>:REFUNDED[:dedupe] and wallet_refund:<id>. Service-role only.';

-- ── 5. order_cancel_return_wallet (+ p_fault on the paid branch) ────────────
-- Body from 20260923030139 §6 verbatim; the paid branch's wallet_credit is
-- now the shared leg.
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text);
CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_allow_paid boolean DEFAULT false,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL,
  p_attempt_close text DEFAULT NULL, p_provider_void_outcome text DEFAULT NULL,
  p_fault text DEFAULT 'platform')
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order            RECORD;
  v_attempt_id       uuid := NULL;
  v_attempt_order_id uuid := NULL;
  v_attempt_status   text := NULL;
  v_open             RECORD;
  v_close            text;
  v_transition       JSONB;
  v_hold_txn         UUID;
  v_wallet_txn       UUID;
  v_leg              JSONB := '{}'::jsonb;
  v_entries          JSONB := '[]'::jsonb;
  v_total            BIGINT;
  v_alerted          INT := 0;
  v_outbox_id        uuid := NULL;
  r RECORD;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_cancel_return_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 0. A failure event names its charge. Bound to another order → refuse.
  --    Bound to an attempt that is no longer open (a retry superseded it,
  --    or it already closed) → nothing to do: the order's LIVE attempt is
  --    unaffected by the old invoice expiring.
  IF p_provider IS NOT NULL AND p_provider_charge_id IS NOT NULL THEN
    SELECT id, order_id, status INTO v_attempt_id, v_attempt_order_id, v_attempt_status FROM payment_attempts
     WHERE provider = p_provider AND provider_charge_id = p_provider_charge_id FOR UPDATE;
    IF v_attempt_id IS NOT NULL THEN
      IF v_attempt_order_id <> p_order_id THEN
        RAISE EXCEPTION 'order_cancel_return_wallet: charge %/% is bound to order %, not %',
          p_provider, p_provider_charge_id, v_attempt_order_id, p_order_id USING ERRCODE = 'check_violation';
      END IF;
      IF v_attempt_status NOT IN ('created', 'active') THEN
        RETURN jsonb_build_object(
          'order_id', p_order_id, 'status', v_order.status, 'escrow_status', v_order.escrow_status,
          'changed', false, 'refused', false, 'reason', 'stale_attempt', 'attempt_status', v_attempt_status);
      END IF;
    END IF;
  END IF;
  -- How the open attempt closes: 'failed' when the PROVIDER reported the
  -- charge dead (webhook CHARGE_FAILED — nothing to void), 'void' when WE
  -- closed it (expiry sweep, supersede, charge-create failure, buyer
  -- cancel — the live charge goes to the outbox). The caller may say;
  -- otherwise a named charge means the provider spoke.
  v_close := COALESCE(p_attempt_close, CASE WHEN p_provider_charge_id IS NOT NULL THEN 'failed' ELSE 'void' END);
  IF v_close NOT IN ('failed', 'void') THEN
    RAISE EXCEPTION 'order_cancel_return_wallet: p_attempt_close must be failed|void, got %', v_close USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.status IN ('pending', 'cancelled') THEN
    v_transition := safedrop_transition(p_order_id, 'CANCELLED', p_dedupe_key, NULL, NULL);

    PERFORM money_fault_hook('order_cancel_return_wallet:after_transition');

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

    -- Close the open attempt (history row stays) and, when WE are the ones
    -- closing a live charge, hand it to the provider cancel outbox in this
    -- same transaction.
    SELECT id, provider, provider_charge_id INTO v_open
      FROM payment_attempts WHERE order_id = p_order_id AND status IN ('created', 'active') FOR UPDATE;
    UPDATE payment_attempts
       SET status = v_close, closed_at = now(), close_reason = COALESCE(p_dedupe_key, 'cancelled')
     WHERE order_id = p_order_id AND status IN ('created', 'active');
    IF v_close = 'void' AND v_open.id IS NOT NULL AND v_open.provider_charge_id IS NOT NULL THEN
      v_outbox_id := provider_cancel_outbox_enqueue(
        v_open.id, p_order_id, v_open.provider, v_open.provider_charge_id,
        COALESCE(p_dedupe_key, 'cancelled'), p_provider_void_outcome);
    END IF;

    PERFORM money_fault_hook('order_cancel_return_wallet:after_outbox');

    RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'refused', false, 'outbox_id', v_outbox_id);
  END IF;

  IF v_order.status = 'paid' AND p_allow_paid THEN
    v_transition := safedrop_transition(p_order_id, 'CANCELLED', p_dedupe_key, NULL, NULL);

    PERFORM money_fault_hook('order_cancel_return_wallet:after_paid_transition');

    v_total := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
    IF v_order.escrow_status = 'held' AND v_order.buyer_id IS NOT NULL AND v_total > 0 THEN
      v_leg := order_refund_buyer_credit(p_order_id, COALESCE(p_fault, 'platform'), NULL, p_dedupe_key);
    END IF;

    RETURN v_transition || v_leg || jsonb_build_object('refused', false, 'from_paid', true);
  END IF;

  -- Refused (PAY-002): paid (automatic caller), delivering, delivered,
  -- disputed, completed, refunded. Nothing changes; admins get one deduped alert.
  v_alerted := admin_alert_once(
    'payment_review',
    'Cancel Refused On Paid Order',
    'Order ' || UPPER(LEFT(p_order_id::text, 8)) || ' is ' || v_order.status ||
      ' — a cancel/expiry event (' || COALESCE(p_dedupe_key, 'no key') ||
      ') arrived after payment. Nothing was changed; check the provider charge.',
    '/account/orders/' || p_order_id::text);

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', v_order.status,
    'escrow_status', v_order.escrow_status,
    'changed', false,
    'refused', true,
    'reason', 'not_cancellable',
    'admins_alerted', v_alerted);
END;
$$;
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text, text) IS
  'Money layer (DB-015 / round B): safedrop_transition(CANCELLED) + the exact checkout wallet hold back (pending) or the fault-aware buyer credit (paid, p_allow_paid), the open attempt closed and a live charge queued for the provider cancel outbox — one transaction. Idempotent. Service-role only.';

-- ── 6. order_dispute_resolve: refund_full is a seller fault; Store Balance copy
-- Body from 20260927185652 verbatim; two changes: the refund_full call passes
-- 'seller', and the buyer notifications no longer say "withdraw it".
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
    v_refund := v_gross;
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
      WHEN 'refund_full' THEN 'Your dispute for order #' || v_ref || ' was resolved in your favour — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' was added to your Store Balance. Spend it at checkout with no service fee.'
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

-- ── 7. Withdrawal gate: buyers spend store credit, they do not withdraw it ──
CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role    TEXT;
  v_since   TIMESTAMPTZ;
  v_days    INT;
  v_freeze  INT;
  v_unlock  TIMESTAMPTZ;
  v_changed TIMESTAMPTZ;
  v_until   TIMESTAMPTZ;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_seller_id;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_a_seller', 'seller_since', NULL,
                              'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL);
  END IF;
  v_since := seller_since(p_seller_id);
  SELECT withdrawal_min_account_age_days, payout_details_freeze_hours INTO v_days, v_freeze FROM platform_fee_settings WHERE id;
  v_unlock := COALESCE(v_since, now()) + make_interval(days => COALESCE(v_days, 30));
  SELECT details_changed_at INTO v_changed FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_until := CASE WHEN v_changed IS NULL THEN NULL ELSE v_changed + make_interval(hours => COALESCE(v_freeze, 48)) END;

  IF v_since IS NULL OR v_unlock > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_age', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until);
  END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'payout_details_freeze', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until, 'freeze_hours', v_freeze);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL, 'seller_since', v_since, 'unlock_at', v_unlock,
                            'min_age_days', v_days, 'freeze_until', v_until);
END;
$$;

-- withdrawal_quote: body from 20260923031644 §5 verbatim + the not_a_seller message.
CREATE OR REPLACE FUNCTION public.withdrawal_quote(p_seller_id uuid, p_method_id uuid, p_amount numeric) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m         RECORD;
  v_amount    NUMERIC := fee_round_cents(COALESCE(p_amount, 0));
  v_fee       NUMERIC := 0;
  v_net       NUMERIC := 0;
  v_gate      JSONB;
  v_matured   BIGINT := seller_matured_balance(p_seller_id, 'USD');
  v_wallet    BIGINT := user_wallet_balance(p_seller_id, 'USD');
  v_available BIGINT;
  v_open      UUID;
  v_details   RECORD;
  v_refusal   TEXT := NULL;
  v_message   TEXT := NULL;
  v_extra     JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_m FROM withdrawal_methods WHERE id = p_method_id;
  IF NOT FOUND OR v_m.is_active IS DISTINCT FROM true OR v_m.coming_soon THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'method_unavailable', 'message', 'That withdrawal method is not available.',
                              'amount', v_amount, 'fee_amount', 0, 'net', 0);
  END IF;

  v_fee := fee_round_cents(GREATEST(v_amount * COALESCE(v_m.fee_percentage, 0) / 100 + COALESCE(v_m.fee_fixed, 0), COALESCE(v_m.fee_min, 0)));
  v_net := fee_round_cents(v_amount - v_fee);
  v_available := v_matured + v_wallet;
  v_gate := seller_withdrawal_gate(p_seller_id);
  SELECT id INTO v_open FROM withdrawal_requests WHERE user_id = p_seller_id AND status IN ('pending', 'approved', 'processing') LIMIT 1;
  SELECT * INTO v_details FROM seller_payout_details WHERE seller_id = p_seller_id;

  IF NOT (v_gate->>'eligible')::boolean THEN
    v_refusal := v_gate->>'reason';
    v_message := CASE v_refusal
      WHEN 'not_a_seller' THEN 'Store credit is spent at checkout. To withdraw it, contact support@dropmarket.gg.'
      WHEN 'account_age' THEN 'Withdrawals open ' || COALESCE(v_gate->>'min_age_days', '30') || ' days after your seller account is approved — from ' || to_char((v_gate->>'unlock_at')::timestamptz, 'DD Mon YYYY') || '.'
      ELSE 'You changed your payout details recently. For your security, withdrawals reopen on ' || to_char((v_gate->>'freeze_until')::timestamptz, 'DD Mon YYYY HH24:MI') || ' UTC.' END;
  ELSIF v_matured < 0 THEN
    v_refusal := 'negative_balance';
    v_message := 'Your balance is below zero after a refund. Withdrawals reopen once new sales bring it back above zero.';
  ELSIF v_open IS NOT NULL THEN
    v_refusal := 'open_withdrawal';
    v_message := 'You already have a withdrawal in progress. Wait for it to complete or cancel it first.';
    v_extra := jsonb_build_object('open_request_id', v_open);
  ELSIF (v_m.method_type = 'crypto' AND (v_details.crypto_address IS NULL OR v_details.crypto_chain IS DISTINCT FROM v_m.chain OR v_details.crypto_coin IS DISTINCT FROM v_m.coin))
     OR (v_m.method_name = 'payoneer' AND v_details.payoneer_email IS NULL) THEN
    v_refusal := 'payout_details_missing';
    v_message := CASE WHEN v_m.method_type = 'crypto'
      THEN 'Save a ' || upper(COALESCE(v_m.coin, '')) || ' address on ' || COALESCE(v_m.chain, '') || ' in your payout settings first.'
      ELSE 'Save your Payoneer email in your payout settings first.' END;
  ELSIF v_amount < COALESCE(v_m.min_withdrawal, 0) THEN
    v_refusal := 'below_minimum';
    v_message := 'Minimum withdrawal for ' || v_m.display_name || ' is $' || to_char(v_m.min_withdrawal, 'FM999999990.00') || '.';
  ELSIF v_m.max_withdrawal IS NOT NULL AND v_amount > v_m.max_withdrawal THEN
    v_refusal := 'above_maximum';
    v_message := 'Maximum withdrawal for ' || v_m.display_name || ' is $' || to_char(v_m.max_withdrawal, 'FM999999990.00') || '.';
  ELSIF ROUND(v_amount * 100) > v_available THEN
    v_refusal := 'insufficient_available';
    v_message := 'You can withdraw up to $' || to_char(v_available::numeric / 100, 'FM999999990.00') || ' right now.';
  ELSIF v_fee >= v_amount THEN
    v_refusal := 'fee_exceeds_amount';
    v_message := 'The fee would exceed the amount.';
  END IF;

  RETURN jsonb_build_object(
    'ok', v_refusal IS NULL, 'refusal', v_refusal, 'message', v_message,
    'method', jsonb_build_object('id', v_m.id, 'name', v_m.method_name, 'display_name', v_m.display_name, 'type', v_m.method_type, 'coin', v_m.coin, 'chain', v_m.chain),
    'amount', v_amount, 'fee_pct', COALESCE(v_m.fee_percentage, 0), 'fee_fixed', COALESCE(v_m.fee_fixed, 0), 'fee_min', COALESCE(v_m.fee_min, 0),
    'fee_amount', v_fee, 'net', v_net,
    'minimum', v_m.min_withdrawal, 'maximum', v_m.max_withdrawal,
    'available_minor', v_available, 'matured_minor', v_matured, 'wallet_minor', v_wallet,
    'gate', v_gate) || v_extra;
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_quote(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_quote(uuid, uuid, numeric) TO service_role;
