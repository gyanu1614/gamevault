-- ============================================================
-- MONEY LAYER — add `currency` to orders
-- Created: 2026-06-28
--
-- The live `orders` table has no currency column — orders were implicitly
-- single-currency (USD: all listings are USD today, checkout shows "$"/"USD").
-- The money layer is multi-currency by design (the ledger tags every entry
-- with a currency; CoinGate settles EUR). safedrop_transition needs a real
-- per-order currency to post correct ledger journals.
--
-- Backfill: existing orders are USD (their true historical currency). New
-- orders default to EUR (the go-forward settlement currency for CoinGate).
-- This keeps history accurate while pointing new flows at EUR.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + guarded backfill.
-- ============================================================

-- 1. Add the column WITHOUT a default first, so existing rows get NULL (a clean
--    "not yet assigned" marker) rather than being indistinguishable from real
--    EUR orders. This makes the backfill exact and re-run-safe.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency CHAR(3);

-- 2. Backfill ONLY the rows that are still NULL (the pre-existing historical
--    orders) to their true currency, USD. Re-running this is a no-op once no
--    NULLs remain, so it can never clobber a genuine EUR order.
UPDATE public.orders SET currency = 'USD' WHERE currency IS NULL;

-- 3. Now set the go-forward default (EUR) and the NOT NULL constraint. New
--    orders that don't specify a currency settle in EUR (CoinGate currency).
ALTER TABLE public.orders ALTER COLUMN currency SET DEFAULT 'EUR';
ALTER TABLE public.orders ALTER COLUMN currency SET NOT NULL;

COMMENT ON COLUMN public.orders.currency IS
  'ISO currency of the order. Historical orders backfilled to USD; new orders default EUR (CoinGate settlement currency). Used by safedrop_transition for ledger postings.';
