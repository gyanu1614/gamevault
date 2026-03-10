-- Add shop_slug and shop_name to profiles table for custom store URLs
-- This migration enables sellers to have custom, SEO-friendly shop URLs

-- Add new columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shop_name TEXT,
ADD COLUMN IF NOT EXISTS shop_slug TEXT UNIQUE;

-- Add check constraint for shop_slug format (lowercase, hyphens, alphanumeric)
ALTER TABLE profiles
ADD CONSTRAINT shop_slug_format CHECK (
  shop_slug IS NULL OR
  shop_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
);

-- Add length constraints
ALTER TABLE profiles
ADD CONSTRAINT shop_name_length CHECK (
  shop_name IS NULL OR
  (length(shop_name) >= 3 AND length(shop_name) <= 50)
);

ALTER TABLE profiles
ADD CONSTRAINT shop_slug_length CHECK (
  shop_slug IS NULL OR
  (length(shop_slug) >= 3 AND length(shop_slug) <= 50)
);

-- Create index for fast shop slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_shop_slug ON profiles(shop_slug) WHERE shop_slug IS NOT NULL;

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION generate_shop_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));

  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);

  -- Start with base slug
  final_slug := base_slug;

  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE shop_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing approved sellers with slugs from display_name or username
UPDATE profiles p
SET
  shop_name = COALESCE(sa.display_name, p.username),
  shop_slug = generate_shop_slug(COALESCE(sa.display_name, p.username))
FROM seller_applications sa
WHERE
  p.id = sa.user_id
  AND sa.status = 'approved'
  AND p.shop_slug IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.shop_name IS 'Display name for seller shop (e.g., "Legendary Gaming")';
COMMENT ON COLUMN profiles.shop_slug IS 'URL-safe slug for seller shop (e.g., "legendary-gaming")';
COMMENT ON FUNCTION generate_shop_slug IS 'Generates unique URL-safe slug from shop name';
