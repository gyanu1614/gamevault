-- ============================================================================
-- Fee engine PR 7, Part 2 — disputes as single RPCs.
-- Idempotent: safe to re-run.
--
-- Before: openDispute wrote orders.status/escrow_status directly (service
-- role) and inserted the disputes row separately; resolveDispute composed
-- transition() + refundToWallet() + two more writes from TypeScript; a
-- completed order could not be disputed at all; notifications had no dedupe.
--
-- After:
--   order_dispute_open(order, actor, role, reason, title, description)
--     · buyer: owns the order, status ∈ paid/delivering/delivered/completed,
--       and — once delivered — inside platform_fee_settings.dispute_window_days;
--     · admin: any of those statuses, no window (support-ticket path);
--     · one open dispute per order (partial unique index);
--     · BUYER_DISPUTED / ADMIN_DISPUTED through safedrop_transition — before
--       completion nothing is credited and auto-complete is blocked (status
--       leaves `delivered`); after completion the seller amount is frozen;
--     · disputes row + order_dispute_events audit row + notify_once ×2.
--   order_dispute_resolve(dispute, admin, outcome, refund_minor, notes)
--     · release  → DISPUTE_RESOLVED_SELLER (unfreeze after completion);
--     · refund_full → order_refund_to_wallet (the existing refund RPC; the
--       post-completion branch debits seller_frozen + platform commission);
--     · refund_partial → DISPUTE_PARTIAL + buyer wallet credit
--       (wallet_refund:<order>:partial:<dispute>);
--     · disputes + dispute_resolutions + order_dispute_events + notify_once ×2.
--   The seller's matured balance may go NEGATIVE after a refund; withdrawals
--   refuse while it is (Part 3) and later sale credits net against it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.order_disputes_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.order_disputes_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_disputes_version() TO service_role;

