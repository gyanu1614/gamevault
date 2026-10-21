-- "Cancel – Not Delivered" (owner 2026-10-16/19/20; docs/superpowers/plans/
-- 2026-10-16-not-delivered-cancel-and-refund-rule.md). Rewritten in place on
-- 2026-10-20 before it ever reached prod (owner approved): no auto-cancel.
--
-- Once a paid order's delivery time has passed the buyer can report it. The
-- seller is notified and has a RESPONSE WINDOW = the listing's delivery time,
-- clamped to 15 minutes .. 24 hours (computed by the server action from the
-- same parse the order page uses). A reply in the order chat or Start
-- delivery inside the window keeps the order open; Mark As Delivered or the
-- seller cancelling close the report too. Only reading a message does not
-- count.
--
-- When the window runs out with no response NOTHING cancels: the report
-- becomes `expired` (buyer + seller told) and the buyer can request
-- cancellation — a normal order_cancellation_requests row that an admin
-- reviews in Orders → Cancellation Requests, with an alert to every active
-- admin. The admin's approval runs the existing cancel seam (refund rule
-- 20261016194209: the item price as store credit, the full amount to the
-- card on request). The seller can still deliver until the admin acts;
-- delivery closes the report and the pending request.
--
-- No function here moves money. Every function is service-role only and
-- idempotent. Driven by the order page (sync on view / when the countdown
-- ends) and a 15-minute sweep that only marks expiry and sends the notices.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_not_delivered_claims (
  order_id                uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id                uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_at                  timestamptz NOT NULL,
  window_minutes          integer NOT NULL CHECK (window_minutes BETWEEN 15 AND 1440),
  opened_at               timestamptz NOT NULL DEFAULT now(),
  grace_ends_at           timestamptz NOT NULL,
  status                  text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'withdrawn', 'seller_responded', 'expired', 'cancel_requested',
                                            'delivered', 'disputed', 'cancelled')),
  responded_at            timestamptz,
  response_kind           text CHECK (response_kind IN ('message', 'started_delivery')),
  cancellation_request_id uuid REFERENCES public.order_cancellation_requests(id) ON DELETE SET NULL,
  closed_at               timestamptz
);
CREATE INDEX IF NOT EXISTS order_not_delivered_claims_due_idx
  ON public.order_not_delivered_claims (grace_ends_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS order_not_delivered_claims_request_idx
  ON public.order_not_delivered_claims (cancellation_request_id) WHERE cancellation_request_id IS NOT NULL;
ALTER TABLE public.order_not_delivered_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_not_delivered_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_not_delivered_claims TO service_role;
COMMENT ON TABLE public.order_not_delivered_claims IS
  'One per order: the buyer reported non-delivery after the delivery time; the seller has window_minutes (the delivery time, 15 min .. 24 h) to respond. No response → expired → the buyer may file an admin-reviewed cancellation request (cancellation_request_id). Never moves money. Service-role only.';

-- "20 minutes", "1 hour", "24 hours".
CREATE OR REPLACE FUNCTION public.order_not_delivered_span(p_minutes integer)
  RETURNS text
  LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_minutes % 60 = 0
              THEN (p_minutes / 60)::text || CASE WHEN p_minutes = 60 THEN ' hour' ELSE ' hours' END
              ELSE p_minutes::text || ' minutes' END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_span(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_span(integer) TO service_role;

-- ── 2. Open (the buyer reports) ──────────────────────────────────────────────
-- p_due_at and p_window_minutes come from the server action
-- (lib/orders/not-delivered.ts: the listing's delivery time, as the order
-- page's timer reads it); the window is clamped here again.
CREATE OR REPLACE FUNCTION public.order_not_delivered_open(
  p_order_id uuid, p_buyer_id uuid, p_due_at timestamptz, p_window_minutes integer)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o      RECORD;
  v_c      RECORD;
  v_window integer;
  v_ends   timestamptz;
  v_ref    text;
  v_span   text;
  v_tag    text;
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
    RETURN jsonb_build_object('ok', true, 'already', true, 'grace_ends_at', v_c.grace_ends_at, 'window_minutes', v_c.window_minutes);
  END IF;
  IF FOUND AND v_c.status <> 'withdrawn' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_c.status);
  END IF;
  v_window := LEAST(GREATEST(COALESCE(p_window_minutes, 60), 15), 1440);
  v_ends   := now() + make_interval(mins => v_window);
  INSERT INTO order_not_delivered_claims (order_id, buyer_id, seller_id, due_at, window_minutes, grace_ends_at)
  VALUES (p_order_id, v_o.buyer_id, v_o.seller_id, p_due_at, v_window, v_ends)
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'open', opened_at = now(), due_at = EXCLUDED.due_at, window_minutes = EXCLUDED.window_minutes,
        grace_ends_at = EXCLUDED.grace_ends_at, responded_at = NULL, response_kind = NULL,
        cancellation_request_id = NULL, closed_at = NULL;

  v_ref  := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  v_span := order_not_delivered_span(v_window);
  v_tag  := 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_ends)::bigint::text;
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Reply Now Or The Buyer Can Cancel',
    'The buyer reported order #' || v_ref || ' as not delivered. Reply in the order chat or start delivery within ' || v_span ||
    '. If you don''t, the buyer can ask DropMarket to cancel the order, and it counts against your record.',
    '/account/orders/' || p_order_id::text, v_tag || ':seller');
  PERFORM notify_once(v_o.buyer_id, 'order_not_delivered', 'Seller Notified',
    'We asked the seller to reply or deliver order #' || v_ref || ' within ' || v_span ||
    '. If they don''t respond by then, you can request cancellation from the order page and our team will review it.',
    '/account/orders/' || p_order_id::text, v_tag || ':buyer');
  RETURN jsonb_build_object('ok', true, 'already', false, 'grace_ends_at', v_ends, 'window_minutes', v_window);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz, integer) TO service_role;
