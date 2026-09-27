-- ============================================================================
-- Disputes the two parties settle themselves.
-- Idempotent: safe to re-run. ADDITIVE ONLY: two new service-role RPCs and a
-- version probe. No existing function, table, column, policy or grant is
-- changed.
--
-- Before: once an order was `disputed`, the seller could not record a
-- delivery (order_mark_delivered only accepts paid/delivering) and the buyer
-- could not confirm receipt (order_confirm_receipt refuses `disputed`). Every
-- dispute, even one the parties had already sorted out in chat, waited for
-- an admin to run order_dispute_resolve.
--
-- After:
--   order_mark_delivered_in_dispute(order, seller)
--     · seller owns the order, status = disputed, not yet delivered;
--     · stamps orders.delivered_at ONLY. The status stays `disputed` and no
--       money moves; auto_release_at is NOT set (auto-complete only ever
--       picks status = delivered, so a disputed order is never auto-released);
--     · tells the buyer (notify_once) they can confirm to close the dispute.
--   order_dispute_buyer_confirm(order, buyer)
--     · buyer owns the order, status = disputed, an OPEN dispute exists and
--       the BUYER opened it (an admin-opened dispute is the team's review and
--       only an admin closes it);
--     · locks dispute THEN order, the same order as order_dispute_resolve, so
--       a buyer confirm racing an admin resolve cannot deadlock and exactly
--       one of them wins (the loser sees already_resolved / not_disputed);
--     · money, through safedrop_transition only:
--         - dispute opened BEFORE completion (completed_at IS NULL): the
--           normal buyer-confirm release, BUYER_CONFIRMED (escrow -> platform
--           take + seller_available, with the completion_hold_hours maturity
--           hold), exactly as order_confirm_receipt does;
--         - dispute opened AFTER completion: DISPUTE_RESOLVED_SELLER, which
--           unfreezes seller_frozen -> seller_available, exactly as an admin
--           "release" does;
--     · closes the dispute as resolved_seller_favor / no_refund with
--       resolved_by = the buyer, writes dispute_resolutions + an
--       order_dispute_events row (actor_role buyer, resolved_release) and
--       notifies the seller once.
--   Both refuse the ordinary wrong-state cases with changed=false + reason
--   (so the action can show a message) and raise only on money faults.
-- ============================================================================

-- Probe for integration tests: present => this migration is applied.
CREATE OR REPLACE FUNCTION public.order_dispute_self_resolve_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.order_dispute_self_resolve_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_dispute_self_resolve_version() TO service_role;

-- ── 1. Seller records delivery while the order is disputed ─────────────────
CREATE OR REPLACE FUNCTION public.order_mark_delivered_in_dispute(p_order_id uuid, p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_now   TIMESTAMPTZ := now();
  v_ref   TEXT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.seller_id IS DISTINCT FROM p_seller_id THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_order.status <> 'disputed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_disputed', 'status', v_order.status);
  END IF;
  IF v_order.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'already_delivered', 'delivered_at', v_order.delivered_at);
  END IF;

  -- delivered_at only: no status change, no auto_release_at, no money.
  UPDATE orders SET delivered_at = v_now WHERE id = p_order_id;

  v_ref := COALESCE(v_order.order_number, LEFT(p_order_id::text, 8));
  PERFORM notify_once(v_order.buyer_id, 'order_delivered', 'Order Delivered',
    '#' || v_ref || ' — the seller marked your order as delivered. If you received it, confirm on the order page to close your dispute.',
    '/account/orders/' || p_order_id::text, 'dispute_delivered:' || p_order_id::text);

  RETURN jsonb_build_object('order_id', p_order_id, 'changed', true, 'delivered_at', v_now,
                            'buyer_id', v_order.buyer_id, 'order_number', v_order.order_number);
