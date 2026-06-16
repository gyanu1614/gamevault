-- ─────────────────────────────────────────────────────────────────────────────
-- V13 — Currency-friendly price precision.
--
-- Currency listings (Robux, V-Bucks) sell for fractional cents per unit, e.g.
-- $0.0045 / Robux. The legacy listings.price column was numeric(10, 2),
-- which silently rounds 0.0045 → 0.00 and fails the > 0 check constraint.
--
-- Order of operations matters because of TWO dependents on listings.price:
--   - `track_listing_price_change_trigger` (WHEN OLD.price IS DISTINCT FROM NEW.price)
--   - `moderation_queue` view (SELECT l.price)
-- Both must be dropped before the ALTER COLUMN succeeds, then recreated.
--
-- Steps:
--   1. Drop the trigger.
--   2. Drop the moderation_queue view.
--   3. Widen listings.price + original_price to numeric(12, 4).
--   4. Widen listing_price_history.old_price + new_price to match.
--   5. Replace the strict > 0 check with >= 0.
--   6. Recreate the moderation_queue view (verbatim from
--      20260307_listing_delivery_enhancements.sql).
--   7. Recreate the price-change trigger (verbatim from
--      20260206_create_listing_price_history.sql).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the dependent trigger.
DROP TRIGGER IF EXISTS track_listing_price_change_trigger ON public.listings;

-- 2. Drop the dependent view.
DROP VIEW IF EXISTS public.moderation_queue;

-- 3. Widen listings.price.
ALTER TABLE public.listings
  ALTER COLUMN price TYPE numeric(12, 4),
  ALTER COLUMN original_price TYPE numeric(12, 4);

-- 4. Widen the history table to match — otherwise the trigger insert would
--    truncate the new value.
ALTER TABLE public.listing_price_history
  ALTER COLUMN old_price TYPE numeric(12, 4),
  ALTER COLUMN new_price TYPE numeric(12, 4);

-- 5. Replace the price check constraint.
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_price_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_price_check CHECK (price >= 0);

-- 6. Recreate the moderation_queue view (identical body — only the price
--    column type changes, which propagates through the SELECT).
CREATE OR REPLACE VIEW public.moderation_queue AS
SELECT
  l.id,
  l.seller_id,
  l.game_id,
  l.category_id,
  l.title,
  l.description,
  l.price,
  l.original_price,
  l.quantity,
  l.min_quantity,
  l.delivery_method,
  l.delivery_time,
  l.delivery_method_type,
  l.images,
  l.template_data,
  l.region,
  l.platform,
  l.status,
  l.currency,
  l.views,
  l.sales,
  l.created_at,
  l.updated_at,
  l.approved_at,
  l.approved_by,
  l.rejection_reason,
  p.username AS seller_username,
  p.email AS seller_email,
  p.seller_tier,
  p.total_sales AS seller_total_sales,
  p.seller_rating,
  g.name AS game_name,
  g.slug AS game_slug,
  c.name AS category_name,
  c.slug AS category_slug,
  (
    SELECT COUNT(*)
    FROM public.listings l2
    WHERE l2.seller_id = l.seller_id
      AND l2.status IN ('active', 'sold', 'archived')
      AND l2.approved_at IS NOT NULL
  ) AS seller_approved_listings_count
FROM public.listings l
JOIN public.profiles p ON l.seller_id = p.id
JOIN public.games g ON l.game_id = g.id
JOIN public.categories c ON l.category_id = c.id
WHERE l.status = 'pending_approval'
ORDER BY l.created_at ASC;

COMMENT ON VIEW public.moderation_queue IS
  'Listings waiting for admin approval with seller information. Recreated in V13 after widening listings.price precision.';

-- 7. Recreate the trigger with the same behaviour.
CREATE TRIGGER track_listing_price_change_trigger
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price)
  EXECUTE FUNCTION track_listing_price_change();
