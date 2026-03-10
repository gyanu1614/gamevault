-- Listing Delivery & Stock Enhancements
-- Adds min_quantity, delivery_method_type, removes is_unlimited

-- Add new columns first
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 1 CHECK (min_quantity >= 1),
  ADD COLUMN IF NOT EXISTS delivery_method_type text;

-- Migrate existing unlimited listings to high stock value (999999)
UPDATE listings
SET quantity = 999999
WHERE is_unlimited = true;

-- Drop dependent views before dropping column
DROP VIEW IF EXISTS moderation_queue CASCADE;

-- Drop is_unlimited column
ALTER TABLE listings
  DROP COLUMN IF EXISTS is_unlimited;

-- Recreate moderation_queue view without is_unlimited dependency
CREATE OR REPLACE VIEW moderation_queue AS
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
  p.username as seller_username,
  p.email as seller_email,
  p.seller_tier,
  p.total_sales as seller_total_sales,
  p.seller_rating,
  g.name as game_name,
  g.slug as game_slug,
  c.name as category_name,
  c.slug as category_slug,
  (
    SELECT COUNT(*)
    FROM public.listings l2
    WHERE l2.seller_id = l.seller_id
    AND l2.status IN ('active', 'sold', 'archived')
    AND l2.approved_at IS NOT NULL
  ) as seller_approved_listings_count
FROM public.listings l
JOIN public.profiles p ON l.seller_id = p.id
JOIN public.games g ON l.game_id = g.id
JOIN public.categories c ON l.category_id = c.id
WHERE l.status = 'pending_approval'
ORDER BY l.created_at ASC;

-- Update any triggers that reference is_unlimited
-- Check if there's an auto-status trigger and recreate it
DROP TRIGGER IF EXISTS on_listing_quantity_change ON listings;
DROP FUNCTION IF EXISTS handle_listing_quantity_change CASCADE;

CREATE OR REPLACE FUNCTION handle_listing_quantity_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-mark as sold when quantity reaches 0 (no longer check is_unlimited)
  IF NEW.quantity = 0 AND OLD.quantity > 0 AND NEW.status = 'active' THEN
    NEW.status := 'sold';
  END IF;

  -- Auto-reactivate when restocked
  IF NEW.quantity > 0 AND OLD.quantity = 0 AND NEW.status = 'sold' THEN
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_listing_quantity_change
  BEFORE UPDATE OF quantity ON listings
  FOR EACH ROW
  EXECUTE FUNCTION handle_listing_quantity_change();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_delivery_method ON listings(delivery_method);
CREATE INDEX IF NOT EXISTS idx_listings_delivery_method_type ON listings(delivery_method_type);
CREATE INDEX IF NOT EXISTS idx_listings_min_quantity ON listings(min_quantity);

-- Add comments
COMMENT ON COLUMN listings.min_quantity IS 'Minimum quantity a buyer must purchase (default 1)';
COMMENT ON COLUMN listings.delivery_method_type IS 'Specific delivery method (e.g., Game Pass, Island Delivery, In-game Trade)';
