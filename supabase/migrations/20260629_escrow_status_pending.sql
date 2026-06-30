-- ============================================================
-- Add 'pending' to the orders.escrow_status CHECK constraint
-- Created: 2026-06-29
--
-- The CoinGate checkout (createCheckout) creates an order BEFORE payment, at
-- status='pending'. Its escrow_status should reflect "order created, no funds
-- held yet" — but the original constraint (20260206) only allowed
-- held/released/refunded/frozen, so the insert failed with
-- "orders_escrow_status_check" violation.
--
-- 'pending' is the correct escrow state for an unpaid order: nothing is in
-- escrow. On CHARGE_CONFIRMED, safedrop_transition flips it to 'held'. The
-- cancel path (`IF escrow_status = 'held'`) correctly skips refunding a pending
-- order that never held funds.
--
-- Idempotent: drop + re-add the named constraint with the expanded value set.
-- ============================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_escrow_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_escrow_status_check
  CHECK (escrow_status IN ('pending', 'held', 'released', 'refunded', 'frozen'));
