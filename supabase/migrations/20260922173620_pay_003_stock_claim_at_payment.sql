-- ============================================================================
-- PAY-003 / PAY-015 (P0 / P2) — audit pass 6, fix/checkout-p0.
-- Idempotent: safe to re-run.
--
-- PAY-003: stock was decremented only when an order reached 'completed'
-- (update_listing_quantity). Checkout did a read-only precheck; nothing
-- reserved anything at payment, so N buyers could all PAY for a stock of 1
-- and the seller was left with undeliverable paid orders.
--
-- Now payment confirmation is ONE RPC, order_confirm_payment: it runs
-- safedrop_transition(CHARGE_CONFIRMED), stamps paid_at, row-locks the
-- listing and claims the order's quantity (quantity >= q, or is_unlimited).
-- If the stock is gone the money is routed, in the SAME transaction, to the
-- existing refund path: order_refund_to_wallet (paid → refunded, escrow_held
-- → refunds, full total credited to the buyer's wallet). The buyer is never
-- left paid-and-undeliverable, and no partial state can survive a failure
-- (money_fault_hook points for the GREEN proof).
--
-- orders.stock_claimed_at records the claim; update_listing_quantity no
-- longer decrements for such orders at completion (legacy orders paid
-- before this migration still decrement there), and it RETURNS the stock
-- when a claimed, still-undelivered ('paid') order is cancelled or refunded
-- (orders.stock_returned_at). Refunds after delivery keep the stock out.
--
-- PAY-015: inventory_claim_for_order handed out codes for orders in any
-- state; it now refuses a NEW claim unless the order is paid or beyond.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_claimed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS stock_returned_at timestamptz;
COMMENT ON COLUMN public.orders.stock_claimed_at  IS 'PAY-003: set by order_confirm_payment when the listing quantity was decremented for this order (NULL = legacy order, decremented at completion).';
COMMENT ON COLUMN public.orders.stock_returned_at IS 'PAY-003: set by update_listing_quantity when a claimed, undelivered order was cancelled/refunded and its quantity returned to the listing.';

-- ── order_confirm_payment ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_confirm_payment(p_order_id uuid, p_dedupe_key text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_listing    RECORD;
  v_transition JSONB;
  v_refund     JSONB;
  v_ok         BOOLEAN := TRUE;
  v_reason     TEXT := NULL;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_confirm_payment: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 1. pending → paid (no-op when already paid; raises on a terminal order,
  --    exactly as before — dispatch pages the admins for that case).
  v_transition := safedrop_transition(p_order_id, 'CHARGE_CONFIRMED', p_dedupe_key, NULL, NULL);
  IF NOT COALESCE((v_transition->>'changed')::boolean, false) THEN
    RETURN v_transition || jsonb_build_object('outcome', 'noop');
  END IF;

  -- 2. The delivery SLA starts at PAYMENT; first stamp wins. Inside the
  --    transaction (PAY-020: a failed stamp used to be swallowed in TS).
  UPDATE orders SET paid_at = COALESCE(paid_at, NOW()) WHERE id = p_order_id;

  PERFORM money_fault_hook('order_confirm_payment:after_transition');

  -- 3. Claim the stock under the listing row lock.
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

  -- 4. Oversold: the money arrived for an order we cannot deliver — refund it
  --    to the buyer's wallet NOW, in this transaction (paid → refunded).
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

  RETURN v_transition || jsonb_build_object('outcome', 'paid', 'stock_claimed', v_order.stock_claimed_at IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.order_confirm_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_confirm_payment(uuid, text) TO service_role;
COMMENT ON FUNCTION public.order_confirm_payment(uuid, text) IS
  'Money layer (PAY-003): safedrop_transition(CHARGE_CONFIRMED) + paid_at + row-locked stock claim (quantity >= q) in one transaction; when the stock is gone the order is refunded to the buyer wallet (order_refund_to_wallet) in the same transaction. Idempotent on order:<id>:CHARGE_CONFIRMED[:dedupe]. Service-role only.';

-- ── update_listing_quantity: skip claimed orders at completion; return stock on undelivered cancel/refund
CREATE OR REPLACE FUNCTION "public"."update_listing_quantity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.listings
    SET
      -- PAY-003: orders claimed at payment already took their stock.
      quantity = CASE
        WHEN is_unlimited OR NEW.stock_claimed_at IS NOT NULL THEN quantity
        ELSE GREATEST(0, quantity - NEW.quantity)
      END,
      sales = sales + 1,
      status = CASE
        WHEN NOT is_unlimited AND NEW.stock_claimed_at IS NULL AND quantity - NEW.quantity <= 0 THEN 'sold'
        WHEN NOT is_unlimited AND NEW.stock_claimed_at IS NOT NULL AND quantity <= 0 AND status = 'active' THEN 'sold'
        ELSE status
      END
    WHERE id = NEW.listing_id;

    UPDATE public.profiles
    SET total_sales = total_sales + 1
    WHERE id = NEW.seller_id;

  ELSIF NEW.status IN ('cancelled', 'refunded')
        AND OLD.status = 'paid'
        AND NEW.stock_claimed_at IS NOT NULL
        AND NEW.stock_returned_at IS NULL THEN
    -- PAY-003: an undelivered, stock-claimed order was closed — give the
    -- stock back (a listing we sold out re-opens). Refunds after delivery
    -- (delivering/delivered/disputed → refunded) keep the stock out.
    UPDATE public.listings
       SET quantity = quantity + NEW.quantity,
           status   = CASE WHEN status = 'sold' THEN 'active' ELSE status END
     WHERE id = NEW.listing_id AND NOT COALESCE(is_unlimited, false);
    UPDATE public.orders SET stock_returned_at = NOW() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── PAY-015: inventory_claim_for_order — paid-state guard ──────────────────
CREATE OR REPLACE FUNCTION public.inventory_claim_for_order(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_inv   RECORD;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT id, listing_id, buyer_id, status, instant_delivery_inventory_id
    INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_claim_for_order: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- PAY-015: codes are released to PAID orders only (the retry branch below
  -- returns an existing claim in any state — that code is already out).
  IF v_order.instant_delivery_inventory_id IS NULL
     AND v_order.status NOT IN ('paid', 'delivering', 'delivered', 'completed') THEN
    RAISE EXCEPTION 'inventory_claim_for_order: order % is % — a code is released only once the order is paid',
      p_order_id, v_order.status USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.instant_delivery_inventory_id IS NOT NULL THEN
    SELECT id, delivery_data, delivery_type INTO v_inv
      FROM instant_delivery_inventory WHERE id = v_order.instant_delivery_inventory_id;
    RETURN jsonb_build_object('inventory_id', v_inv.id, 'delivery_data', v_inv.delivery_data,
                              'delivery_type', v_inv.delivery_type, 'already_claimed', true);
  END IF;

  UPDATE instant_delivery_inventory
     SET status = 'sold', sold_to_order_id = p_order_id, sold_at = NOW(),
         decrypted_at = NOW(), decrypted_by_user_id = v_order.buyer_id
   WHERE id = (
     SELECT id FROM instant_delivery_inventory
      WHERE listing_id = v_order.listing_id AND status = 'available'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1)
  RETURNING id, delivery_data, delivery_type INTO v_inv;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('inventory_id', NULL, 'already_claimed', false);
  END IF;

  PERFORM money_fault_hook('inventory_claim_for_order:after_inventory');

  UPDATE orders
     SET instant_delivery_inventory_id = v_inv.id,
         instant_delivery_delivered_at = COALESCE(instant_delivery_delivered_at, NOW())
   WHERE id = p_order_id;

  RETURN jsonb_build_object('inventory_id', v_inv.id, 'delivery_data', v_inv.delivery_data,
                            'delivery_type', v_inv.delivery_type, 'already_claimed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_claim_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_claim_for_order(uuid) TO service_role;
COMMENT ON FUNCTION public.inventory_claim_for_order(uuid) IS
  'DB-016/PAY-015: atomic FOR UPDATE SKIP LOCKED claim of one available inventory row for a PAID order, stamping inventory + order together; returns the existing claim on retry. Service-role only.';
