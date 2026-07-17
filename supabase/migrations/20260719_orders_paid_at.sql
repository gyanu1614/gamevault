-- orders.paid_at — the moment the first CHARGE_CONFIRMED lands for an order.
--
-- src/lib/escrow/transition.ts has been stamping this column best-effort
-- since the delivery-timer rework (the SLA countdown starts at payment, not
-- at Buy Now), but the ALTER was never shipped: the stamp failed silently
-- and the timer fell back to created_at. Idempotent; safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill: for orders already past payment the closest known payment moment
-- is when delivery started. Orders without delivering_at keep NULL and the
-- UI falls back to created_at, same as before.
UPDATE orders
SET paid_at = delivering_at
WHERE paid_at IS NULL
  AND delivering_at IS NOT NULL;

-- Verify
SELECT count(*) AS orders_with_paid_at FROM orders WHERE paid_at IS NOT NULL;
