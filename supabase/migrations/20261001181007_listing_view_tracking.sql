-- Listing view tracking (2026-10-01).
--
-- Listing pages counted views by UPDATEing `listings` from the visitor's own
-- session. UPDATE on listings was revoked from JWT callers (security batch,
-- 2026-09-28), so every view since has failed with "permission denied for
-- table listings" and no counter moved.
--
-- Views now go through this definer function, called only by the
-- trackListingView server action with the service role (one count per visitor
-- per listing per 6 hours; the seller's own views are skipped there). It bumps
-- both counters together — `views` (the listing page and the seller's My
-- Listings show it) and `view_count` (the "most viewed" sort) — and only for an
-- active listing. Same name and signature as the baseline function it replaces,
-- which only bumped `views` and had no pinned search_path.

CREATE OR REPLACE FUNCTION public.increment_listing_views(listing_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
     SET views = COALESCE(views, 0) + 1,
         view_count = COALESCE(view_count, 0) + 1
   WHERE id = listing_uuid
     AND status = 'active';
END;
$$;

-- Service role only (db_p0 posture): never callable from a browser session.
REVOKE ALL ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO service_role;
