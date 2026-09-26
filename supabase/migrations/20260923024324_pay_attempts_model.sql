-- ============================================================================
-- Checkout fix round B, Part 1 — payment attempts model
-- (PAY-004 / PAY-013 / PAY-018, docs/audit/pass-6-checkout.md, PART C §1).
-- Idempotent: safe to re-run.
--
-- Until now an order carried ONE provider charge in four mirror columns
-- (payment_provider, provider_charge_id, checkout_url, payment_expires_at).
-- A retry or a re-checkout overwrote them: the old invoice stayed payable at
-- the provider while the database forgot it existed (PAY-004), the pm_id the
-- buyer picked was never stored (PAY-018), and nothing stopped two orders
-- from claiming the same charge id or one order from holding two live
-- charges (PAY-005's loser).
--
-- payment_attempts owns the charge lifecycle from here:
--   · one OPEN attempt per order (partial unique, status created|active);
--   · one charge id per provider (partial unique);
--   · pm_id, checkout_url, expiry and an amounts snapshot on every attempt;
--   · history is never overwritten — superseded / failed / void / paid rows
--     stay for reconciliation.
-- The four order columns remain as a WRITE-THROUGH MIRROR of the open
-- attempt (maintained only by the RPCs below) so display surfaces that read
-- the order row stay truthful; every checkout / webhook / return / sweep
-- path reads the attempt.
--
-- Checkout is ONE RPC (order_create_pending): order row + promo usage +
-- wallet hold + attempt in a single transaction, so a failure anywhere
-- leaves nothing behind (money_fault_hook points for the GREEN proof).
-- The provider charge is minted by the app AFTER the RPC and stored with
-- payment_attempt_activate; a retry supersedes with
-- payment_attempt_supersede + payment_attempt_open.
--
-- order_confirm_payment / order_cancel_return_wallet gain the (provider,
-- provider_charge_id) of the event that drives them: the charge must be
-- bound to THAT order, a confirmation closes the attempt as paid, and a
-- failure on an attempt that is no longer open (superseded by a retry) is
-- a no-op — it used to cancel an order whose fresh invoice was live.
-- Overloads with fewer parameters are DROPPED (PostgREST resolves rpc() by
-- parameter names; two candidates answer 300).
-- ============================================================================

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.payment_attempts_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.payment_attempts_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempts_version() TO service_role;

-- ── 1. The table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider            text NOT NULL,
  provider_charge_id  text,
  pm_id               text,
  checkout_url        text,
  status              text NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created', 'active', 'paid', 'failed', 'void', 'superseded')),
  -- Amounts snapshot, minor units: what the provider was asked for, what the
  -- wallet covered, and the order total at the time.
  amount_minor        bigint NOT NULL CHECK (amount_minor >= 0),
  wallet_minor        bigint NOT NULL DEFAULT 0 CHECK (wallet_minor >= 0),
  order_total_minor   bigint NOT NULL CHECK (order_total_minor >= 0),
  currency            char(3) NOT NULL,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  activated_at        timestamptz,
  closed_at           timestamptz,
  close_reason        text,
  paid_event_id       text
);
COMMENT ON TABLE public.payment_attempts IS
  'Money layer (round B): one row per provider charge minted for an order. status created (order inserted, provider not yet called) → active (charge live) → paid | failed (provider reported) | void (we cancelled) | superseded (replaced by a retry). One open row per order; one charge id per provider. Service-role only.';
