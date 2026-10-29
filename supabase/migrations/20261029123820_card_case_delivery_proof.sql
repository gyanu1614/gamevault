-- Card chargebacks: delivery proof decides who pays (owner 2026-10-29: "if the
-- seller delivered, they shouldn't have to pay").
--
-- A lost full chargeback on a DELIVERED order with proof — the buyer
-- confirmed, the buyer opened the order after delivery (order_access_log), or
-- the seller's delivery photo — is paid by DropMarket and the seller keeps
-- the sale, also when the order auto-completed or never completed. No
-- delivery or no proof: the seller pays (unchanged). Proof, but the buyer's
-- own SafeDrop dispute is open: the case waits for an admin (Seller Pays /
-- DropMarket Pays on the order page).
--
-- order_access_log is what the bank sees in a dispute: when, and from which
-- IP and device, the buyer paid and opened the delivered order.
-- Replaces card_case_settle_internal and card_dispute_close from
-- 20261028143542 (only the parts marked "changed" differ).

-- ── 1. Access log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_access_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event         text NOT NULL CHECK (event IN ('checkout', 'view')),
  ip            inet,
  user_agent    text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 300),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  hits          integer NOT NULL DEFAULT 1 CHECK (hits > 0),
  CONSTRAINT order_access_log_one_row_per_device UNIQUE NULLS NOT DISTINCT (order_id, user_id, event, ip, user_agent)
);
ALTER TABLE public.order_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_access_log FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.order_access_log IS
  'When, and from which IP and device, the buyer paid (checkout) and opened the delivered order (view). Delivery proof for card disputes. Written only by order_access_record; service role only.';

-- The buyer's own visits only; a view counts only once the order is
-- delivered. One row per device (IP + user agent) with a hit count; at most
-- 50 rows per order. A malformed IP is stored as NULL.
CREATE OR REPLACE FUNCTION public.order_access_record(
  p_order_id uuid, p_user_id uuid, p_event text, p_ip text, p_user_agent text)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o  orders%ROWTYPE;
  v_ip inet;
  v_ua text := LEFT(COALESCE(p_user_agent, ''), 300);
BEGIN
  IF p_event IS NULL OR p_event NOT IN ('checkout', 'view') THEN
    RAISE EXCEPTION 'order_access_record: event must be checkout|view' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_o.buyer_id IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;
  IF p_event = 'view' AND v_o.delivered_at IS NULL AND v_o.seller_marked_delivered_at IS NULL
     AND v_o.instant_delivery_delivered_at IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    v_ip := NULLIF(btrim(p_ip), '')::inet;
  EXCEPTION WHEN data_exception THEN
    v_ip := NULL;
  END;

  UPDATE order_access_log SET last_seen_at = now(), hits = LEAST(hits + 1, 1000000)
   WHERE order_id = p_order_id AND user_id = p_user_id AND event = p_event
     AND ip IS NOT DISTINCT FROM v_ip AND user_agent = v_ua;
  IF FOUND THEN
    RETURN true;
  END IF;
  IF (SELECT count(*) FROM order_access_log WHERE order_id = p_order_id) >= 50 THEN
    RETURN false;
  END IF;
  INSERT INTO order_access_log (order_id, user_id, event, ip, user_agent)
  VALUES (p_order_id, p_user_id, p_event, v_ip, v_ua)
  ON CONFLICT ON CONSTRAINT order_access_log_one_row_per_device
  DO UPDATE SET last_seen_at = now(), hits = LEAST(order_access_log.hits + 1, 1000000);
  RETURN true;
END;
$$;

