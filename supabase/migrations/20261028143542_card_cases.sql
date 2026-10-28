-- ─────────────────────────────────────────────────────────────────────────────
-- Card safeguards (2026-10-28) — owner decisions of 2026-10-27, built before
-- the Stripe card row is switched on.
--
--   1. A FULL card refund made outside DropMarket (Stripe dashboard) is booked
--      as "refunded to card": never a store credit on top (no double pay).
--      Before completion the order is refunded and the seller never credited.
--      After completion the seller share is frozen and an admin picks who pays.
--   2. A card dispute (chargeback) holds the order — and, once completed, the
--      seller share — and blocks the buyer until Stripe decides. Won: released
--      to the seller. Lost: the same settle seam; the seller pays only without
--      delivery proof (delivered AND buyer confirmed), else DropMarket absorbs.
--   3. A blocked buyer cannot check out.
--
-- card_cases is the record; every money step is ONE service-role function
-- (SECURITY DEFINER, search_path pinned, money_fault_hook points). While a
-- case is open or awaiting a decision, its order cannot leave `disputed` by
-- any other path (trg_orders_card_case_guard): no SafeDrop resolution or
-- wallet refund can pay the buyer a second time.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tables ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_cases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind                  text NOT NULL CHECK (kind IN ('refund', 'dispute')),
  provider              text NOT NULL DEFAULT 'stripe',
  -- dp_… for a dispute; <charge id>:refund for an external refund.
  provider_ref          text NOT NULL,
  amount_minor          bigint NOT NULL CHECK (amount_minor > 0),
  -- What the card paid for the order (CHARGE_CONFIRMED journal) at open time.
  card_minor            bigint NOT NULL CHECK (card_minor >= 0),
  currency              char(3) NOT NULL,
  reason                text,
  -- open: dispute running · awaiting_decision: money held, an admin picks the
  -- bearer · review: recorded, nothing held or moved, a human looks ·
  -- won: released · settled: the loss is booked against `bearer`.
  status                text NOT NULL CHECK (status IN ('open', 'awaiting_decision', 'review', 'won', 'settled')),
  bearer                text CHECK (bearer IN ('seller', 'platform')),
  evidence_due_by       timestamptz,
  evidence_submitted_at timestamptz,
  decided_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  closed_at             timestamptz,
  CONSTRAINT card_cases_provider_ref_key UNIQUE (provider, provider_ref),
  CONSTRAINT card_cases_settled_has_bearer CHECK (status <> 'settled' OR bearer IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_card_cases_order ON public.card_cases (order_id);
CREATE INDEX IF NOT EXISTS idx_card_cases_active ON public.card_cases (created_at DESC)
  WHERE status IN ('open', 'awaiting_decision', 'review');
ALTER TABLE public.card_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.card_cases FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.card_cases IS
  'Card refunds made outside DropMarket and card disputes (chargebacks), one row per provider ref. Written only by the card_* functions; read by admins through the service role.';

CREATE TABLE IF NOT EXISTS public.buyer_blocks (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  source_ref text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.buyer_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buyer_blocks FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.buyer_blocks IS
  'Buyers who may not check out (a card dispute blocks the disputing buyer). Service role only; createCheckout reads it, an admin unblocks.';

-- ── 2. Helpers ──────────────────────────────────────────────────────────────
-- What the provider charged for the order: the provider_float leg of its
-- CHARGE_CONFIRMED journal (the rest of the gross came from the wallet).
CREATE OR REPLACE FUNCTION public.card_paid_minor(p_order_id uuid) RETURNS bigint
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(le.amount_minor), 0)::bigint
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    JOIN ledger_accounts la ON la.id = le.account_id
   WHERE lt.order_id = p_order_id AND lt.event_ref = 'CHARGE_CONFIRMED'
     AND la.kind = 'provider_float' AND le.direction = 'debit';
$$;

-- An order may not leave `disputed` while a card case holds it, except
-- through the card functions themselves (they set app.card_case).
CREATE OR REPLACE FUNCTION public.guard_orders_card_case() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'disputed' AND NEW.status IS DISTINCT FROM 'disputed'
     AND current_setting('app.card_case', true) IS DISTINCT FROM 'on'
     AND EXISTS (SELECT 1 FROM card_cases
                  WHERE order_id = NEW.id AND status IN ('open', 'awaiting_decision')) THEN
    RAISE EXCEPTION 'order % is held by a card dispute or refund; settle it from the card case', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_card_case_guard ON public.orders;
CREATE TRIGGER trg_orders_card_case_guard BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_card_case();

-- Close the order's open SafeDrop dispute (if any) as the card case ends.
CREATE OR REPLACE FUNCTION public.card_case_close_safedrop(p_case_id uuid, p_order_id uuid, p_release boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispute uuid;
BEGIN
  UPDATE disputes
     SET status = CASE WHEN p_release THEN 'resolved_seller_favor' ELSE 'resolved_buyer_favor' END::dispute_status_enum
   WHERE transaction_id = p_order_id
     AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed')
  RETURNING id INTO v_dispute;
  IF v_dispute IS NOT NULL THEN
    INSERT INTO order_dispute_events (dispute_id, order_id, actor_id, actor_role, action, reason, post_completion)
    VALUES (v_dispute, p_order_id, NULL, 'system',
            CASE WHEN p_release THEN 'resolved_release' ELSE 'resolved_refund_full' END,
            'Closed by card case ' || p_case_id::text, false);
  END IF;
END;
$$;

-- ── 3. Settle: book the loss against the seller or DropMarket ───────────────
-- seller   → the order ends refunded: escrow (or the frozen seller share + the
--            platform take) → refunds; the card part leaves via provider_float,
--            the wallet part (if the buyer paid partly from the wallet) goes
--            back to their wallet. The seller is never credited / is debited.
-- platform → the seller keeps the sale (unfrozen); DropMarket's commission
--            pays the card part back to the provider. Released orders only.
CREATE OR REPLACE FUNCTION public.card_case_settle_internal(p_case_id uuid, p_bearer text, p_actor_id uuid DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case     card_cases%ROWTYPE;
  v_o        orders%ROWTYPE;
  v_gross    bigint;
  v_wallet   bigint;
  v_released boolean;
  v_entries  jsonb;
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
  -- Only a full-payment loss is booked here; a partial one stays with a human.
  IF v_case.amount_minor <> v_case.card_minor OR v_case.card_minor <= 0 THEN
    RAISE EXCEPTION 'card_case_settle: case % amount % is not the card payment %', p_case_id, v_case.amount_minor, v_case.card_minor
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_o FROM orders WHERE id = v_case.order_id FOR UPDATE;
  v_gross    := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_wallet   := GREATEST(v_gross - v_case.card_minor, 0);
  v_released := v_o.completed_at IS NOT NULL AND v_o.status IN ('completed', 'disputed')
                AND v_o.escrow_status IN ('released', 'frozen');
  PERFORM set_config('app.card_case', 'on', true);

  IF p_bearer = 'seller' THEN
    IF v_o.status = 'completed' THEN
      -- completed → refunded is not a legal step: freeze first.
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
    IF NOT v_released THEN
      RAISE EXCEPTION 'card_case_settle: DropMarket can absorb only a released order (order % is %)', v_o.id, v_o.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_o.status = 'disputed' THEN
      PERFORM safedrop_transition(v_o.id, 'DISPUTE_RESOLVED_SELLER', 'card_case:' || v_case.id::text);
    END IF;
    PERFORM money_fault_hook('card_case_settle:after_transition');
    PERFORM post_journal('card_case_out:' || v_case.id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_case.card_minor,'currency',v_case.currency),
      jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','credit','amount_minor',v_case.card_minor,'currency',v_case.currency)),
      'CARD_LOSS_PLATFORM', v_o.id);
  END IF;
  PERFORM money_fault_hook('card_case_settle:after_journal');

  PERFORM card_case_close_safedrop(v_case.id, v_o.id, p_bearer = 'platform');
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

-- Admin decision on a case awaiting one (an external refund of a released order).
CREATE OR REPLACE FUNCTION public.card_case_settle(p_case_id uuid, p_bearer text, p_actor_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM card_cases WHERE id = p_case_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'awaiting_decision' THEN
    RETURN jsonb_build_object('settled', false, 'reason', COALESCE(v_status, 'not_found'));
  END IF;
  RETURN card_case_settle_internal(p_case_id, p_bearer, p_actor_id);
END;
$$;

-- ── 4. A full card refund made outside DropMarket ───────────────────────────
-- The webhook calls this only for refunds DropMarket did not send (our own
-- refunds carry dm_refund metadata). p_ref = '<charge id>:refund'.
CREATE OR REPLACE FUNCTION public.card_refund_external_book(
  p_order_id uuid, p_ref text, p_amount_minor bigint, p_currency text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        orders%ROWTYPE;
  v_card     bigint;
  v_case_id  uuid;
  v_review   text := NULL;
  v_released boolean;
  v_link     text := '/admin/orders/' || p_order_id::text;
  v_amount   text := '$' || to_char(p_amount_minor / 100.0, 'FM999999990.00');
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM admin_alert_once('payment_review', 'Card Refund For Unknown Order', 'Stripe refund ' || p_ref || ' names order ' || p_order_id::text || ', which does not exist.', '/admin/orders');
    RETURN jsonb_build_object('booked', false, 'reason', 'order_not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM card_cases WHERE provider = 'stripe' AND provider_ref = p_ref) THEN
    RETURN jsonb_build_object('booked', false, 'reason', 'already_recorded');
  END IF;

  v_card := card_paid_minor(p_order_id);
  v_review := CASE
    WHEN v_card <= 0 OR p_amount_minor <> v_card OR UPPER(p_currency) <> UPPER(COALESCE(v_o.currency, 'USD'))
      THEN 'The refund (' || v_amount || ') is not the full card payment; nothing was booked.'
    WHEN v_o.status IN ('refunded', 'cancelled', 'pending')
      THEN 'The order was already ' || v_o.status || ' — the buyer may have been paid twice. Nothing was booked.'
    WHEN EXISTS (SELECT 1 FROM refund_to_source_requests WHERE order_id = p_order_id AND status IN ('approved', 'sent'))
      THEN 'A store-credit refund to this card is also on record. Nothing was booked.'
    WHEN EXISTS (SELECT 1 FROM card_cases WHERE order_id = p_order_id AND status IN ('open', 'awaiting_decision'))
      THEN 'The order already has an open card dispute or refund. Nothing was booked.'
    ELSE NULL END;

  INSERT INTO card_cases (order_id, kind, provider, provider_ref, amount_minor, card_minor, currency, status)
  VALUES (p_order_id, 'refund', 'stripe', p_ref, p_amount_minor, GREATEST(v_card, 0), UPPER(p_currency),
          CASE WHEN v_review IS NULL THEN 'awaiting_decision' ELSE 'review' END)
  RETURNING id INTO v_case_id;
  PERFORM money_fault_hook('card_refund_external_book:after_case');

  IF v_review IS NOT NULL THEN
    PERFORM admin_alert_once('payment_review', 'Card Refund Needs Review · ' || v_amount, v_review, v_link);
    RETURN jsonb_build_object('booked', false, 'reason', 'review', 'case_id', v_case_id);
  END IF;

  v_released := v_o.completed_at IS NOT NULL AND v_o.status IN ('completed', 'disputed')
                AND v_o.escrow_status IN ('released', 'frozen');
  IF NOT v_released THEN
    -- Seller never credited: the order is refunded, the seller is not paid.
    PERFORM card_case_settle_internal(v_case_id, 'seller', NULL);
    PERFORM admin_alert_once('payment_review', 'Card Refunded In Stripe · ' || v_amount,
      'Booked as refunded to the card: the order is refunded, the seller is not paid, no store credit was given.', v_link);
    RETURN jsonb_build_object('booked', true, 'case_id', v_case_id, 'bearer', 'seller');
  END IF;

  -- The seller was already credited: hold their share, an admin decides.
  IF v_o.status = 'completed' THEN
    PERFORM safedrop_transition(p_order_id, 'ADMIN_DISPUTED', 'card_case:' || v_case_id::text);
  END IF;
  PERFORM money_fault_hook('card_refund_external_book:after_freeze');
  PERFORM admin_alert_once('payment_review', 'Card Refund: Choose Who Pays · ' || v_amount,
    'Refunded in Stripe after the seller was paid. Their share is on hold — choose Seller Pays or DropMarket Pays on the order page.', v_link);
  RETURN jsonb_build_object('booked', false, 'reason', 'awaiting_decision', 'case_id', v_case_id);
END;
$$;

-- ── 5. Card dispute opened ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.card_dispute_open(
  p_order_id uuid, p_ref text, p_amount_minor bigint, p_currency text, p_reason text, p_due_by timestamptz)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o       orders%ROWTYPE;
  v_case_id uuid;
  v_status  text;
  v_link    text := '/admin/orders/' || p_order_id::text;
  v_amount  text := '$' || to_char(p_amount_minor / 100.0, 'FM999999990.00');
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM admin_alert_once('payment_review', 'Card Dispute For Unknown Order', 'Stripe dispute ' || p_ref || ' names order ' || p_order_id::text || ', which does not exist.', '/admin/orders');
    RETURN jsonb_build_object('opened', false, 'reason', 'order_not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM card_cases WHERE provider = 'stripe' AND provider_ref = p_ref) THEN
    RETURN jsonb_build_object('opened', false, 'reason', 'already_recorded');
  END IF;

  v_status := CASE WHEN v_o.status IN ('paid', 'delivering', 'delivered', 'completed', 'disputed') THEN 'open' ELSE 'review' END;
  INSERT INTO card_cases (order_id, kind, provider, provider_ref, amount_minor, card_minor, currency, reason, status, evidence_due_by)
  VALUES (p_order_id, 'dispute', 'stripe', p_ref, p_amount_minor, card_paid_minor(p_order_id), UPPER(p_currency),
          LEFT(p_reason, 200), v_status, p_due_by)
  RETURNING id INTO v_case_id;

  IF v_o.buyer_id IS NOT NULL THEN
    INSERT INTO buyer_blocks (user_id, reason, source_ref) VALUES (v_o.buyer_id, 'card_dispute', p_ref)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  PERFORM money_fault_hook('card_dispute_open:after_case');

  -- Hold the order (and a released seller share) through the SafeDrop seam,
  -- so the admin's dispute tools see it. An already disputed order is held.
  IF v_o.status IN ('paid', 'delivering', 'delivered', 'completed') THEN
    PERFORM order_dispute_open(p_order_id, NULL, 'admin', 'other', 'Card Dispute',
      'The buyer disputed the card payment with their bank (' || COALESCE(p_reason, 'no reason given') || ').');
  END IF;
  PERFORM money_fault_hook('card_dispute_open:after_hold');

  IF v_status = 'review' THEN
    PERFORM admin_alert_once('payment_review', 'Card Dispute On A ' || initcap(v_o.status) || ' Order · ' || v_amount,
      'The order was already ' || v_o.status || ' — the buyer may be paid twice. Answer the dispute in Stripe; nothing was held.', v_link);
  ELSE
    PERFORM admin_alert_once('payment_review', 'Card Dispute Opened · ' || v_amount,
      'The order is on hold and the buyer is blocked. Submit evidence from the order page'
      || COALESCE(' by ' || to_char(p_due_by AT TIME ZONE 'UTC', 'DD Mon YYYY'), '') || '.', v_link);
  END IF;
  RETURN jsonb_build_object('opened', v_status = 'open', 'case_id', v_case_id, 'status', v_status);
END;
$$;

-- ── 6. Card dispute closed ──────────────────────────────────────────────────
-- won (or an inquiry closed without a chargeback): release to the seller when
-- the order was delivered; an undelivered order stays with the admin.
-- lost: settle — the seller pays unless the order was delivered AND the buyer
-- confirmed it.
CREATE OR REPLACE FUNCTION public.card_dispute_close(p_ref text, p_outcome text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case    card_cases%ROWTYPE;
  v_o       orders%ROWTYPE;
  v_bearer  text;
  v_link    text;
  v_amount  text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('won', 'lost') THEN
    RAISE EXCEPTION 'card_dispute_close: outcome must be won|lost' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_case FROM card_cases WHERE provider = 'stripe' AND provider_ref = p_ref AND kind = 'dispute' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('closed', false, 'reason', 'not_found');
  END IF;
  v_link   := '/admin/orders/' || v_case.order_id::text;
  v_amount := '$' || to_char(v_case.amount_minor / 100.0, 'FM999999990.00');
  IF v_case.status IN ('won', 'settled') OR v_case.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('closed', false, 'reason', 'already_closed', 'status', v_case.status);
  END IF;
  IF v_case.status = 'review' THEN
    UPDATE card_cases SET closed_at = now() WHERE id = v_case.id;
    PERFORM admin_alert_once('payment_review', 'Card Dispute ' || initcap(p_outcome) || ' · ' || v_amount,
      'Stripe closed a dispute on an order that was already settled. Nothing moved — check the order.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', p_outcome, 'moved', false);
  END IF;

  SELECT * INTO v_o FROM orders WHERE id = v_case.order_id FOR UPDATE;
  PERFORM set_config('app.card_case', 'on', true);

  IF p_outcome = 'won' THEN
    UPDATE card_cases SET status = 'won', closed_at = now() WHERE id = v_case.id;
    IF v_o.status = 'disputed' AND (v_o.completed_at IS NOT NULL OR v_o.delivered_at IS NOT NULL
                                    OR v_o.seller_marked_delivered_at IS NOT NULL) THEN
      PERFORM safedrop_transition(v_o.id, 'DISPUTE_RESOLVED_SELLER', 'card_case:' || v_case.id::text);
      PERFORM card_case_close_safedrop(v_case.id, v_o.id, true);
      PERFORM money_fault_hook('card_dispute_close:after_release');
      PERFORM admin_alert_once('payment_review', 'Card Dispute Won · ' || v_amount,
        'The bank sided with us. The order is released to the seller. The buyer stays blocked until you unblock them.', v_link);
    ELSE
      PERFORM admin_alert_once('payment_review', 'Card Dispute Won · ' || v_amount,
        'The bank sided with us, but the order was never marked delivered. It stays on hold — finish it from the order page.', v_link);
    END IF;
    RETURN jsonb_build_object('closed', true, 'outcome', 'won');
  END IF;

  IF v_case.amount_minor <> v_case.card_minor THEN
    UPDATE card_cases SET status = 'awaiting_decision' WHERE id = v_case.id;
    PERFORM admin_alert_once('payment_review', 'Card Dispute Lost · ' || v_amount,
      'A partial chargeback: the order stays on hold. Settle it by hand from the order page.', v_link);
    RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', false);
  END IF;

  v_bearer := CASE
    WHEN (v_o.delivered_at IS NOT NULL OR v_o.seller_marked_delivered_at IS NOT NULL)
         AND v_o.buyer_confirmed_at IS NOT NULL
         AND v_o.completed_at IS NOT NULL
      THEN 'platform' ELSE 'seller' END;
  PERFORM card_case_settle_internal(v_case.id, v_bearer, NULL);
  PERFORM admin_alert_once('payment_review', 'Card Dispute Lost · ' || v_amount,
    CASE WHEN v_bearer = 'seller'
         THEN 'No delivery proof: the order is refunded and the seller is not paid.'
         ELSE 'The order was delivered and confirmed: DropMarket absorbs the loss; the seller keeps the sale.' END, v_link);
  RETURN jsonb_build_object('closed', true, 'outcome', 'lost', 'settled', true, 'bearer', v_bearer);
END;
$$;

-- ── 7. Evidence stamp + buyer unblock (admin actions) ───────────────────────
CREATE OR REPLACE FUNCTION public.card_dispute_mark_evidence(p_case_id uuid)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE card_cases SET evidence_submitted_at = COALESCE(evidence_submitted_at, now())
   WHERE id = p_case_id AND kind = 'dispute';
$$;

CREATE OR REPLACE FUNCTION public.buyer_unblock(p_user_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM buyer_blocks WHERE user_id = p_user_id RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM d);
$$;

-- ── 8. Grants: service role only ────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.card_paid_minor(uuid)',
    'public.guard_orders_card_case()',
    'public.card_case_close_safedrop(uuid, uuid, boolean)',
    'public.card_case_settle_internal(uuid, text, uuid)',
    'public.card_case_settle(uuid, text, uuid)',
    'public.card_refund_external_book(uuid, text, bigint, text)',
    'public.card_dispute_open(uuid, text, bigint, text, text, timestamptz)',
    'public.card_dispute_close(text, text)',
    'public.card_dispute_mark_evidence(uuid)',
    'public.buyer_unblock(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
