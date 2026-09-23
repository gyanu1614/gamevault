-- ============================================================================
-- PAY-002 (P0) — audit pass 6 (docs/audit/pass-6-checkout.md), fix/checkout-p0.
-- Idempotent: safe to re-run.
--
-- 'paid' → 'cancelled' is a legal order transition (is_valid_order_transition),
-- so a stale CHARGE_FAILED — the expiry sweep racing the confirm webhook, a
-- provider "expired" notify landing after "completed" — cancelled a PAID
-- order through order_cancel_return_wallet: buyer's provider money kept,
-- wallet hold returned, seller's sale gone.
--
-- Now the automatic path (webhook CHARGE_FAILED, expiry sweep, checkout
-- supersede, charge-create failure) may cancel ONLY from 'pending'. On any
-- other status the RPC changes nothing and inserts ONE deduped 'payment_review'
-- notification per active admin (keyed on admin + title + order link), so a
-- provider retry storm cannot spam. The buyer's explicit cancel (orders.ts
-- cancelOrder, PAY-008) passes p_allow_paid = true and may still cancel a
-- 'paid' order: CANCELLED (escrow_held → refunds) + the full total credited
-- to the buyer's wallet (refunds → user_wallet, key wallet_refund:<id>) in
-- the same transaction — the composition cancelOrder used to do in TypeScript.
--
-- The 2-arg overload is DROPPED (not kept beside the new one): PostgREST
-- resolves rpc() by parameter names, and two candidates for
-- {p_order_id, p_dedupe_key} would answer 300 Multiple Choices.
-- ============================================================================

DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text);

CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_allow_paid boolean DEFAULT false)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_transition JSONB;
  v_hold_txn   UUID;
  v_wallet_txn UUID;
  v_entries    JSONB := '[]'::jsonb;
  v_total      BIGINT;
  v_alerted    INT := 0;
  r RECORD;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_cancel_return_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status IN ('pending', 'cancelled') THEN
    -- Unpaid (or already cancelled: idempotent replay). CANCELLED then the
    -- exact mirror of the checkout hold (checkout_wallet:<id>) back to the
    -- buyer's wallet. Both keys idempotent — a replay posts only what is missing.
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

    RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'refused', false);
  END IF;

  IF v_order.status = 'paid' AND p_allow_paid THEN
    -- Explicit buyer cancel of a paid, undelivered order: CANCELLED moves
    -- escrow_held → refunds (gross); the buyer's wallet is credited the full
    -- total (wallet hold + provider portion) as store credit.
    v_transition := safedrop_transition(p_order_id, 'CANCELLED', p_dedupe_key, NULL, NULL);

    PERFORM money_fault_hook('order_cancel_return_wallet:after_paid_transition');

    v_total := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
    IF v_order.escrow_status = 'held' AND v_order.buyer_id IS NOT NULL AND v_total > 0 THEN
      v_wallet_txn := wallet_credit(
        v_order.buyer_id, v_total, UPPER(COALESCE(v_order.currency, 'USD'))::char(3), 'refunds',
        'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
    END IF;

    RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'refused', false, 'from_paid', true);
  END IF;

  -- Refused: paid (automatic caller), delivering, delivered, disputed,
  -- completed, refunded. Nothing changes; admins get one deduped alert.
  INSERT INTO notifications (user_id, type, title, message, link, is_read)
  SELECT ar.user_id,
         'payment_review',
         'Cancel Refused On Paid Order',
         'Order ' || UPPER(LEFT(p_order_id::text, 8)) || ' is ' || v_order.status ||
           ' — a cancel/expiry event (' || COALESCE(p_dedupe_key, 'no key') ||
           ') arrived after payment. Nothing was changed; check the provider charge.',
         '/account/orders/' || p_order_id::text,
         false
    FROM admin_roles ar
   WHERE ar.is_active
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ar.user_id
          AND n.type = 'payment_review'
          AND n.title = 'Cancel Refused On Paid Order'
          AND n.link = '/account/orders/' || p_order_id::text);
  GET DIAGNOSTICS v_alerted = ROW_COUNT;

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
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean) TO service_role;
COMMENT ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean) IS
  'Money layer (DB-015/PAY-002): cancel from pending (+ exact mirror of the checkout wallet hold) in one transaction; p_allow_paid=true (buyer explicit cancel) also cancels a paid order and credits the full total to the wallet. Any other status: no-op + one deduped admin payment_review alert. Service-role only.';
