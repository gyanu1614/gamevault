-- ============================================================================
-- A buyer can still read the listing they ordered after it stops being active.
-- Idempotent: safe to re-run. ADDITIVE: one new SELECT policy; nothing else.
--
-- Before: listings SELECT policies allow status = 'active' OR the seller.
-- A single-stock listing flips to 'sold' the moment payment claims its stock,
-- and paused / removed listings vanish too, so the BUYER's order page, order
-- list, wallet and chats lost the item (title "Order", no image, no game,
-- default delivery window) for exactly the orders they had paid for.
--
-- After: authenticated users can also read a listing they have an order for.
-- Anonymous reads (the public marketplace) are untouched. orders RLS applies
-- inside the subquery (a buyer reads only their own orders); both lookups use
-- existing indexes (orders_listing_id_idx, orders_buyer_id_idx).
-- ============================================================================

DROP POLICY IF EXISTS "Buyers can view listings they ordered" ON public.listings;
CREATE POLICY "Buyers can view listings they ordered" ON public.listings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.listing_id = listings.id
       AND o.buyer_id = (SELECT auth.uid())
  ));