-- ── 2. Delivery proof ───────────────────────────────────────────────────────
-- NULL when the order was never delivered (by the seller or an instant code)
-- or has no proof; else which proof (strongest first): confirmed · opened · photo.
CREATE OR REPLACE FUNCTION public.card_case_delivery_proof(p_order orders)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_order.delivered_at IS NULL AND p_order.seller_marked_delivered_at IS NULL
         AND p_order.instant_delivery_delivered_at IS NULL THEN NULL
    WHEN p_order.buyer_confirmed_at IS NOT NULL THEN 'confirmed'
    WHEN EXISTS (SELECT 1 FROM order_access_log l
                  WHERE l.order_id = p_order.id AND l.user_id = p_order.buyer_id AND l.event = 'view') THEN 'opened'
    WHEN EXISTS (SELECT 1 FROM unnest(COALESCE(p_order.delivery_evidence_urls, '{}'::text[])) u
                  WHERE btrim(u) <> '') THEN 'photo'
  END;
$$;

-- ── 3. Settle (changed: DropMarket may also absorb a delivered order that is
--    still held — a dispute lost before completion releases it first) ──────
CREATE OR REPLACE FUNCTION public.card_case_settle_internal(p_case_id uuid, p_bearer text, p_actor_id uuid DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case     card_cases%ROWTYPE;
  v_o        orders%ROWTYPE;
  v_gross    bigint;
  v_wallet   bigint;
  v_released boolean;
BEGIN
  IF p_bearer IS NULL OR p_bearer NOT IN ('seller', 'platform') THEN
    RAISE EXCEPTION 'card_case_settle: bearer must be seller|platform' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_case FROM card_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_case_settle: case % not found', p_case_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_case.status = 'settled' THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'already_settled', 'bearer', v_case.bearer);
  END IF;
  IF v_case.status NOT IN ('open', 'awaiting_decision') THEN
    RAISE EXCEPTION 'card_case_settle: case % is %, not settleable', p_case_id, v_case.status USING ERRCODE = 'check_violation';
  END IF;
  -- Only a full-payment loss is booked here; a partial one goes to an admin.
  IF v_case.amount_minor <> v_case.card_minor OR v_case.card_minor <= 0 THEN
    RAISE EXCEPTION 'card_case_settle: case % amount % is not the card payment %', p_case_id, v_case.amount_minor, v_case.card_minor
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_o FROM orders WHERE id = v_case.order_id FOR UPDATE;
  IF v_o.status NOT IN ('paid', 'delivering', 'delivered', 'completed', 'disputed') THEN
    RAISE EXCEPTION 'card_case_settle: order % is already %', v_o.id, v_o.status USING ERRCODE = 'check_violation';
  END IF;
  v_gross    := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_wallet   := GREATEST(v_gross - v_case.card_minor, 0);
  v_released := v_o.completed_at IS NOT NULL AND v_o.status IN ('completed', 'disputed')
                AND v_o.escrow_status IN ('released', 'frozen');
  PERFORM set_config('app.card_case', 'on', true);

  IF p_bearer = 'seller' THEN
    IF v_o.status = 'completed' THEN
      -- completed → refunded is not a legal step: freeze first (own key).
      PERFORM safedrop_transition(v_o.id, 'ADMIN_DISPUTED', 'card_case:' || v_case.id::text);
    END IF;
    PERFORM safedrop_transition(v_o.id, 'REFUNDED', 'card_case:' || v_case.id::text);
    PERFORM money_fault_hook('card_case_settle:after_transition');
    PERFORM post_journal('card_case_out:' || v_case.id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','debit','amount_minor',v_case.card_minor,'currency',v_case.currency),
      jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','credit','amount_minor',v_case.card_minor,'currency',v_case.currency)),
      'CARD_LOSS_SELLER', v_o.id);
    IF v_wallet > 0 AND v_o.buyer_id IS NOT NULL THEN
      PERFORM wallet_credit(v_o.buyer_id, v_wallet, v_case.currency, 'refunds',
                            'card_case_wallet:' || v_case.id::text, 'REFUND_TO_WALLET', v_o.id);
    END IF;
  ELSE
    -- changed: a released order, or a held one the seller delivered.
    IF NOT v_released AND NOT (v_o.status = 'disputed'
         AND (v_o.delivered_at IS NOT NULL OR v_o.seller_marked_delivered_at IS NOT NULL
              OR v_o.instant_delivery_delivered_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'card_case_settle: DropMarket can absorb only a delivered order (order % is %)', v_o.id, v_o.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_o.status = 'disputed' THEN
      -- Released: unfreezes the seller share. Held: releases escrow to the seller.
      PERFORM safedrop_transition(v_o.id, 'DISPUTE_RESOLVED_SELLER', 'card_case:' || v_case.id::text);
    END IF;
    PERFORM money_fault_hook('card_case_settle:after_transition');
    PERFORM post_journal('card_case_out:' || v_case.id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_case.card_minor,'currency',v_case.currency),
      jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','credit','amount_minor',v_case.card_minor,'currency',v_case.currency)),
      'CARD_LOSS_PLATFORM', v_o.id);
  END IF;
  PERFORM money_fault_hook('card_case_settle:after_journal');

  -- The buyer got the card payment back either way: their claim is settled.
  PERFORM card_case_close_safedrop(v_case.id, v_o.id, CASE WHEN p_bearer = 'seller' THEN 'buyer' ELSE 'neutral' END);
  UPDATE card_cases SET status = 'settled', bearer = p_bearer, decided_by = p_actor_id, closed_at = now()
   WHERE id = v_case.id;
  IF p_bearer = 'seller' AND v_o.seller_id IS NOT NULL THEN
    PERFORM notify_once(v_o.seller_id, 'order_refunded', 'Order Refunded',
      '#' || COALESCE(v_o.order_number, LEFT(v_o.id::text, 8)) || ' — the card payment was returned to the buyer, so this sale is not paid out.',
      '/account/orders/' || v_o.id::text, 'card_case:' || v_case.id::text || ':seller');
  END IF;
  RETURN jsonb_build_object('settled', true, 'bearer', p_bearer, 'card_minor', v_case.card_minor,
                            'wallet_minor', CASE WHEN p_bearer = 'seller' THEN v_wallet ELSE 0 END);
END;
$$;

-- ── 4. Card dispute closed (changed: the lost branch) ───────────────────────
-- won (or an inquiry the bank closed): the hold lifts. A delivered order whose
-- only open dispute is the one this case opened is released to the seller;
-- otherwise (undelivered, or the buyer's own dispute is open) an admin
-- finishes it with the money controls.
-- lost, the full payment: delivered with proof → DropMarket pays (or an admin
-- decides while the buyer's own dispute is open); no proof → the seller pays.
-- lost, part of it: the hold lifts, an admin settles.
-- Unknown dispute: raise, so Stripe retries until the `created` event lands.
CREATE OR REPLACE FUNCTION public.card_dispute_close(p_ref text, p_outcome text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case    card_cases%ROWTYPE;
  v_o       orders%ROWTYPE;
  v_link    text;
  v_amount  text;
  v_others  boolean;
  v_proof   text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('won', 'lost') THEN
    RAISE EXCEPTION 'card_dispute_close: outcome must be won|lost' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_case FROM card_cases WHERE provider = 'stripe' AND provider_ref = p_ref AND kind = 'dispute' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_dispute_close: dispute % is not recorded yet', p_ref USING ERRCODE = 'no_data_found';
  END IF;
  v_link   := '/admin/orders/' || v_case.order_id::text || '?case=' || v_case.id::text;
  v_amount := '$' || to_char(v_case.amount_minor / 100.0, 'FM999999990.00');
  IF v_case.closed_at IS NOT NULL OR v_case.status IN ('won', 'settled') THEN
    RETURN jsonb_build_object('closed', false, 'reason', 'already_closed', 'status', v_case.status);
  END IF;
  IF v_case.status = 'awaiting_decision' THEN -- changed: a replay while an admin decides
    RETURN jsonb_build_object('closed', false, 'settled', false, 'reason', 'awaiting_decision');
  END IF;
  IF v_case.status = 'review' THEN
    UPDATE card_cases SET closed_at = now() WHERE id = v_case.id;
    PERFORM admin_alert_once('payment_review', 'Card Dispute ' || initcap(p_outcome) || ' · ' || v_amount,
      'Stripe closed a dispute that was only recorded for review. Nothing moved — check the order.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', p_outcome, 'moved', false);
  END IF;

  SELECT * INTO v_o FROM orders WHERE id = v_case.order_id FOR UPDATE;
  PERFORM set_config('app.card_case', 'on', true);
  v_others := EXISTS (SELECT 1 FROM disputes WHERE transaction_id = v_o.id
                       AND id IS DISTINCT FROM v_case.safedrop_dispute_id
                       AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed'));

  IF p_outcome = 'won' THEN
    UPDATE card_cases SET status = 'won', closed_at = now() WHERE id = v_case.id;
    IF v_o.status = 'disputed' AND NOT v_others
       AND (v_o.completed_at IS NOT NULL OR v_o.delivered_at IS NOT NULL OR v_o.seller_marked_delivered_at IS NOT NULL) THEN
      PERFORM safedrop_transition(v_o.id, 'DISPUTE_RESOLVED_SELLER', 'card_case:' || v_case.id::text);
      PERFORM card_case_close_safedrop(v_case.id, v_o.id, 'seller');
      PERFORM money_fault_hook('card_dispute_close:after_release');
      PERFORM admin_alert_once('payment_review', 'Card Dispute Won · ' || v_amount,
        'The bank sided with us. The order is released to the seller. The buyer stays blocked until you unblock them.', v_link);
    ELSE
      PERFORM admin_alert_once('payment_review', 'Card Dispute Won · ' || v_amount,
        CASE WHEN v_others THEN 'The bank sided with us, but the buyer''s own dispute is still open. Resolve it with the money controls.'
             ELSE 'The bank sided with us, but the order was never marked delivered. Finish it with the money controls.' END, v_link);
    END IF;
    RETURN jsonb_build_object('closed', true, 'outcome', 'won');
  END IF;

  IF v_case.amount_minor <> v_case.card_minor THEN
    UPDATE card_cases SET status = 'review', closed_at = now() WHERE id = v_case.id;
    PERFORM admin_alert_once('payment_review', 'Card Dispute Lost · ' || v_amount,
      'A partial chargeback: the bank returned ' || v_amount || ' to the card. Settle the order with the money controls, minding what the buyer already got back.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', false);
  END IF;

  -- changed: delivery proof decides who pays.
  v_proof := card_case_delivery_proof(v_o);
  IF v_proof IS NULL THEN
    PERFORM card_case_settle_internal(v_case.id, 'seller', NULL);
    PERFORM admin_alert_once('payment_review', 'Card Dispute Lost · ' || v_amount,
      'No delivery proof: the order is refunded and the seller is not paid.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', true, 'bearer', 'seller');
  END IF;

  IF v_others THEN
    UPDATE card_cases SET status = 'awaiting_decision' WHERE id = v_case.id;
    PERFORM admin_alert_once('payment_review', 'Card Dispute Lost: Choose Who Pays · ' || v_amount,
      'The bank sided with the buyer. The seller has delivery proof, but the buyer''s own dispute is open — check it, then choose Seller Pays or DropMarket Pays on the order page.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', false, 'reason', 'awaiting_decision');
  END IF;

  PERFORM card_case_settle_internal(v_case.id, 'platform', NULL);
  PERFORM admin_alert_once('payment_review', 'Card Dispute Lost · ' || v_amount,
    'Delivered with proof (' || CASE v_proof WHEN 'confirmed' THEN 'the buyer confirmed'
                                             WHEN 'opened' THEN 'the buyer opened the order after delivery'
                                             ELSE 'the seller''s delivery photo' END
    || '): DropMarket absorbs the loss; the seller keeps the sale.', v_link);
  RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', true, 'bearer', 'platform', 'proof', v_proof);
END;
$$;

-- ── 5. Grants: service role only ────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.order_access_record(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.card_case_delivery_proof(orders) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.card_case_settle_internal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.card_dispute_close(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_access_record(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.card_case_delivery_proof(orders) TO service_role;
GRANT EXECUTE ON FUNCTION public.card_case_settle_internal(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.card_dispute_close(text, text) TO service_role;