-- ── 1. Audit trail: every transition, actor and reason ──────────────────────
CREATE TABLE IF NOT EXISTS public.order_dispute_events (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispute_id         uuid REFERENCES public.disputes(id) ON DELETE CASCADE,
  order_id           uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role         text NOT NULL CHECK (actor_role IN ('buyer', 'admin', 'system')),
  action             text NOT NULL CHECK (action IN ('opened', 'admin_opened', 'resolved_release', 'resolved_refund_full', 'resolved_refund_partial')),
  reason             text,
  refund_minor       bigint NOT NULL DEFAULT 0 CHECK (refund_minor >= 0),
  seller_side_minor  bigint NOT NULL DEFAULT 0 CHECK (seller_side_minor >= 0),
  post_completion    boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.order_dispute_events IS
  'Append-only audit of dispute transitions (who, what, why, how much). Written only by order_dispute_open / order_dispute_resolve. Service-role only.';
CREATE INDEX IF NOT EXISTS order_dispute_events_order_idx ON public.order_dispute_events (order_id, created_at DESC);
ALTER TABLE public.order_dispute_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_dispute_events FROM PUBLIC, anon, authenticated;

-- ── 2. One open dispute per order ───────────────────────────────────────────
DO $$
DECLARE v_dupes INT;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT transaction_id FROM public.disputes
     WHERE transaction_id IS NOT NULL
       AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed')
     GROUP BY transaction_id HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'order_disputes: % order(s) have more than one OPEN dispute — close the duplicates (status=closed) before applying this migration', v_dupes;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_order
  ON public.disputes (transaction_id)
  WHERE status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed');

-- ── 3. Open ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_dispute_open(
  p_order_id uuid, p_actor_id uuid, p_actor_role text, p_reason text, p_title text, p_description text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_existing   UUID;
  v_days       INT;
  v_window_end TIMESTAMPTZ;
  v_event      TEXT;
  v_t          JSONB;
  v_dispute_id UUID;
  v_ref        TEXT;
  v_post       BOOLEAN;
  v_reason     dispute_reason_enum;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_actor_role NOT IN ('buyer', 'admin') THEN
    RAISE EXCEPTION 'order_dispute_open: actor role must be buyer or admin' USING ERRCODE = 'check_violation';
  END IF;
  BEGIN
    v_reason := COALESCE(p_reason, 'other')::dispute_reason_enum;
  EXCEPTION WHEN invalid_text_representation THEN
    v_reason := 'other';
  END;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR (p_actor_role = 'buyer' AND v_order.buyer_id IS DISTINCT FROM p_actor_id) THEN
    RETURN jsonb_build_object('opened', false, 'reason', 'not_found');
  END IF;
  -- An open dispute wins over the status check: a `disputed` order answers
  -- already_open (with the id), not not_disputable.
  SELECT id INTO v_existing FROM disputes
   WHERE transaction_id = p_order_id
     AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('opened', false, 'reason', 'already_open', 'dispute_id', v_existing);
  END IF;
  IF v_order.status NOT IN ('paid', 'delivering', 'delivered', 'completed') THEN
    RETURN jsonb_build_object('opened', false, 'reason', 'not_disputable', 'status', v_order.status);
  END IF;

  SELECT dispute_window_days INTO v_days FROM platform_fee_settings WHERE id;
  v_window_end := CASE WHEN v_order.delivered_at IS NULL THEN NULL
                       ELSE v_order.delivered_at + make_interval(days => COALESCE(v_days, 7)) END;
  IF p_actor_role = 'buyer' AND v_window_end IS NOT NULL AND now() > v_window_end THEN
    RETURN jsonb_build_object('opened', false, 'reason', 'window_closed', 'window_ends_at', v_window_end, 'window_days', v_days);
  END IF;

  v_event := CASE WHEN p_actor_role = 'admin' THEN 'ADMIN_DISPUTED' ELSE 'BUYER_DISPUTED' END;
  v_t := safedrop_transition(p_order_id, v_event, NULL, NULL, NULL);
  v_post := COALESCE((v_t->>'released_before')::boolean, false);
  PERFORM money_fault_hook('order_dispute_open:after_transition');

  UPDATE orders SET dispute_reason = LEFT(COALESCE(p_description, ''), 2000) WHERE id = p_order_id;

  v_ref := COALESCE(v_order.order_number, LEFT(p_order_id::text, 8));
  INSERT INTO disputes (transaction_id, order_reference, buyer_id, seller_id, reason, title, description,
                        disputed_amount, currency, status, priority)
  VALUES (p_order_id, v_ref, v_order.buyer_id, v_order.seller_id, v_reason,
          LEFT(COALESCE(NULLIF(p_title, ''), 'Order #' || v_ref), 200),
          LEFT(COALESCE(NULLIF(p_description, ''), 'Opened by the DropMarket team'), 4000),
          COALESCE(v_order.total_amount, 0), UPPER(COALESCE(v_order.currency, 'USD')),
          'open', CASE WHEN p_actor_role = 'admin' THEN 'high' ELSE 'normal' END)
  RETURNING id INTO v_dispute_id;

  INSERT INTO order_dispute_events (dispute_id, order_id, actor_id, actor_role, action, reason, post_completion)
  VALUES (v_dispute_id, p_order_id, p_actor_id, p_actor_role,
          CASE WHEN p_actor_role = 'admin' THEN 'admin_opened' ELSE 'opened' END,
          LEFT(COALESCE(p_description, ''), 2000), v_post);

  PERFORM notify_once(v_order.seller_id, 'dispute_opened', 'Dispute Opened',
    '#' || v_ref || ' — a buyer issue is under review. Please respond promptly from the order page.',
    '/account/orders/' || p_order_id::text, 'dispute:' || v_dispute_id::text || ':opened:seller');
  PERFORM notify_once(v_order.buyer_id, 'dispute_opened',
    CASE WHEN p_actor_role = 'admin' THEN 'Order Under Review' ELSE 'Dispute Submitted' END,
    CASE WHEN p_actor_role = 'admin'
         THEN '#' || v_ref || ' — our team opened a review of this order for you. We will keep you posted.'
         ELSE '#' || v_ref || ' — we will keep you posted.' END,
    '/account/orders/' || p_order_id::text, 'dispute:' || v_dispute_id::text || ':opened:buyer');

  RETURN jsonb_build_object(
    'opened', true, 'dispute_id', v_dispute_id, 'event', v_event, 'post_completion', v_post,
    'frozen_minor', CASE WHEN v_post THEN (v_t->>'seller_minor')::bigint ELSE 0 END,
    'order_number', v_order.order_number, 'buyer_id', v_order.buyer_id, 'seller_id', v_order.seller_id,
    'window_ends_at', v_window_end);
END;
$$;
REVOKE ALL ON FUNCTION public.order_dispute_open(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_dispute_open(uuid, uuid, text, text, text, text) TO service_role;

-- ── 4. Resolve (admin only — the caller checks the permission) ──────────────
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
  PERFORM notify_once(v_order.seller_id, 'dispute_resolved', 'Dispute Resolved',
    CASE p_outcome
      WHEN 'release' THEN 'The dispute for order #' || v_ref || ' was resolved in your favour. Your payout is available again.'
      WHEN 'refund_full' THEN 'The dispute for order #' || v_ref || ' was resolved in the buyer''s favour — $' || to_char(v_seller_side::numeric / 100, 'FM999999990.00') || ' was deducted from your balance.'
      ELSE 'The dispute for order #' || v_ref || ' was resolved with a partial refund — $' || to_char(v_seller_side::numeric / 100, 'FM999999990.00') || ' was deducted from your balance.'
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
