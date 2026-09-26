-- ============================================================================
-- Checkout fix round B, Part 2 — provider_cancel_outbox + admin_alert_once
-- (PAY-004 / PAY-013). Idempotent: safe to re-run.
--
-- Closing an order does not close its charge at the provider: a superseded
-- BTCPay invoice stays payable and watched, a cancelled Payssion voucher can
-- still be redeemed (PAY-004), and the "best-effort" provider cancels the
-- app fired were fire-and-forget with a stale comment claiming a cron would
-- retry them (PAY-013). Now every money transaction that closes a live
-- charge ALSO writes a provider_cancel_outbox row — same transaction, so a
-- rollback leaves no orphan and a commit leaves no forgotten charge:
--   · order_cancel_return_wallet with p_attempt_close = 'void'
--     (buyer cancel, expiry sweep, re-checkout supersede, charge-create
--     failure); a provider-reported failure ('failed') writes none
--   · payment_attempt_supersede (retry replaces the charge)
--   · payment_attempt_activate on an attempt that closed while the provider
--     call was in flight: the charge just minted is an ORPHAN and goes
--     straight to the outbox instead of the order.
-- A worker (lib/payments/cancel-outbox.ts, run inline after the RPC and by
-- /api/cron/reconcile-payments every 15 min) claims due rows with
-- FOR UPDATE SKIP LOCKED, calls provider.voidCharge, and marks them done;
-- a failure backs off (1m, 4m, 16m, ~1h, ~4h, ~17h) and, at the cap, the
-- row is failed and admins are alerted ONCE (admin_alert_once — the same
-- deduped-insert pattern as PAY-002's cancel-refused alert).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_cancel_outbox_version() TO service_role;

-- ── 1. admin_alert_once — one notification per active admin, deduped ────────
-- Keyed on (admin, type, title, link): a retry storm, a cron loop or a
-- provider replaying the same event can never page twice for one thing.
CREATE OR REPLACE FUNCTION public.admin_alert_once(p_type text, p_title text, p_message text, p_link text)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, is_read)
  SELECT ar.user_id, p_type, p_title, p_message, p_link, false
    FROM admin_roles ar
   WHERE ar.is_active
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ar.user_id AND n.type = p_type AND n.title = p_title
          AND n.link IS NOT DISTINCT FROM p_link);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_alert_once(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_alert_once(text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.admin_alert_once(text, text, text, text) IS
  'Round B: insert one in-app notification per active admin unless one with the same (type, title, link) already exists for them. Returns the number inserted. Service-role only.';

-- ── 2. The outbox ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_cancel_outbox (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id          uuid REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
  order_id            uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  provider            text NOT NULL,
  provider_charge_id  text NOT NULL,
  reason              text,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts            integer NOT NULL DEFAULT 0,
  next_attempt_at     timestamptz NOT NULL DEFAULT now(),
  last_error          text,
  outcome             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  done_at             timestamptz,
  UNIQUE (provider, provider_charge_id)
);
COMMENT ON TABLE public.provider_cancel_outbox IS
  'Round B Part 2: charges to void at the provider, written in the same transaction that closed them. Drained by lib/payments/cancel-outbox.ts (inline + /api/cron/reconcile-payments). Service-role only.';
ALTER TABLE public.provider_cancel_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_cancel_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.provider_cancel_outbox TO service_role;
CREATE INDEX IF NOT EXISTS provider_cancel_outbox_due_idx
  ON public.provider_cancel_outbox (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS provider_cancel_outbox_order_idx
  ON public.provider_cancel_outbox (order_id);

CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_touch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_provider_cancel_outbox_touch ON public.provider_cancel_outbox;
CREATE TRIGGER trg_provider_cancel_outbox_touch BEFORE UPDATE ON public.provider_cancel_outbox
  FOR EACH ROW EXECUTE FUNCTION public.provider_cancel_outbox_touch();

-- ── 3. enqueue (internal helper for the money RPCs) ─────────────────────────
-- p_void_outcome records a void the caller already performed inline (the
-- sweep asks the provider BEFORE cancelling) so the drain does not repeat
-- it; the row still exists as the audit trail.
DROP FUNCTION IF EXISTS public.provider_cancel_outbox_enqueue(uuid, uuid, text, text, text, boolean);
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
  -- p_void_outcome (voided | already_closed | unsupported): the caller
  -- already asked the provider inline and this is its answer — the row is
  -- born done, as the audit trail; NULL = the drain must void it.
  INSERT INTO provider_cancel_outbox (attempt_id, order_id, provider, provider_charge_id, reason, status, outcome, done_at)
  VALUES (p_attempt_id, p_order_id, p_provider, p_provider_charge_id, p_reason,
          CASE WHEN p_void_outcome IS NOT NULL THEN 'done' ELSE 'pending' END,
          p_void_outcome,
          CASE WHEN p_void_outcome IS NOT NULL THEN now() ELSE NULL END)
  ON CONFLICT (provider, provider_charge_id) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_enqueue(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_cancel_outbox_enqueue(uuid, uuid, text, text, text, text) TO service_role;

-- ── 4. claim — due rows, skip-locked, backoff stamped on the way out ────────
CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_claim(p_limit integer DEFAULT 50, p_order_id uuid DEFAULT NULL)
  RETURNS SETOF public.provider_cancel_outbox
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE provider_cancel_outbox o
     SET attempts = o.attempts + 1,
         -- 1m, 4m, 16m, 64m, ~4h, ~17h, then 24h: a dead provider is asked
         -- again a handful of times today, not every minute forever.
         next_attempt_at = now() + LEAST(interval '24 hours', interval '1 minute' * power(4, o.attempts))
   WHERE o.id IN (
     SELECT c.id FROM provider_cancel_outbox c
      WHERE c.status = 'pending' AND c.next_attempt_at <= now()
        AND (p_order_id IS NULL OR c.order_id = p_order_id)
      ORDER BY c.next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, p_limit))
  RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_cancel_outbox_claim(integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_cancel_outbox_claim(integer, uuid) TO service_role;

-- ── 5. mark — done, or pending-with-backoff, or failed + ONE alert at the cap
CREATE OR REPLACE FUNCTION public.provider_cancel_outbox_mark(p_id uuid, p_ok boolean, p_outcome text, p_error text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_max_attempts CONSTANT integer := 6;
  v_row     provider_cancel_outbox%ROWTYPE;
  v_alerted integer := 0;
BEGIN
  SELECT * INTO v_row FROM provider_cancel_outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider_cancel_outbox_mark: row % not found', p_id USING ERRCODE = 'no_data_found';
  END IF;
  IF p_ok THEN
    UPDATE provider_cancel_outbox
       SET status = 'done', outcome = p_outcome, last_error = NULL, done_at = now()
     WHERE id = p_id;
    RETURN jsonb_build_object('id', p_id, 'status', 'done', 'attempts', v_row.attempts, 'alerted', 0);
  END IF;
  IF v_row.attempts >= c_max_attempts THEN
    UPDATE provider_cancel_outbox SET status = 'failed', last_error = p_error WHERE id = p_id;
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

-- ── 6. order_cancel_return_wallet — enqueue in the money transaction ────────
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean, text, text, text);
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_allow_paid boolean DEFAULT false,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL,
  p_attempt_close text DEFAULT NULL, p_provider_void_outcome text DEFAULT NULL)
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
      v_wallet_txn := wallet_credit(
        v_order.buyer_id, v_total, UPPER(COALESCE(v_order.currency, 'USD'))::char(3), 'refunds',
        'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
    END IF;

    RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'refused', false, 'from_paid', true);
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
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text) IS
  'Money layer (DB-015/PAY-002 + round B): cancel from pending (+ exact mirror of the checkout wallet hold) in one transaction, close the open attempt (failed|void) and, on void, enqueue the live charge in provider_cancel_outbox — same transaction. A charge bound to another order is refused; one no longer open is a no-op (stale_attempt). p_allow_paid=true (buyer) also cancels a paid order and credits the total. Any other status: no-op + one deduped admin alert. Service-role only.';

-- ── 7. payment_attempt_supersede — the old charge goes to the outbox ─────────
DROP FUNCTION IF EXISTS public.payment_attempt_supersede(uuid, text, boolean);
CREATE OR REPLACE FUNCTION public.payment_attempt_supersede(p_order_id uuid, p_reason text, p_force boolean DEFAULT false)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a RECORD;
  v_outbox_id uuid := NULL;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM 1 FROM orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_a FROM payment_attempts
   WHERE order_id = p_order_id AND status IN ('created', 'active') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'no_open_attempt');
  END IF;
  -- PAY-005 for retries: a created attempt younger than 90 s is another
  -- request still inside provider.createCharge — leave it alone. p_force is
  -- for the request that opened it and whose own charge creation failed.
  IF NOT p_force AND v_a.status = 'created' AND v_a.created_at > now() - interval '90 seconds' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'attempt_id', v_a.id, 'changed', false, 'reason', 'in_flight');
  END IF;
  UPDATE payment_attempts
     SET status = 'superseded', closed_at = now(), close_reason = COALESCE(p_reason, 'superseded')
   WHERE id = v_a.id;
  PERFORM money_fault_hook('payment_attempt_supersede:after_close');
  -- The replaced charge must stop being payable: outbox, same transaction.
  IF v_a.provider_charge_id IS NOT NULL THEN
    v_outbox_id := provider_cancel_outbox_enqueue(v_a.id, p_order_id, v_a.provider, v_a.provider_charge_id, COALESCE(p_reason, 'superseded'), NULL);
  END IF;
  PERFORM money_fault_hook('payment_attempt_supersede:after_outbox');
  -- The mirror no longer points at a live charge.
  UPDATE orders SET provider_charge_id = NULL, checkout_url = NULL WHERE id = p_order_id;
  RETURN jsonb_build_object(
    'order_id', p_order_id, 'attempt_id', v_a.id, 'changed', true,
    'provider', v_a.provider, 'provider_charge_id', v_a.provider_charge_id, 'pm_id', v_a.pm_id,
    'outbox_id', v_outbox_id);
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempt_supersede(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempt_supersede(uuid, text, boolean) TO service_role;

-- ── 8. payment_attempt_activate — an orphaned charge goes to the outbox ──────
CREATE OR REPLACE FUNCTION public.payment_attempt_activate(
  p_attempt_id uuid, p_provider_charge_id text, p_checkout_url text, p_expires_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a RECORD;
  v_outbox_id uuid;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  -- Lock order → attempt, the same order every attempt RPC uses.
  PERFORM 1 FROM orders WHERE id = (SELECT order_id FROM payment_attempts WHERE id = p_attempt_id) FOR UPDATE;
  SELECT * INTO v_a FROM payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt_activate: attempt % not found', p_attempt_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_a.status = 'active' AND v_a.provider_charge_id = p_provider_charge_id THEN
    RETURN jsonb_build_object('attempt_id', v_a.id, 'order_id', v_a.order_id, 'changed', false);
  END IF;
  IF v_a.status <> 'created' THEN
    -- The attempt was closed while the provider call was in flight
    -- (cancelled / expired / superseded): the charge just minted has no
    -- home. It goes to the outbox to be voided; the attempt stays closed
    -- and the caller never hands the buyer this URL.
    v_outbox_id := provider_cancel_outbox_enqueue(
      v_a.id, v_a.order_id, v_a.provider, p_provider_charge_id, 'orphaned:' || v_a.status, NULL);
    RETURN jsonb_build_object('attempt_id', v_a.id, 'order_id', v_a.order_id, 'changed', false,
                              'orphaned', true, 'outbox_id', v_outbox_id);
  END IF;
  UPDATE payment_attempts
     SET status = 'active', provider_charge_id = p_provider_charge_id, checkout_url = p_checkout_url,
         expires_at = COALESCE(p_expires_at, expires_at), activated_at = now()
   WHERE id = p_attempt_id;
  -- Write-through mirror on the order (display surfaces read these).
  UPDATE orders
     SET payment_provider = v_a.provider, provider_charge_id = p_provider_charge_id,
         checkout_url = p_checkout_url, payment_expires_at = COALESCE(p_expires_at, payment_expires_at)
   WHERE id = v_a.order_id;
  RETURN jsonb_build_object('attempt_id', v_a.id, 'order_id', v_a.order_id, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempt_activate(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempt_activate(uuid, text, text, timestamptz) TO service_role;
