-- "Cancel – Not Delivered" (owner 2026-10-16/19; docs/superpowers/plans/
-- 2026-10-16-not-delivered-cancel-and-refund-rule.md, PR 2).
--
-- Once a paid order's delivery time has passed the buyer can report it. The
-- seller is notified and gets not_delivered_grace_minutes (60) to RESPOND:
-- a reply in the order chat or Start delivery (order_mark_delivering) keeps
-- the order open; Mark As Delivered or the seller cancelling close it too.
-- Only reading a message does not count (owner, 2026-10-19).
--
-- No response by the end of the hour → order_not_delivered_finalize cancels
-- through the existing money seams as a SELLER fault (dedupe key
-- not_delivered:<order> → fault source not_delivered): the item price as
-- store credit, the fee kept, the full amount to the card on request
-- (refund rule, 20261016194209). No money function changes here.
--
-- The claim row is the state. Every function is service-role only and
-- idempotent. Driven by the order page (finalize on view when the countdown
-- ends) and a 15-minute sweep (/api/cron/not-delivered-sweep).

-- ── 1. Setting + table ───────────────────────────────────────────────────────
ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS not_delivered_grace_minutes integer NOT NULL DEFAULT 60
    CHECK (not_delivered_grace_minutes BETWEEN 5 AND 1440);
COMMENT ON COLUMN public.platform_fee_settings.not_delivered_grace_minutes IS
  'Cancel – Not Delivered: minutes the seller has to reply or start delivery after the buyer reports an overdue order.';

CREATE TABLE IF NOT EXISTS public.order_not_delivered_claims (
  order_id       uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_at         timestamptz NOT NULL,
  opened_at      timestamptz NOT NULL DEFAULT now(),
  grace_ends_at  timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'withdrawn', 'seller_responded', 'delivered', 'disputed', 'cancelled', 'auto_cancelled')),
  responded_at   timestamptz,
  response_kind  text CHECK (response_kind IN ('message', 'started_delivery')),
  closed_at      timestamptz,
  credited_minor bigint
);
CREATE INDEX IF NOT EXISTS order_not_delivered_claims_due_idx
  ON public.order_not_delivered_claims (grace_ends_at) WHERE status = 'open';
ALTER TABLE public.order_not_delivered_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_not_delivered_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_not_delivered_claims TO service_role;
COMMENT ON TABLE public.order_not_delivered_claims IS
  'One per order: the buyer reported non-delivery after the delivery time; the order auto-cancels at grace_ends_at unless the seller responds or delivers first. Service-role only (the order page reads it through a session-checked action).';

-- ── 2. Open (the buyer reports) ──────────────────────────────────────────────
-- p_due_at is computed by the server action from the listing's delivery time
-- (lib/orders/not-delivered.ts, the same rule as the order page's timer).
CREATE OR REPLACE FUNCTION public.order_not_delivered_open(p_order_id uuid, p_buyer_id uuid, p_due_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o     RECORD;
  v_c     RECORD;
  v_grace integer;
  v_ends  timestamptz;
  v_ref   text;
  v_span  text;
  v_tag   text;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_o.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  IF v_o.status NOT IN ('paid', 'delivering') OR v_o.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open', 'status', v_o.status);
  END IF;
  IF p_due_at IS NULL OR now() < p_due_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_overdue', 'due_at', p_due_at);
  END IF;
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF FOUND AND v_c.status = 'open' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'grace_ends_at', v_c.grace_ends_at);
  END IF;
  IF FOUND AND v_c.status <> 'withdrawn' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_c.status);
  END IF;
  SELECT not_delivered_grace_minutes INTO v_grace FROM platform_fee_settings WHERE id;
  v_grace := COALESCE(v_grace, 60);
  v_ends  := now() + make_interval(mins => v_grace);
  INSERT INTO order_not_delivered_claims (order_id, buyer_id, seller_id, due_at, grace_ends_at)
  VALUES (p_order_id, v_o.buyer_id, v_o.seller_id, p_due_at, v_ends)
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'open', opened_at = now(), due_at = EXCLUDED.due_at, grace_ends_at = EXCLUDED.grace_ends_at,
        responded_at = NULL, response_kind = NULL, closed_at = NULL;

  PERFORM money_fault_hook('order_not_delivered_open:after_claim');

  v_ref  := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  v_span := CASE WHEN v_grace % 60 = 0
                 THEN (v_grace / 60)::text || CASE WHEN v_grace = 60 THEN ' hour' ELSE ' hours' END
                 ELSE v_grace::text || ' minutes' END;
  v_tag  := 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_ends)::bigint::text;
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Reply Now Or The Order Cancels',
    'The buyer reported order #' || v_ref || ' as not delivered. Reply in the order chat or start delivery within ' || v_span ||
    ', or the order is cancelled, the buyer is refunded, and it counts against your record.',
    '/account/orders/' || p_order_id::text, v_tag || ':seller');
  PERFORM notify_once(v_o.buyer_id, 'order_not_delivered', 'Seller Notified',
    'We asked the seller to reply or deliver order #' || v_ref || ' within ' || v_span ||
    '. If they don''t respond by then, the order is cancelled and refunded to your Store Balance automatically.',
    '/account/orders/' || p_order_id::text, v_tag || ':buyer');
  RETURN jsonb_build_object('ok', true, 'already', false, 'grace_ends_at', v_ends, 'grace_minutes', v_grace);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz) TO service_role;