COMMENT ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz, integer) IS
  'Cancel – Not Delivered: the buyer reports an overdue paid/delivering order; starts the seller''s response window (15 min .. 24 h) and notifies both parties. Idempotent (an open report is returned; a withdrawn one restarts). Service-role only.';

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

-- ── 4. The seller responded inside the window ───────────────────────────────
-- The report closes, the order stays open, the buyer is told. Only a response
-- made inside [opened_at, grace_ends_at) counts. Idempotent.
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

-- ── 5. Sync (order page / sweep / admin) — never moves money ────────────────
-- Brings the report in line with the order: closes it (and a pending linked
-- request) when the order was delivered / disputed / cancelled; records a
-- seller response made inside the window; marks it expired once the window
-- is over with no response (and tells both sides); puts a cancel_requested
-- report back to expired when its request was withdrawn or rejected.
CREATE OR REPLACE FUNCTION public.order_not_delivered_sync(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o       RECORD;
  v_c       RECORD;
  v_status  text;
  v_req     text;
  v_kind    text := NULL;
  v_resp_at timestamptz := NULL;
  v_ref     text;
  v_tag     text;
BEGIN
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_c.status NOT IN ('open', 'expired', 'cancel_requested') THEN
    RETURN jsonb_build_object('synced', false, 'reason', 'no_open_claim', 'status', v_c.status);
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;

  -- The order moved on: close the report and any pending request it filed.
  IF v_o.delivered_at IS NOT NULL OR v_o.status NOT IN ('paid', 'delivering') THEN
    v_status := CASE
      WHEN v_o.delivered_at IS NOT NULL OR v_o.status IN ('delivered', 'completed') THEN 'delivered'
      WHEN v_o.status = 'disputed' THEN 'disputed'
      ELSE 'cancelled' END;
    UPDATE order_not_delivered_claims SET status = v_status, closed_at = now() WHERE order_id = p_order_id;
    IF v_c.cancellation_request_id IS NOT NULL THEN
      UPDATE order_cancellation_requests
         SET status = 'closed', processed_at = now(),
             admin_notes = COALESCE(admin_notes, CASE v_status
               WHEN 'delivered' THEN 'Closed automatically: the seller delivered the order.'
               WHEN 'disputed'  THEN 'Closed automatically: the order went to a dispute.'
               ELSE 'Closed automatically: the order was cancelled.' END)
       WHERE id = v_c.cancellation_request_id AND status = 'pending';
    END IF;
    RETURN jsonb_build_object('synced', true, 'outcome', v_status);
  END IF;

  -- A filed request: back to expired if the buyer withdrew it or an admin
  -- rejected it; otherwise it waits for the admin.
  IF v_c.status = 'cancel_requested' THEN
    SELECT status INTO v_req FROM order_cancellation_requests WHERE id = v_c.cancellation_request_id;
    IF v_c.cancellation_request_id IS NULL OR v_req IS NULL OR v_req IN ('rejected', 'closed') THEN
      UPDATE order_not_delivered_claims SET status = 'expired', cancellation_request_id = NULL WHERE order_id = p_order_id;
      RETURN jsonb_build_object('synced', true, 'outcome', 'expired');
    END IF;
    RETURN jsonb_build_object('synced', false, 'reason', 'awaiting_admin');
  END IF;
  IF v_c.status = 'expired' THEN
    RETURN jsonb_build_object('synced', false, 'reason', 'expired');
  END IF;

  -- Open: the seller responded inside the window (Start delivery, or a chat
  -- reply the message trigger did not already record).
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
    RETURN jsonb_build_object('synced', true, 'outcome', 'seller_responded');
  END IF;

  IF now() < v_c.grace_ends_at THEN
    RETURN jsonb_build_object('synced', false, 'reason', 'window', 'grace_ends_at', v_c.grace_ends_at);
  END IF;

  -- The window is over with no response: expired. Nothing is cancelled.
  UPDATE order_not_delivered_claims SET status = 'expired' WHERE order_id = p_order_id;
  v_ref := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  v_tag := 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_c.grace_ends_at)::bigint::text;
  PERFORM notify_once(v_o.buyer_id, 'order_not_delivered', 'Seller Did Not Respond',
    'The seller didn''t reply or start delivery on order #' || v_ref || ' in time. You can now request cancellation from the order page; our team will review it.',
    '/account/orders/' || p_order_id::text, v_tag || ':expired:buyer');
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Deliver Now To Keep The Order',
    'You didn''t respond to the non-delivery report on order #' || v_ref || '. The buyer can now ask DropMarket to cancel it, which counts against your record. Deliver now to keep the order.',
    '/account/orders/' || p_order_id::text, v_tag || ':expired:seller');
  RETURN jsonb_build_object('synced', true, 'outcome', 'expired');
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_sync(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_sync(uuid) TO service_role;
COMMENT ON FUNCTION public.order_not_delivered_sync(uuid) IS
  'Cancel – Not Delivered: closes a report (and its pending request) to match the order, records a seller response inside the window, or marks it expired once the window ends (no cancel, no money). Idempotent. Service-role only.';

-- ── 6. Request cancellation (the window ran out) ────────────────────────────
-- Files ONE pending order_cancellation_requests row for an admin to review
-- (Orders → Cancellation Requests) and alerts every active admin. No money.
CREATE OR REPLACE FUNCTION public.order_not_delivered_request_cancel(p_order_id uuid, p_buyer_id uuid, p_note text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o      RECORD;
  v_c      RECORD;
  v_req_id uuid;
  v_ref    text;
  v_span   text;
  v_reason text;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_o.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  -- Bring the report up to date first (expires it if the window just ended).
  PERFORM order_not_delivered_sync(p_order_id);
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_claim');
  END IF;
  IF v_c.status = 'cancel_requested' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exists', 'request_id', v_c.cancellation_request_id);
  END IF;
  IF v_c.status = 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_expired', 'grace_ends_at', v_c.grace_ends_at);
  END IF;
  IF v_c.status <> 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_c.status);
  END IF;
  -- A request already pending through the long-delivery route: reuse it.
  SELECT id INTO v_req_id FROM order_cancellation_requests WHERE order_id = p_order_id AND status = 'pending' LIMIT 1;
  v_span := order_not_delivered_span(v_c.window_minutes);
  IF v_req_id IS NULL THEN
    v_reason := 'Not delivered: the seller did not reply or start delivery within ' || v_span || ' of the report.' ||
                CASE WHEN COALESCE(btrim(p_note), '') <> '' THEN ' Buyer: ' || LEFT(btrim(p_note), 500) ELSE '' END;
    INSERT INTO order_cancellation_requests (order_id, buyer_id, reason, status)
    VALUES (p_order_id, p_buyer_id, v_reason, 'pending')
    RETURNING id INTO v_req_id;
  END IF;
  UPDATE order_not_delivered_claims SET status = 'cancel_requested', cancellation_request_id = v_req_id WHERE order_id = p_order_id;

  v_ref := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  PERFORM admin_alert_once('order_review', 'Cancellation Request — Not Delivered #' || v_ref,
    'Order #' || v_ref || ': the seller did not reply or start delivery within ' || v_span ||
    ' of the buyer''s report. Review it in Orders → Cancellation Requests (Seller At Fault is on by default).',
    '/admin/orders?tab=cancellations');
  RETURN jsonb_build_object('ok', true, 'request_id', v_req_id);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_request_cancel(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_request_cancel(uuid, uuid, text) TO service_role;
COMMENT ON FUNCTION public.order_not_delivered_request_cancel(uuid, uuid, text) IS
  'Cancel – Not Delivered: once the seller''s response window has run out, files one pending order_cancellation_requests row for admin review, links it to the report and alerts every active admin. No money. Service-role only.';

-- ── 7. The sweep's list (expiry notices only) ───────────────────────────────
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
