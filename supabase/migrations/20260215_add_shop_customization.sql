-- Add shop customization fields to profiles table
-- This migration adds columns for future shop customization features

-- Add shop customization columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shop_primary_color VARCHAR(7) DEFAULT '#7c3aed', -- Default violet-600
ADD COLUMN IF NOT EXISTS shop_secondary_color VARCHAR(7) DEFAULT '#a855f7', -- Default purple-500
ADD COLUMN IF NOT EXISTS shop_banner_url TEXT,
ADD COLUMN IF NOT EXISTS shop_banner_position VARCHAR(20) DEFAULT 'center',
ADD COLUMN IF NOT EXISTS shop_custom_css TEXT,
ADD COLUMN IF NOT EXISTS shop_theme VARCHAR(20) DEFAULT 'default' CHECK (shop_theme IN ('default', 'dark', 'light', 'custom')),
ADD COLUMN IF NOT EXISTS shop_layout VARCHAR(20) DEFAULT 'grid' CHECK (shop_layout IN ('grid', 'list', 'masonry'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_shop_theme ON profiles(shop_theme);

-- Add comments for documentation
COMMENT ON COLUMN profiles.shop_primary_color IS 'Primary brand color for seller shop (hex format)';
COMMENT ON COLUMN profiles.shop_secondary_color IS 'Secondary brand color for seller shop (hex format)';
COMMENT ON COLUMN profiles.shop_banner_url IS 'URL to custom shop banner image';
COMMENT ON COLUMN profiles.shop_banner_position IS 'Banner image position (center, top, bottom)';
COMMENT ON COLUMN profiles.shop_custom_css IS 'Custom CSS for advanced shop customization';
COMMENT ON COLUMN profiles.shop_theme IS 'Shop theme selection (default, dark, light, custom)';
COMMENT ON COLUMN profiles.shop_layout IS 'Default shop listing layout (grid, list, masonry)';
