-- Refund to the original payment method (docs/design/buyer-fee-refund-policy.md).
--
-- Never automatic: every provider refund costs $1/€1 (Payssion rate sheet)
-- and the original processing fee is gone. The buyer asks from the order
-- page once their refund sits as store credit; an admin approves; the money
-- goes back through the provider's refund API by way of the outbox.
--
--   request  refund_to_source_request(order, buyer)  → pending
--   approve  refund_to_source_approve(request, admin) → ONE transaction:
--            user_wallet debit → provider_float credit (refund_to_source:<id>)
--            + an outbox row kind='refund'            → approved
--   drain    lib/payments/cancel-outbox.ts: provider.refund(...)
--            ok  → provider_cancel_outbox_mark → sent (provider_refund_id)
--            cap → provider_cancel_outbox_mark → refund_to_source_fail:
--                  the debit is reversed (refund_to_source_reversal:<id>),
--                  status failed, ONE admin alert
--   reject   refund_to_source_reject(request, admin, notes) → rejected
-- The provider's own "refunded" webhook then hits order_refund_to_wallet on
-- an already-refunded order with its wallet_refund key present: a no-op.

-- ── 1. Requests ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_to_source_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_minor        bigint NOT NULL CHECK (amount_minor > 0),
  currency            char(3) NOT NULL,
  provider            text NOT NULL,
  provider_charge_id  text NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'sent', 'failed', 'rejected')),
  admin_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes         text,
  failure_reason      text,
  provider_refund_id  text,
  outbox_id           uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  decided_at          timestamptz,
  sent_at             timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refund_to_source_requests_status_idx ON public.refund_to_source_requests (status, created_at);
ALTER TABLE public.refund_to_source_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.refund_to_source_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.refund_to_source_requests TO service_role;
COMMENT ON TABLE public.refund_to_source_requests IS
  'Buyer requests to send a store-credit refund back to the original payment method; admin-approved; fulfilled through the provider refund outbox. Service-role only (the order page reads it through a session-checked action).';

CREATE OR REPLACE FUNCTION public.refund_to_source_requests_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_requests_touch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_refund_to_source_requests_touch ON public.refund_to_source_requests;
CREATE TRIGGER trg_refund_to_source_requests_touch BEFORE UPDATE ON public.refund_to_source_requests
  FOR EACH ROW EXECUTE FUNCTION public.refund_to_source_requests_touch();

-- ── 2. The outbox learns a second job kind ───────────────────────────────────
ALTER TABLE public.provider_cancel_outbox
  ADD COLUMN IF NOT EXISTS kind         text NOT NULL DEFAULT 'void' CHECK (kind IN ('void', 'refund')),
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS currency     char(3),
  ADD COLUMN IF NOT EXISTS request_id   uuid REFERENCES public.refund_to_source_requests(id) ON DELETE SET NULL;
ALTER TABLE public.provider_cancel_outbox DROP CONSTRAINT IF EXISTS provider_cancel_outbox_provider_provider_charge_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS provider_cancel_outbox_charge_kind_key
  ON public.provider_cancel_outbox (provider, provider_charge_id, kind);
COMMENT ON COLUMN public.provider_cancel_outbox.kind IS
  'void = close a live charge at the provider (round B); refund = send money back for a refund_to_source_requests row.';