END;
$$;
REVOKE ALL ON FUNCTION public.order_mark_delivered_in_dispute(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_mark_delivered_in_dispute(uuid, uuid) TO service_role;

-- ── 2. Buyer confirms receipt, closing their own dispute ───────────────────
CREATE OR REPLACE FUNCTION public.order_dispute_buyer_confirm(p_order_id uuid, p_buyer_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispute_id UUID;
  v_d          RECORD;
  v_order      RECORD;
  v_t          JSONB;
  v_post       BOOLEAN;
  v_seller     BIGINT;
  v_ref        TEXT;
  v_now        TIMESTAMPTZ := now();
  v_notes      TEXT := 'Closed by the buyer: they confirmed the order was received.';
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  -- Find the open dispute without a lock, then lock dispute -> order (the
  -- order_dispute_resolve lock order) and re-check both under the locks.
  SELECT id INTO v_dispute_id FROM disputes
   WHERE transaction_id = p_order_id
     AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed')
   LIMIT 1;
  IF v_dispute_id IS NULL THEN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    IF NOT FOUND OR v_order.buyer_id IS DISTINCT FROM p_buyer_id THEN
      RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
    END IF;
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'no_open_dispute', 'status', v_order.status);
  END IF;

  SELECT * INTO v_d FROM disputes WHERE id = v_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'already_resolved');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_d.status IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed') THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'already_resolved', 'dispute_status', v_d.status);
  END IF;
  IF v_order.status <> 'disputed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_disputed', 'status', v_order.status);
  END IF;
  IF EXISTS (SELECT 1 FROM order_dispute_events e WHERE e.dispute_id = v_d.id AND e.action = 'admin_opened') THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'admin_opened', 'dispute_id', v_d.id);
  END IF;

  v_post   := v_order.completed_at IS NOT NULL;
  v_seller := (COALESCE(v_order.seller_payout, 0) * 100)::bigint;

  IF NOT v_post THEN
    -- The buyer's ordinary confirm: same event, same maturity hold, same
    -- journal key as order_confirm_receipt (a pre-completion order has never
    -- been released, so the key is unused).
    v_t := safedrop_transition(p_order_id, 'BUYER_CONFIRMED', NULL, 'buyer_confirmed', NULL);
    UPDATE orders
       SET delivered_at       = COALESCE(delivered_at, v_now),
           buyer_confirmed_at = COALESCE(buyer_confirmed_at, v_now)
     WHERE id = p_order_id;
  ELSE
    -- Already released once and frozen by the dispute: unfreeze, exactly as
    -- an admin "release" does.
    v_t := safedrop_transition(p_order_id, 'DISPUTE_RESOLVED_SELLER', v_d.id::text, 'dispute_resolved', NULL);
  END IF;

  PERFORM money_fault_hook('order_dispute_buyer_confirm:after_money');

  UPDATE disputes
     SET status = 'resolved_seller_favor',
         resolution_type = 'no_refund',
         resolved_amount = 0,
         resolution_notes = v_notes,
         resolved_by = p_buyer_id, resolved_at = v_now, updated_at = v_now
   WHERE id = v_d.id;

  INSERT INTO dispute_resolutions (dispute_id, resolved_by, resolution_type, favored_party, refund_amount, refund_percentage, seller_payout_amount, resolution_notes)
  VALUES (v_d.id, p_buyer_id, 'release_seller', 'seller', NULL, NULL, v_seller::numeric / 100, v_notes);

  INSERT INTO order_dispute_events (dispute_id, order_id, actor_id, actor_role, action, reason, refund_minor, seller_side_minor, post_completion)
  VALUES (v_d.id, p_order_id, p_buyer_id, 'buyer', 'resolved_release', 'buyer_confirmed_receipt', 0, 0, v_post);

  -- Same dedupe key as an admin resolution: a dispute is resolved once.
  v_ref := COALESCE(v_order.order_number, LEFT(p_order_id::text, 8));
  PERFORM notify_once(v_order.seller_id, 'dispute_resolved', 'Dispute Closed',
    'The buyer confirmed they received order #' || v_ref || ' and closed the dispute. '
      || CASE WHEN v_post THEN 'Your payout is available again.' ELSE 'The sale is complete.' END,
    '/account/orders/' || p_order_id::text, 'dispute:' || v_d.id::text || ':resolved:seller');

  RETURN v_t || jsonb_build_object(
    'changed', true, 'resolved', true, 'dispute_id', v_d.id, 'post_completion', v_post,
    'seller_id', v_order.seller_id, 'seller_payout', v_order.seller_payout,
    'order_number', v_order.order_number, 'listing_id', v_order.listing_id,
    'total_amount', v_order.total_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.order_dispute_buyer_confirm(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_dispute_buyer_confirm(uuid, uuid) TO service_role;