COMMENT ON COLUMN public.payment_attempts.amount_minor IS 'What the provider was asked to collect: order total minus the wallet hold.';
COMMENT ON COLUMN public.payment_attempts.paid_event_id IS 'The provider event id that confirmed this attempt (webhook dedupe id).';

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_attempts TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_open_per_order
  ON public.payment_attempts (order_id) WHERE status IN ('created', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_charge_key
  ON public.payment_attempts (provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx
  ON public.payment_attempts (order_id, created_at);
CREATE INDEX IF NOT EXISTS payment_attempts_open_expiry_idx
  ON public.payment_attempts (expires_at) WHERE status IN ('created', 'active');

CREATE OR REPLACE FUNCTION public.payment_attempts_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempts_touch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_payment_attempts_touch ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_touch BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.payment_attempts_touch();

-- ── 2. Backfill from the legacy mirror columns (idempotent) ─────────────────
-- Every order that carries a charge id and has no attempt yet gets one row.
-- Status follows the order: pending → active (the sweep decides its fate),
-- paid and beyond → paid, cancelled → void. Duplicate charge ids across
-- orders (a PAY-005 loser) keep the first order's row; the rest are counted
-- in the NOTICE and left for the reconciler to read from the order columns.
CREATE OR REPLACE FUNCTION public.payment_attempts_backfill() RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted INT := 0;
  v_skipped  INT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id, o.status, o.payment_provider, o.provider_charge_id, o.checkout_url,
           o.payment_expires_at, o.created_at, o.paid_at, o.cancelled_at, o.updated_at,
           o.total_amount, o.currency
      FROM orders o
     WHERE o.provider_charge_id IS NOT NULL
       AND o.payment_provider IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_id = o.id)
     ORDER BY o.created_at
  LOOP
    BEGIN
      INSERT INTO payment_attempts (
        order_id, provider, provider_charge_id, checkout_url, status,
        amount_minor, wallet_minor, order_total_minor, currency, expires_at,
        created_at, activated_at, closed_at, close_reason)
      SELECT r.id, r.payment_provider, r.provider_charge_id, r.checkout_url,
             CASE WHEN r.status = 'pending' THEN 'active'
                  WHEN r.status = 'cancelled' THEN 'void'
                  ELSE 'paid' END,
             GREATEST(0, ROUND(COALESCE(r.total_amount, 0) * 100)::bigint - h.hold),
             h.hold,
             ROUND(COALESCE(r.total_amount, 0) * 100)::bigint,
             UPPER(COALESCE(r.currency, 'USD'))::char(3),
             r.payment_expires_at,
             r.created_at, r.created_at,
             CASE WHEN r.status = 'pending' THEN NULL
                  WHEN r.status = 'cancelled' THEN COALESCE(r.cancelled_at, r.updated_at)
                  ELSE COALESCE(r.paid_at, r.updated_at) END,
             CASE WHEN r.status = 'pending' THEN NULL ELSE 'backfill:' || r.status END
        FROM (SELECT COALESCE(checkout_wallet_hold_minor(r.id), 0)::bigint AS hold) h;
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;
  IF v_skipped > 0 THEN
    RAISE NOTICE 'payment_attempts_backfill: % attempt(s) inserted, % order(s) skipped (charge id already held by another order)', v_inserted, v_skipped;
  END IF;
  RETURN v_inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempts_backfill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempts_backfill() TO service_role;
COMMENT ON FUNCTION public.payment_attempts_backfill() IS
  'Round B Part 1: one payment_attempts row per order that still carries only the legacy charge columns. Idempotent (skips orders that already have an attempt). Service-role only.';

DO $$
DECLARE v_n INT;
BEGIN
  SELECT public.payment_attempts_backfill() INTO v_n;
  RAISE NOTICE 'payment_attempts_backfill: % attempt(s) created from legacy order columns', v_n;
END $$;

-- ── 3. order_create_pending — order + promo + wallet hold + attempt, one txn ─
CREATE OR REPLACE FUNCTION public.order_create_pending(
  p_buyer_id uuid, p_seller_id uuid, p_listing_id uuid, p_quantity integer,
  p_unit_price numeric, p_subtotal numeric,
  p_platform_fee_rate numeric, p_payment_processing_fee_rate numeric,
  p_platform_fee numeric, p_payment_processing_fee numeric,
  p_total_amount numeric, p_seller_payout numeric,
  p_seller_commission_pct numeric, p_seller_fee_trace jsonb,
  p_currency text, p_promo_code_id uuid, p_promo_discount numeric,
  p_wallet_minor bigint, p_provider text, p_pm_id text,
  p_fallback_expires_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id     uuid;
  v_order_number text;
  v_currency     char(3) := UPPER(COALESCE(p_currency, 'USD'))::char(3);
  v_total_minor  bigint  := ROUND(COALESCE(p_total_amount, 0) * 100)::bigint;
  v_balance      bigint  := 0;
  v_applied      bigint  := 0;
  v_charge       bigint;
  v_attempt_id   uuid;
  v_constraint   text;
  v_tries        int := 0;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  -- 1. The order. orders_order_number_key: the BEFORE INSERT trigger drew a
  --    number that already exists — retry the INSERT exactly once (the
  --    trigger draws again). Every other unique violation (the buyer's own
  --    one_pending_order_per_buyer_listing double-submit included) is
  --    re-raised untouched so the caller reads the constraint name.
  LOOP
    BEGIN
      INSERT INTO orders (
        buyer_id, seller_id, listing_id, quantity, unit_price, subtotal,
        platform_fee_rate, payment_processing_fee_rate, platform_fee, payment_processing_fee,
        total_amount, seller_payout, seller_commission_pct, seller_fee_trace,
        currency, status, escrow_status, promo_discount, promo_code_id,
        payment_expires_at, payment_provider)
      VALUES (
        p_buyer_id, p_seller_id, p_listing_id, p_quantity, p_unit_price, p_subtotal,
        p_platform_fee_rate, p_payment_processing_fee_rate, p_platform_fee, p_payment_processing_fee,
        p_total_amount, p_seller_payout, p_seller_commission_pct, p_seller_fee_trace,
        v_currency, 'pending', 'pending', COALESCE(p_promo_discount, 0), p_promo_code_id,
        p_fallback_expires_at, p_provider)
      RETURNING id, order_number INTO v_order_id, v_order_number;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'orders_order_number_key' AND v_tries < 1 THEN
        v_tries := v_tries + 1;
        CONTINUE;
      END IF;
      RAISE;
    END;
  END LOOP;

  PERFORM money_fault_hook('order_create_pending:after_order');

  -- 2. Promo usage (PAY-014): the cap binds under the promo row lock; a
  --    refusal raises and the whole order rolls back — no cancelled order,
  --    no discount granted.
  IF p_promo_code_id IS NOT NULL AND COALESCE(p_promo_discount, 0) > 0 THEN
    PERFORM promo_usage_record(p_promo_code_id, v_order_id, p_buyer_id, p_promo_discount);
  END IF;

  PERFORM money_fault_hook('order_create_pending:after_promo');

  -- 3. Wallet hold (PAY-001 lock inside wallet_spend): clamped to the
  --    balance and the total. If the balance moved between the read and the
  --    lock, wallet_spend raises and the order rolls back with it.
  IF COALESCE(p_wallet_minor, 0) > 0 THEN
    v_balance := COALESCE(user_wallet_balance(p_buyer_id, v_currency), 0);
    v_applied := LEAST(p_wallet_minor, v_balance, v_total_minor);
    IF v_applied > 0 THEN
      PERFORM wallet_spend(p_buyer_id, v_applied, v_currency, 'escrow_held',
                           'checkout_wallet:' || v_order_id::text, 'CHECKOUT_WALLET_CREDIT', v_order_id);
    ELSE
      v_applied := 0;
    END IF;
  END IF;

  PERFORM money_fault_hook('order_create_pending:after_wallet');

  -- 4. The attempt: only when something is left to charge. A fully
  --    wallet-paid order is confirmed by the caller (order_confirm_payment)
  --    and never had a provider charge.
  v_charge := v_total_minor - v_applied;
  IF v_charge > 0 THEN
    INSERT INTO payment_attempts (order_id, provider, pm_id, status, amount_minor, wallet_minor,
                                  order_total_minor, currency, expires_at)
    VALUES (v_order_id, p_provider, p_pm_id, 'created', v_charge, v_applied,
            v_total_minor, v_currency, p_fallback_expires_at)
    RETURNING id INTO v_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'attempt_id', v_attempt_id,
    'total_minor', v_total_minor,
    'wallet_applied_minor', v_applied,
    'charge_minor', v_charge);
END;
$$;
REVOKE ALL ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) TO service_role;
COMMENT ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) IS
  'Round B Part 1: pending order + promo usage + wallet hold (checkout_wallet:<id>) + created payment attempt in ONE transaction. Re-raises unique violations with the constraint name; retries an order_number collision once. Service-role only.';