-- enqueue (void): body from 20260923030139 §3, conflict target now includes kind.
CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_enqueue(
  p_attempt_id uuid, p_order_id uuid, p_provider text, p_provider_charge_id text, p_reason text, p_void_outcome text DEFAULT NULL)
  RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_provider IS NULL OR p_provider_charge_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO provider_cancel_outbox (attempt_id, order_id, provider, provider_charge_id, reason, status, outcome, done_at, kind)
  VALUES (p_attempt_id, p_order_id, p_provider, p_provider_charge_id, p_reason,
          CASE WHEN p_void_outcome IS NOT NULL THEN 'done' ELSE 'pending' END,
          p_void_outcome,
          CASE WHEN p_void_outcome IS NOT NULL THEN now() ELSE NULL END,
          'void')
  ON CONFLICT (provider, provider_charge_id, kind) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_enqueue(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_cancel_outbox_enqueue(uuid, uuid, text, text, text, text) TO service_role;

-- enqueue (refund): internal helper for refund_to_source_approve.
CREATE OR REPLACE FUNCTION public.provider_refund_outbox_enqueue(
  p_request_id uuid, p_order_id uuid, p_provider text, p_provider_charge_id text, p_amount_minor bigint, p_currency text)
  RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO provider_cancel_outbox (order_id, provider, provider_charge_id, reason, status, kind, amount_minor, currency, request_id)
  VALUES (p_order_id, p_provider, p_provider_charge_id, 'refund_to_source:' || p_request_id::text, 'pending', 'refund', p_amount_minor, UPPER(p_currency)::char(3), p_request_id)
  ON CONFLICT (provider, provider_charge_id, kind) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM provider_cancel_outbox WHERE provider = p_provider AND provider_charge_id = p_provider_charge_id AND kind = 'refund';
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_refund_outbox_enqueue(uuid, uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_refund_outbox_enqueue(uuid, uuid, text, text, bigint, text) TO service_role;

-- ── 3. request ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_to_source_request(p_order_id uuid, p_buyer_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        RECORD;
  v_att      RECORD;
  v_fee      RECORD;
  v_txn      uuid;
  v_credited bigint;
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
  INSERT INTO refund_to_source_requests (order_id, buyer_id, amount_minor, currency, provider, provider_charge_id)
  VALUES (p_order_id, p_buyer_id, v_credited, v_cur, v_att.provider, v_att.provider_charge_id)
  RETURNING id INTO v_id;
  PERFORM notify_once(p_buyer_id, 'refund_to_source', 'Refund Request Received',
    'We received your request to refund order #' || COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8))) ||
    ' to your original payment method. Support reviews it within 24 to 48 hours; the store credit stays in your Store Balance until then.',
    '/account/orders/' || p_order_id::text, 'refund_to_source:' || v_id::text || ':received');
  RETURN jsonb_build_object('ok', true, 'request_id', v_id, 'amount_minor', v_credited, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_request(uuid, uuid) TO service_role;

-- ── 4. approve / reject / fail ───────────────────────────────────────────────
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
  IF v_balance < v_r.amount_minor THEN
    UPDATE refund_to_source_requests SET status = 'rejected', admin_id = p_admin_id, decided_at = now(),
           admin_notes = COALESCE(admin_notes, 'The store credit was spent before approval.') WHERE id = p_request_id;
    RETURN jsonb_build_object('approved', false, 'reason', 'credit_spent', 'balance_minor', v_balance);
  END IF;
  -- The credit leaves the buyer's wallet; the cash leaves our provider float
  -- once the drain sends it. wallet_spend is idempotent on its key.
  v_txn := wallet_spend(v_r.buyer_id, v_r.amount_minor, v_r.currency, 'provider_float',
                        'refund_to_source:' || p_request_id::text, 'REFUND_TO_SOURCE', v_r.order_id);
  PERFORM money_fault_hook('refund_to_source_approve:after_spend');
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

CREATE OR REPLACE FUNCTION public.refund_to_source_reject(p_request_id uuid, p_admin_id uuid, p_notes text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r RECORD;
  v_o RECORD;
BEGIN
  SELECT * INTO v_r FROM refund_to_source_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('rejected', false, 'reason', 'not_found');
  END IF;
  IF v_r.status <> 'pending' THEN
    RETURN jsonb_build_object('rejected', false, 'reason', 'not_pending', 'status', v_r.status);
  END IF;
  SELECT order_number INTO v_o FROM orders WHERE id = v_r.order_id;
  UPDATE refund_to_source_requests
     SET status = 'rejected', admin_id = p_admin_id, decided_at = now(), admin_notes = LEFT(COALESCE(p_notes, ''), 1000)
   WHERE id = p_request_id;
  PERFORM notify_once(v_r.buyer_id, 'refund_to_source', 'Refund Request Declined',
    'We could not send the refund for order #' || COALESCE(v_o.order_number, UPPER(LEFT(v_r.order_id::text, 8))) ||
    ' back to your payment method' || CASE WHEN COALESCE(p_notes, '') <> '' THEN ': ' || LEFT(p_notes, 200) ELSE '.' END ||
    ' The store credit stays in your Store Balance to spend at checkout.',
    '/account/orders/' || v_r.order_id::text, 'refund_to_source:' || p_request_id::text || ':rejected');
  RETURN jsonb_build_object('rejected', true, 'request_id', p_request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_reject(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_reject(uuid, uuid, text) TO service_role;

-- Terminal failure at the provider: give the credit back, alert once.
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
  v_txn := wallet_credit(v_r.buyer_id, v_r.amount_minor, v_r.currency, 'provider_float',
                         'refund_to_source_reversal:' || p_request_id::text, 'REFUND_TO_SOURCE_REVERSED', v_r.order_id);
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
    'We could not send your refund back to your payment method. The full amount is back in your Store Balance; support will follow up.',
    '/account/orders/' || v_r.order_id::text, 'refund_to_source:' || p_request_id::text || ':failed');
  RETURN jsonb_build_object('failed', true, 'request_id', p_request_id, 'ledger_txn_id', v_txn, 'alerted', v_alerted);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_fail(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_fail(uuid, text) TO service_role;

-- ── 5. mark — done / retry / failed, per kind ────────────────────────────────
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
