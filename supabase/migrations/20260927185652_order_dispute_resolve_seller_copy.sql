-- ============================================================================
-- order_dispute_resolve: honest SELLER notification copy.
-- Idempotent: safe to re-run. The function body is copied VERBATIM from
-- 20260923030931_order_disputes.sql; the ONLY change is the seller
-- notify_once message, which now depends on v_post (was the seller already
-- paid?). Money, locks, audit rows, grants: unchanged.
--
-- Before: a dispute resolved BEFORE the order completed told the seller
-- "$X was deducted from your balance" (refund) or "Your payout is available
-- again" (release) — but a pre-completion order never credited the seller,
-- so nothing was deducted and nothing was "again".
-- ============================================================================

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
    -- The existing refund RPC: REFUNDED transition (+ post-completion branch)
    -- and the buyer wallet credit refunds → user_wallet, one transaction.
    v_t := order_refund_to_wallet(v_order.id, 'dispute:' || p_dispute_id::text, NULL);
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
    CASE WHEN v_refund > 0 THEN 'Money In Your Wallet' ELSE 'Dispute Resolved' END,
    CASE p_outcome
      WHEN 'release' THEN 'Your dispute for order #' || v_ref || ' was closed in the seller''s favour. Check the order page for details.'
      WHEN 'refund_full' THEN 'Your dispute for order #' || v_ref || ' was resolved in your favour — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' was added to your DropMarket wallet. Spend it instantly or withdraw it.'
      ELSE 'Your dispute for order #' || v_ref || ' was resolved with a partial refund — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') || ' was added to your DropMarket wallet.'
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
