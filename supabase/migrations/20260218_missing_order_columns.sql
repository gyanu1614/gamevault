-- ============================================================
-- Fix: Add missing columns to orders table
-- Created: 2026-02-18
-- Purpose:
--   The createOrder server action references columns that were
--   never added to the orders table via a migration:
--   - is_guest_order: tracks whether order was placed by a guest
--   Both promo_code_id and promo_discount are added by the
--   20260218_promo_codes.sql migration (already included there).
-- ============================================================

-- Guest order flag
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_guest_order BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.is_guest_order
  IS 'TRUE if the order was placed without a persistent account (guest checkout).';

-- Index for guest order queries
CREATE INDEX IF NOT EXISTS idx_orders_guest
  ON orders (is_guest_order)
  WHERE is_guest_order = TRUE;
