-- Persist the CoinGate charge on the order + hard-guard against duplicate
-- pending orders for the same buyer+listing.
--
-- Before this, createCheckout inserted a fresh 'pending' order on EVERY call and
-- never stored the provider charge id / checkout URL, so a buyer who re-submitted
-- checkout (or bounced back to the CoinGate page) minted a second order against a
-- second live invoice — a double-payment hazard. Storing the charge lets
-- createCheckout REUSE the existing pending order + invoice; the partial unique
-- index is the backstop that makes a duplicate physically impossible.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider   text,
  ADD COLUMN IF NOT EXISTS provider_charge_id text,
  ADD COLUMN IF NOT EXISTS checkout_url       text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

-- At most one PENDING order per (buyer, listing). Paid/cancelled/refunded rows
-- are unconstrained (a buyer can legitimately re-buy the same listing later),
-- so the predicate is scoped to status = 'pending'. A genuine concurrent
-- double-submit trips 23505 here; createCheckout catches it and re-runs the
-- reuse lookup rather than surfacing a "failed to create order".
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_order_per_buyer_listing
  ON public.orders (buyer_id, listing_id)
  WHERE status = 'pending';

COMMENT ON COLUMN public.orders.checkout_url IS 'CoinGate hosted payment URL for the current pending charge; reused when the buyer re-enters checkout.';
COMMENT ON COLUMN public.orders.payment_expires_at IS 'When the stored checkout_url stops being payable (~CoinGate invoice expiry). Past this, the pending order is superseded on re-checkout.';