-- ── 4. payment_attempt_open — a fresh created attempt for a retry ────────────
CREATE OR REPLACE FUNCTION public.payment_attempt_open(
  p_order_id uuid, p_provider text, p_pm_id text, p_amount_minor bigint, p_fallback_expires_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_hold  bigint;
  v_id    uuid;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt_open: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'payment_attempt_open: order % is %, not pending', p_order_id, v_order.status USING ERRCODE = 'check_violation';
  END IF;
  v_hold := COALESCE(checkout_wallet_hold_minor(p_order_id), 0);
  -- The partial unique index refuses a second open attempt (23505): the
  -- caller reads that as "another request is minting the charge".
  INSERT INTO payment_attempts (order_id, provider, pm_id, status, amount_minor, wallet_minor,
                                order_total_minor, currency, expires_at)
  VALUES (p_order_id, p_provider, p_pm_id, 'created', p_amount_minor, v_hold,
          ROUND(COALESCE(v_order.total_amount, 0) * 100)::bigint,
          UPPER(COALESCE(v_order.currency, 'USD'))::char(3), p_fallback_expires_at)
  RETURNING id INTO v_id;
  UPDATE orders SET payment_provider = p_provider,
                    payment_expires_at = COALESCE(p_fallback_expires_at, payment_expires_at)
   WHERE id = p_order_id;
  RETURN jsonb_build_object('attempt_id', v_id, 'order_id', p_order_id, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempt_open(uuid, text, text, bigint, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempt_open(uuid, text, text, bigint, timestamptz) TO service_role;

-- ── 5. payment_attempt_activate — the provider answered: store the charge ────
CREATE OR REPLACE FUNCTION public.payment_attempt_activate(
  p_attempt_id uuid, p_provider_charge_id text, p_checkout_url text, p_expires_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a RECORD;
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
    -- home. Part 2 routes it to the cancel outbox; until then refuse loudly.
    RAISE EXCEPTION 'payment_attempt_activate: attempt % is % — charge % is orphaned',
      p_attempt_id, v_a.status, p_provider_charge_id USING ERRCODE = 'check_violation';
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

-- ── 6. payment_attempt_supersede — a retry replaces the open attempt ─────────
DROP FUNCTION IF EXISTS public.payment_attempt_supersede(uuid, text);
CREATE OR REPLACE FUNCTION public.payment_attempt_supersede(p_order_id uuid, p_reason text, p_force boolean DEFAULT false)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a RECORD;
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
  -- The mirror no longer points at a live charge.
  UPDATE orders SET provider_charge_id = NULL, checkout_url = NULL WHERE id = p_order_id;
  RETURN jsonb_build_object(
    'order_id', p_order_id, 'attempt_id', v_a.id, 'changed', true,
    'provider', v_a.provider, 'provider_charge_id', v_a.provider_charge_id, 'pm_id', v_a.pm_id);
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempt_supersede(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempt_supersede(uuid, text, boolean) TO service_role;

-- ── 7. order_confirm_payment — bound to the charge, closes the attempt ───────
DROP FUNCTION IF EXISTS public.order_confirm_payment(uuid, text);
DROP FUNCTION IF EXISTS public.order_confirm_payment(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.order_confirm_payment(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order            RECORD;
  v_attempt_id       uuid := NULL;
  v_attempt_order_id uuid := NULL;
  v_listing          RECORD;
  v_transition       JSONB;
  v_refund           JSONB;
  v_ok               BOOLEAN := TRUE;
  v_reason           TEXT := NULL;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_confirm_payment: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 0. The charge that pays must be THIS order's. A provider event names an
  --    order id from the provider's own record of the charge; an attempt row
  --    that disagrees is a mis-bound charge and moves nothing.
  IF p_provider IS NOT NULL AND p_provider_charge_id IS NOT NULL THEN
    SELECT id, order_id INTO v_attempt_id, v_attempt_order_id FROM payment_attempts
     WHERE provider = p_provider AND provider_charge_id = p_provider_charge_id FOR UPDATE;
    IF v_attempt_id IS NOT NULL AND v_attempt_order_id <> p_order_id THEN
      RAISE EXCEPTION 'order_confirm_payment: charge %/% is bound to order %, not %',
        p_provider, p_provider_charge_id, v_attempt_order_id, p_order_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 1. pending → paid (no-op when already paid; raises on a terminal order).
  v_transition := safedrop_transition(p_order_id, 'CHARGE_CONFIRMED', p_dedupe_key, NULL, NULL);
  IF NOT COALESCE((v_transition->>'changed')::boolean, false) THEN
    RETURN v_transition || jsonb_build_object('outcome', 'noop');
  END IF;

  -- 2. The delivery SLA starts at PAYMENT; first stamp wins.
  UPDATE orders SET paid_at = COALESCE(paid_at, NOW()) WHERE id = p_order_id;

  PERFORM money_fault_hook('order_confirm_payment:after_transition');

  -- 2b. Close the attempt as paid: the one the charge names, else whatever
  --     is open (wallet-paid retries, legacy orders without a row).
  IF v_attempt_id IS NOT NULL THEN
    UPDATE payment_attempts
       SET status = 'paid', paid_event_id = p_dedupe_key, closed_at = now(), close_reason = 'paid'
     WHERE id = v_attempt_id;
  ELSE
    UPDATE payment_attempts
       SET status = 'paid', paid_event_id = p_dedupe_key, closed_at = now(), close_reason = 'paid'
     WHERE order_id = p_order_id AND status IN ('created', 'active');
  END IF;

  -- 3. Claim the stock under the listing row lock (PAY-003).
  IF v_order.stock_claimed_at IS NULL THEN
    SELECT id, is_unlimited, quantity, status INTO v_listing
      FROM listings WHERE id = v_order.listing_id FOR UPDATE;
    IF NOT FOUND THEN
      v_ok := FALSE; v_reason := 'listing_missing';
    ELSIF COALESCE(v_listing.is_unlimited, false) THEN
      v_ok := TRUE;
    ELSIF COALESCE(v_listing.quantity, 0) >= v_order.quantity THEN
      UPDATE listings
         SET quantity = quantity - v_order.quantity,
             status   = CASE WHEN status = 'active' AND quantity - v_order.quantity <= 0 THEN 'sold' ELSE status END
       WHERE id = v_listing.id;
    ELSE
      v_ok := FALSE; v_reason := 'insufficient_stock';
    END IF;
    IF v_ok THEN
      UPDATE orders SET stock_claimed_at = NOW() WHERE id = p_order_id;
    END IF;
  END IF;

  PERFORM money_fault_hook('order_confirm_payment:after_stock');

  -- 4. Oversold: refund to the wallet NOW, in this transaction.
  IF NOT v_ok THEN
    v_refund := order_refund_to_wallet(p_order_id, 'oversold', NULL);
    RETURN v_transition || jsonb_build_object(
      'outcome', 'oversold_refunded',
      'reason', v_reason,
      'status', v_refund->>'status',
      'escrow_status', v_refund->>'escrow_status',
      'wallet_txn_id', v_refund->'wallet_txn_id',
      'credited_minor', v_refund->'credited_minor');
  END IF;

  RETURN v_transition || jsonb_build_object('outcome', 'paid', 'stock_claimed', v_order.stock_claimed_at IS NULL,
                                            'attempt_id', v_attempt_id);
END;
$$;
REVOKE ALL ON FUNCTION public.order_confirm_payment(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_confirm_payment(uuid, text, text, text) TO service_role;
COMMENT ON FUNCTION public.order_confirm_payment(uuid, text, text, text) IS
  'Money layer (PAY-003 + round B): CHARGE_CONFIRMED + paid_at + row-locked stock claim in one transaction; the (provider, charge id) must be bound to this order and its attempt is closed as paid. Sold out → refunded to the wallet in the same transaction. Idempotent. Service-role only.';

-- ── 8. order_cancel_return_wallet — stale attempts never cancel ──────────────
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean, text, text);
CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_allow_paid boolean DEFAULT false,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL,
  p_attempt_close text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order            RECORD;
  v_attempt_id       uuid := NULL;
  v_attempt_order_id uuid := NULL;
  v_attempt_status   text := NULL;
  v_close            text;
  v_transition       JSONB;
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
  -- charge dead (webhook CHARGE_FAILED), 'void' when WE closed it (expiry
  -- sweep, supersede, charge-create failure, buyer cancel). The caller may
  -- say; otherwise a named charge means the provider spoke.
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

    -- Close the open attempt: 'failed' when the provider reported it, 'void'
    -- when we closed it (expiry sweep, supersede, charge-create failure,
    -- buyer cancel). History row stays.
    UPDATE payment_attempts
       SET status = v_close, closed_at = now(), close_reason = COALESCE(p_dedupe_key, 'cancelled')
     WHERE order_id = p_order_id AND status IN ('created', 'active');

    RETURN v_transition || jsonb_build_object('wallet_txn_id', v_wallet_txn, 'refused', false);
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
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text) TO service_role;
COMMENT ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text) IS
  'Money layer (DB-015/PAY-002 + round B): cancel from pending (+ exact mirror of the checkout wallet hold) in one transaction and close the open attempt; a (provider, charge id) bound to another order is refused, one that is no longer open is a no-op (reason stale_attempt). p_allow_paid=true (buyer) also cancels a paid order and credits the total. Any other status: no-op + one deduped admin alert. Service-role only.';

-- ── 9. expired_pending_payment_attempts — the sweep's read ───────────────────
CREATE OR REPLACE FUNCTION public.expired_pending_payment_attempts(p_cutoff timestamptz, p_limit integer DEFAULT 50)
  RETURNS TABLE (order_id uuid, attempt_id uuid, provider text, provider_charge_id text, expires_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, a.id, COALESCE(a.provider, o.payment_provider), a.provider_charge_id,
         COALESCE(a.expires_at, o.payment_expires_at)
    FROM orders o
    LEFT JOIN payment_attempts a ON a.order_id = o.id AND a.status IN ('created', 'active')
   WHERE o.status = 'pending'
     AND COALESCE(a.expires_at, o.payment_expires_at) < p_cutoff
   ORDER BY COALESCE(a.expires_at, o.payment_expires_at) ASC
   LIMIT GREATEST(1, p_limit);
$$;
REVOKE ALL ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) TO service_role;
COMMENT ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) IS
  'Round B Part 1: pending orders whose OPEN attempt (or, with none, the order''s fallback expiry) is past p_cutoff, oldest first. Read by /api/cron/expire-pending-payments. Service-role only.';
