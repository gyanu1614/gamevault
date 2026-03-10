-- Migration: Add SEO, template data, and pre-moderation columns to listings table
-- Date: 2026-02-06
-- Purpose: Support dynamic templates, SEO-friendly URLs, and pre-moderation queue

-- Add template data (game-specific fields)
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS template_data jsonb;

-- Add SEO-friendly slug
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add pre-moderation fields
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS moderation_notes text;

-- Add new status for pre-moderation
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE public.listings
ADD CONSTRAINT listings_status_check
CHECK (status IN ('draft', 'pending_approval', 'active', 'sold', 'archived', 'suspended', 'rejected'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_slug ON public.listings(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_template_data ON public.listings USING GIN(template_data) WHERE template_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_pending_approval ON public.listings(status, created_at)
  WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_listings_approved_by ON public.listings(approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_rejected ON public.listings(rejected_at DESC) WHERE rejected_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.listings.template_data IS 'Game-specific dynamic field data (e.g., account_level, robux_amount for Roblox)';
COMMENT ON COLUMN public.listings.slug IS 'SEO-friendly URL slug generated from title (e.g., "roblox-premium-account-level-300")';
COMMENT ON COLUMN public.listings.approved_by IS 'Admin who approved the listing (for pre-moderation)';
COMMENT ON COLUMN public.listings.approved_at IS 'When listing was approved by admin';
COMMENT ON COLUMN public.listings.rejected_by IS 'Admin who rejected the listing';
COMMENT ON COLUMN public.listings.rejected_at IS 'When listing was rejected';
COMMENT ON COLUMN public.listings.rejection_reason IS 'Reason for rejection (shown to seller)';
COMMENT ON COLUMN public.listings.moderation_notes IS 'Internal notes for admins during moderation';

-- Create function to generate slug from title
CREATE OR REPLACE FUNCTION generate_listing_slug(title_text text, listing_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert title to lowercase, replace spaces with hyphens, remove special characters
  base_slug := lower(regexp_replace(title_text, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Limit slug length to 100 characters
  base_slug := substring(base_slug from 1 for 100);

  -- Append short ID for uniqueness
  base_slug := base_slug || '-' || substring(listing_id::text from 1 for 8);

  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to auto-generate slug
CREATE OR REPLACE FUNCTION set_listing_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate slug if not already set or if title changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.title != NEW.title) THEN
    NEW.slug = generate_listing_slug(NEW.title, NEW.id);

    -- Handle conflicts (shouldn't happen, but just in case)
    WHILE EXISTS (SELECT 1 FROM public.listings WHERE slug = NEW.slug AND id != NEW.id) LOOP
      NEW.slug = NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_listing_slug_trigger ON public.listings;
CREATE TRIGGER set_listing_slug_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION set_listing_slug();

-- Create function to check if seller needs pre-moderation
CREATE OR REPLACE FUNCTION check_seller_needs_moderation(seller_id uuid)
RETURNS boolean AS $$
DECLARE
  seller_tier text;
  approved_listings_count integer;
  tier_config jsonb;
  pre_moderation_count integer;
BEGIN
  -- Get seller's tier
  SELECT profiles.seller_tier INTO seller_tier
  FROM public.profiles
  WHERE profiles.id = seller_id;

  -- Get tier configuration (if tier system table exists)
  -- For now, hardcode: unverified sellers need 5 listings approved
  IF seller_tier = 'unverified' OR seller_tier IS NULL THEN
    pre_moderation_count := 5;
  ELSE
    -- Other tiers don't need pre-moderation
    RETURN false;
  END IF;

  -- Count approved listings
  SELECT COUNT(*) INTO approved_listings_count
  FROM public.listings
  WHERE listings.seller_id = check_seller_needs_moderation.seller_id
  AND listings.status IN ('active', 'sold', 'archived')
  AND listings.approved_at IS NOT NULL;

  -- Return true if seller still needs moderation
  RETURN approved_listings_count < pre_moderation_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to set status to pending_approval for new sellers
CREATE OR REPLACE FUNCTION check_listing_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for new listings being set to 'active'
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'active')) AND NEW.status = 'active' THEN
    -- Check if seller needs moderation
    IF check_seller_needs_moderation(NEW.seller_id) THEN
      NEW.status = 'pending_approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_listing_moderation_trigger ON public.listings;
CREATE TRIGGER check_listing_moderation_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION check_listing_moderation();

-- Create function to approve listing
CREATE OR REPLACE FUNCTION approve_listing(
  listing_id uuid,
  admin_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET
    status = 'active',
    approved_by = admin_id,
    approved_at = now(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reject listing
CREATE OR REPLACE FUNCTION reject_listing(
  listing_id uuid,
  admin_id uuid,
  reason text
)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET
    status = 'rejected',
    rejected_by = admin_id,
    rejected_at = now(),
    rejection_reason = reason,
    approved_by = NULL,
    approved_at = NULL
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get listings pending moderation
CREATE OR REPLACE FUNCTION get_listings_pending_moderation()
RETURNS SETOF public.listings AS $$
BEGIN
  RETURN QUERY
  SELECT l.*
  FROM public.listings l
  WHERE l.status = 'pending_approval'
  ORDER BY l.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for moderation queue with seller info
CREATE OR REPLACE VIEW moderation_queue AS
SELECT
  l.*,
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

COMMENT ON VIEW moderation_queue IS 'Listings waiting for admin approval with seller information';

-- Grant permissions
GRANT SELECT ON moderation_queue TO authenticated;
GRANT EXECUTE ON FUNCTION approve_listing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_listing(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_listings_pending_moderation() TO authenticated;
GRANT EXECUTE ON FUNCTION check_seller_needs_moderation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_listing_slug(text, uuid) TO authenticated;

-- Generate slugs for existing listings
UPDATE public.listings
SET slug = generate_listing_slug(title, id)
WHERE slug IS NULL;
