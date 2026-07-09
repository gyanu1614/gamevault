-- ============================================================
-- Widen orders.unit_price for sub-cent currency prices
-- Created: 2026-06-30
--
-- Currency listings (Robux, V-Bucks, gold) are priced PER UNIT at sub-cent
-- values, e.g. $0.0054/Robux. orders.unit_price was numeric(10,2), which rounds
-- 0.0054 → 0.00 and then fails CHECK (unit_price > 0):
--   "new row for relation \"orders\" violates check constraint
--    \"orders_unit_price_check\""
-- (The old order flow only avoided this when the price happened to round to
--  ≥ 0.01; Robux/V-Bucks at 0.004x round to 0.00 and crash.)
--
-- subtotal / total_amount / seller_payout stay numeric(10,2) — they're whole
-- dollar amounts (price × quantity is always ≥ a few cents) and are computed
-- from the TRUE un-rounded price, so they're already correct.
--
-- Widening unit_price to numeric(12,4) lets it store the real per-unit price,
-- so unit_price × quantity actually equals subtotal (correct by construction)
-- and the > 0 check passes. 4 decimals covers sub-cent currency; (12,4) keeps
-- ample headroom for the integer part.
--
-- Idempotent: ALTER TYPE is safe to re-run.
-- ============================================================

ALTER TABLE public.orders
  ALTER COLUMN unit_price TYPE numeric(12, 4);

-- The CHECK (unit_price > 0) constraint is preserved automatically (it's about
-- the value, not the precision). A true per-unit price is always > 0.