COMMENT ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz) IS
  'Cancel – Not Delivered: the buyer reports an overdue paid/delivering order; starts the grace hour and notifies both parties. Idempotent (an open report is returned; a withdrawn one restarts). Service-role only.';

-- ── 3. Withdraw (the buyer keeps waiting) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_not_delivered_withdraw(p_order_id uuid, p_buyer_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c RECORD;
BEGIN
  UPDATE order_not_delivered_claims SET status = 'withdrawn', closed_at = now()
   WHERE order_id = p_order_id AND buyer_id = p_buyer_id AND status = 'open'
  RETURNING * INTO v_c;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_claim');
  END IF;
  PERFORM notify_once(v_c.seller_id, 'order_not_delivered', 'Buyer Is Waiting',
    'The buyer withdrew the non-delivery report and is waiting for the order. Please deliver it as soon as you can.',
    '/account/orders/' || p_order_id::text,
    'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_c.grace_ends_at)::bigint::text || ':withdrawn');
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_withdraw(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_withdraw(uuid, uuid) TO service_role;

-- ── 4. The seller responded inside the hour ─────────────────────────────────
-- The report closes, the order stays open, the buyer is told. Only a response
-- made BEFORE grace_ends_at counts. Idempotent.
CREATE OR REPLACE FUNCTION public.order_not_delivered_mark_responded(p_order_id uuid, p_kind text, p_at timestamptz)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c   RECORD;
  v_ref text;
BEGIN
  IF p_kind NOT IN ('message', 'started_delivery') THEN
    RAISE EXCEPTION 'order_not_delivered_mark_responded: kind must be message|started_delivery, got %', p_kind USING ERRCODE = 'check_violation';
  END IF;
  UPDATE order_not_delivered_claims
     SET status = 'seller_responded', responded_at = p_at, response_kind = p_kind, closed_at = now()
   WHERE order_id = p_order_id AND status = 'open' AND p_at >= opened_at AND p_at < grace_ends_at
  RETURNING * INTO v_c;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  SELECT COALESCE(order_number, UPPER(LEFT(id::text, 8))) INTO v_ref FROM orders WHERE id = p_order_id;
  PERFORM notify_once(v_c.buyer_id, 'order_not_delivered', 'Seller Responded',
    CASE p_kind WHEN 'started_delivery' THEN 'The seller started delivering order #' || v_ref || '.'
                ELSE 'The seller replied about order #' || v_ref || ' — check the order chat.' END ||
    ' Your order stays open. If it still doesn''t arrive, open a dispute from the order page.',
    '/account/orders/' || p_order_id::text,
    'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_c.grace_ends_at)::bigint::text || ':responded');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_mark_responded(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_mark_responded(uuid, text, timestamptz) TO service_role;

-- A seller chat message closes an open report at once (the buyer's countdown
-- stops). Cheap: the WHEN clause skips system notices, and only a message by
-- the conversation's seller on an order chat with an open report does work.
CREATE OR REPLACE FUNCTION public.trg_messages_not_delivered_response() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order uuid;
BEGIN
  SELECT cv.order_id INTO v_order FROM conversations cv
   WHERE cv.id = NEW.conversation_id AND cv.seller_id = NEW.sender_id AND cv.order_id IS NOT NULL;
  IF v_order IS NOT NULL
     AND EXISTS (SELECT 1 FROM order_not_delivered_claims WHERE order_id = v_order AND status = 'open') THEN
    PERFORM order_not_delivered_mark_responded(v_order, 'message', NEW.created_at);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_messages_not_delivered_response() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_messages_not_delivered_response ON public.messages;
CREATE TRIGGER trg_messages_not_delivered_response AFTER INSERT ON public.messages
  FOR EACH ROW WHEN (NEW.sender_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_messages_not_delivered_response();

-- ── 5. Finalize (end of the hour, or the order moved on) ────────────────────
CREATE OR REPLACE FUNCTION public.order_not_delivered_finalize(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o       RECORD;
  v_c       RECORD;
  v_r       jsonb;
  v_status  text;
  v_key     text := 'not_delivered:' || p_order_id::text;
  v_ref     text;
  v_total   bigint;
  v_credit  bigint;
  v_kind    text := NULL;
  v_resp_at timestamptz := NULL;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  -- Lock order: the order, then the claim (the refund seams lock the order too).
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_c.status <> 'open' THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'no_open_claim', 'status', v_c.status);
  END IF;

  -- The order moved on (delivered, disputed, cancelled by the seller/admin): close to match.
  IF v_o.delivered_at IS NOT NULL OR v_o.status NOT IN ('paid', 'delivering') THEN
    v_status := CASE
      WHEN v_o.delivered_at IS NOT NULL OR v_o.status IN ('delivered', 'completed') THEN 'delivered'
      WHEN v_o.status = 'disputed' THEN 'disputed'
      ELSE 'cancelled' END;
    UPDATE order_not_delivered_claims SET status = v_status, closed_at = now() WHERE order_id = p_order_id;
    RETURN jsonb_build_object('finalized', true, 'outcome', v_status);
  END IF;

  -- The seller responded inside the hour: Start delivery, or a chat reply the
  -- message trigger did not already record.
  IF v_o.delivering_at IS NOT NULL AND v_o.delivering_at >= v_c.opened_at AND v_o.delivering_at < v_c.grace_ends_at THEN
    v_kind := 'started_delivery';
    v_resp_at := v_o.delivering_at;
  ELSE
    SELECT MIN(m.created_at) INTO v_resp_at
      FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
     WHERE cv.order_id = p_order_id AND m.sender_id = v_o.seller_id
       AND m.created_at >= v_c.opened_at AND m.created_at < v_c.grace_ends_at;
    IF v_resp_at IS NOT NULL THEN
      v_kind := 'message';
    END IF;
  END IF;
  IF v_kind IS NOT NULL AND order_not_delivered_mark_responded(p_order_id, v_kind, v_resp_at) THEN
    RETURN jsonb_build_object('finalized', true, 'outcome', 'seller_responded');
  END IF;

  IF now() < v_c.grace_ends_at THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'grace', 'grace_ends_at', v_c.grace_ends_at);
  END IF;

  -- No response in the hour: a SELLER-fault cancel through the money seams.
  IF v_o.status = 'paid' THEN
    v_r := order_cancel_return_wallet(p_order_id, v_key, true, NULL, NULL, 'void', NULL, 'seller');
  ELSE
    v_r := order_refund_to_wallet(p_order_id, v_key, NULL, 'seller');
  END IF;
  IF COALESCE((v_r->>'refused')::boolean, false) THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'refused');
  END IF;

  PERFORM money_fault_hook('order_not_delivered_finalize:after_refund');

  v_total  := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_credit := COALESCE((v_r->>'credited_minor')::bigint, v_total);
  UPDATE order_not_delivered_claims SET status = 'auto_cancelled', closed_at = now(), credited_minor = v_credit
   WHERE order_id = p_order_id;
  v_ref := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  PERFORM notify_once(v_o.buyer_id, 'order_refunded', 'Order Cancelled, Refunded',
    'Order #' || v_ref || ' was not delivered in time. $' || to_char(v_credit::numeric / 100, 'FM999999990.00') ||
    ' was added to your Store Balance — spend it with no service fee.' ||
    CASE WHEN v_credit < v_total
         THEN ' Want the full $' || to_char(v_total::numeric / 100, 'FM999999990.00') || ' back to your payment method? Request it from your Wallet.'
         ELSE '' END,
    '/account/wallet', v_key || ':buyer');
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Order Cancelled — Not Delivered',
    'Order #' || v_ref || ' was cancelled because the buyer reported it as not delivered and you did not respond in time. The buyer was refunded and this counts against your record.',
    '/account/orders/' || p_order_id::text, v_key || ':seller');
  RETURN v_r || jsonb_build_object('finalized', true, 'outcome', 'auto_cancelled', 'credited_minor', v_credit, 'total_minor', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_finalize(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_finalize(uuid) TO service_role;
COMMENT ON FUNCTION public.order_not_delivered_finalize(uuid) IS
  'Cancel – Not Delivered: closes an open report to match the order (delivered / disputed / cancelled), records a seller response inside the hour, or — once the hour is up with no response — cancels as a seller fault through order_cancel_return_wallet / order_refund_to_wallet (key not_delivered:<order>). Idempotent. Service-role only.';

-- ── 6. The sweep's list ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_not_delivered_due(p_limit integer DEFAULT 50)
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT order_id FROM order_not_delivered_claims
   WHERE status = 'open' AND grace_ends_at <= now()
   ORDER BY grace_ends_at
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_due(integer) TO service_role;
