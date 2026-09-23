-- ============================================================================
-- PAY-020 (P3, hygiene) — audit pass 6, fix/checkout-p0. Idempotent.
--
-- The expiry sweep (/api/cron/expire-pending-payments) selects
--   status = 'pending' AND payment_provider = … AND payment_expires_at < now
-- every 30 minutes with no index on that predicate (orders_status_idx only).
-- A partial index on the two sweep columns, restricted to pending rows, keeps
-- the sweep a range scan as the orders table grows. Pending rows are a tiny,
-- churning subset, so the index stays small.
-- ============================================================================
CREATE INDEX IF NOT EXISTS orders_pending_payment_sweep_idx
  ON public.orders (payment_provider, payment_expires_at)
  WHERE status = 'pending';
COMMENT ON INDEX public.orders_pending_payment_sweep_idx IS
  'PAY-020: predicate index for the expire-pending-payments sweep (status=pending, provider, expiry).';
