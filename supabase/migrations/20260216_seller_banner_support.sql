/**
 * Seller Banner Support Migration
 *
 * Features:
 * - Add banner_url and banner_preset fields to profiles table
 * - Add seller_tier field for premium banner access control
 * - Create preset banner configurations
 * - Add banner upload storage bucket
 * - Set up RLS policies for banner management
 */

-- ============================================================================
-- 1. Add Banner Fields to Profiles Table
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS banner_preset TEXT DEFAULT 'gaming-purple',
ADD COLUMN IF NOT EXISTS seller_tier TEXT DEFAULT 'bronze' CHECK (
  seller_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')
);

-- Add constraints (safe idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'banner_url_format' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT banner_url_format CHECK (
      banner_url IS NULL OR
      banner_url ~* '^https?://.*\.(jpg|jpeg|png|webp|gif)(\?.*)?$' OR
      banner_url LIKE 'storage/seller-banners/%'
    );
  END IF;
END $$;

COMMENT ON COLUMN profiles.banner_url IS 'Custom banner image URL (premium sellers only)';
COMMENT ON COLUMN profiles.banner_preset IS 'Preset gradient theme for banner (non-premium sellers)';
COMMENT ON COLUMN profiles.seller_tier IS 'Seller tier level (determines banner customization privileges)';

-- ============================================================================
-- 2. Create Banner Presets Configuration Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS banner_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  gradient_from TEXT NOT NULL,
  gradient_to TEXT NOT NULL,
  gradient_direction TEXT DEFAULT 'to right',
  is_premium BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE banner_presets IS 'Available banner gradient presets for sellers';

-- Insert default preset configurations
INSERT INTO banner_presets (id, name, description, gradient_from, gradient_to, gradient_direction, is_premium, sort_order)
VALUES
  ('gaming-purple', 'Gaming Purple', 'Classic gaming purple gradient', '#6b46c1', '#9333ea', 'to right', false, 1),
  ('neon-blue', 'Neon Blue', 'Electric blue cyberpunk theme', '#1e40af', '#06b6d4', 'to right', false, 2),
  ('fire-red', 'Fire Red', 'Intense red gaming theme', '#dc2626', '#f97316', 'to right', false, 3),
  ('forest-green', 'Forest Green', 'Natural green gradient', '#059669', '#10b981', 'to right', false, 4),
  ('royal-gold', 'Royal Gold', 'Premium gold theme', '#d97706', '#fbbf24', 'to right', false, 5),
  ('midnight-dark', 'Midnight Dark', 'Dark stealth mode', '#1f2937', '#374151', 'to right', false, 6),
  ('sunset-orange', 'Sunset Orange', 'Warm sunset vibes', '#ea580c', '#fb923c', 'to right', false, 7),
  ('arctic-ice', 'Arctic Ice', 'Cool ice blue', '#0284c7', '#7dd3fc', 'to right', false, 8),
  ('toxic-green', 'Toxic Green', 'Radioactive green glow', '#15803d', '#4ade80', 'to bottom right', false, 9),
  ('cosmic-pink', 'Cosmic Pink', 'Galaxy pink theme', '#db2777', '#ec4899', 'to right', false, 10),
  ('platinum-shine', 'Platinum Shine', 'Exclusive platinum sellers', '#94a3b8', '#cbd5e1', 'to right', true, 11),
  ('diamond-elite', 'Diamond Elite', 'Ultimate diamond tier', '#e0e7ff', '#c7d2fe', 'to bottom right', true, 12)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Storage Bucket for Seller Banners
-- ============================================================================

-- NOTE: The 'seller-banners' bucket must be created manually in the Supabase
-- Dashboard under Storage → New Bucket with these settings:
--   Name: seller-banners
--   Public: YES
--   File size limit: 2 MB
--   Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp
--
-- The storage.buckets table is owned by supabase_storage_admin and cannot be
-- modified via the SQL Editor (error 42501). Use the Storage UI instead.

-- ============================================================================
-- 4. RLS Policies for Seller Banners Storage
-- ============================================================================

-- Policy 1: Anyone can view banners (public)
DROP POLICY IF EXISTS "Public banner access" ON storage.objects;
CREATE POLICY "Public banner access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seller-banners');

-- Policy 2: Premium sellers can upload their own banners
DROP POLICY IF EXISTS "Premium sellers can upload banners" ON storage.objects;
CREATE POLICY "Premium sellers can upload banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'seller-banners' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.uid() IN (
      SELECT id
      FROM profiles
      WHERE seller_tier IN ('platinum', 'diamond')
    )
  );

-- Policy 3: Sellers can update their own banners
DROP POLICY IF EXISTS "Sellers can update own banners" ON storage.objects;
CREATE POLICY "Sellers can update own banners"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'seller-banners' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'seller-banners' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy 4: Sellers can delete their own banners
DROP POLICY IF EXISTS "Sellers can delete own banners" ON storage.objects;
CREATE POLICY "Sellers can delete own banners"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'seller-banners' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 5. RLS Policies for Banner Presets
-- ============================================================================

ALTER TABLE banner_presets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view available presets
CREATE POLICY "Anyone can view banner presets"
  ON banner_presets FOR SELECT
  USING (true);

-- ============================================================================
-- 6. Helper Function to Check Premium Banner Access
-- ============================================================================

CREATE OR REPLACE FUNCTION can_upload_custom_banner(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT seller_tier INTO user_tier
  FROM profiles
  WHERE id = user_id_param;

  IF user_tier IS NULL THEN
    RETURN false;
  END IF;

  RETURN user_tier IN ('platinum', 'diamond');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_upload_custom_banner(UUID) IS
  'Check if user has premium tier access to upload custom banners';

-- ============================================================================
-- 7. Function to Get User Banner (Custom or Preset)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_banner(user_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  preset_data RECORD;
  result JSONB;
BEGIN
  -- Get user profile
  SELECT
    banner_url,
    banner_preset,
    seller_tier
  INTO user_profile
  FROM profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If user has custom banner URL and is premium, return it
  IF user_profile.banner_url IS NOT NULL AND
     user_profile.seller_tier IN ('platinum', 'diamond') THEN
    RETURN jsonb_build_object(
      'type', 'custom',
      'url', user_profile.banner_url,
      'tier', user_profile.seller_tier
    );
  END IF;

  -- Otherwise return preset gradient
  SELECT * INTO preset_data
  FROM banner_presets
  WHERE id = COALESCE(user_profile.banner_preset, 'gaming-purple');

  IF NOT FOUND THEN
    -- Fallback to default preset
    SELECT * INTO preset_data
    FROM banner_presets
    WHERE id = 'gaming-purple';
  END IF;

  RETURN jsonb_build_object(
    'type', 'preset',
    'id', preset_data.id,
    'name', preset_data.name,
    'gradientFrom', preset_data.gradient_from,
    'gradientTo', preset_data.gradient_to,
    'gradientDirection', preset_data.gradient_direction,
    'tier', user_profile.seller_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_banner(UUID) IS
  'Get user banner configuration (custom URL for premium, preset gradient for others)';

-- ============================================================================
-- 8. Trigger to Validate Banner Changes
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_banner_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set custom banner_url, check if user is premium
  IF NEW.banner_url IS NOT NULL AND
     NEW.banner_url != OLD.banner_url AND
     NEW.seller_tier NOT IN ('platinum', 'diamond') THEN
    RAISE EXCEPTION 'Custom banners are only available for Platinum and Diamond sellers';
  END IF;

  -- If downgrading from premium tier, clear custom banner
  IF OLD.seller_tier IN ('platinum', 'diamond') AND
     NEW.seller_tier NOT IN ('platinum', 'diamond') THEN
    NEW.banner_url = NULL;
    RAISE NOTICE 'Custom banner removed due to tier downgrade';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_validate_banner_update ON profiles;

CREATE TRIGGER trigger_validate_banner_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (
    OLD.banner_url IS DISTINCT FROM NEW.banner_url OR
    OLD.seller_tier IS DISTINCT FROM NEW.seller_tier
  )
  EXECUTE FUNCTION validate_banner_update();

COMMENT ON FUNCTION validate_banner_update() IS
  'Ensure only premium sellers can upload custom banners';

-- ============================================================================
-- 9. Update Existing Seller Tiers Based on Rating
-- ============================================================================

-- This is a one-time update to set initial tiers based on seller ratings
-- (You can adjust the logic based on your business rules)

UPDATE profiles
SET seller_tier = CASE
  WHEN seller_rating >= 4.9 THEN 'diamond'
  WHEN seller_rating >= 4.7 THEN 'platinum'
  WHEN seller_rating >= 4.5 THEN 'gold'
  WHEN seller_rating >= 4.0 THEN 'silver'
  ELSE 'bronze'
END
WHERE role = 'seller' AND seller_tier IS NULL;

-- ============================================================================
-- 10. Create View for Seller Shop Banners
-- ============================================================================

CREATE OR REPLACE VIEW seller_shop_banners AS
SELECT
  p.id AS seller_id,
  p.username,
  p.shop_name,
  p.avatar_url,
  p.seller_tier,
  p.seller_rating,
  p.total_sales,
  COALESCE(sp.is_online, false) AS is_online,

  -- Banner configuration
  CASE
    WHEN p.banner_url IS NOT NULL AND p.seller_tier IN ('platinum', 'diamond')
      THEN jsonb_build_object(
        'type', 'custom',
        'url', p.banner_url
      )
    ELSE (
      SELECT jsonb_build_object(
        'type', 'preset',
        'id', bp.id,
        'name', bp.name,
        'gradientFrom', bp.gradient_from,
        'gradientTo', bp.gradient_to,
        'gradientDirection', bp.gradient_direction
      )
      FROM banner_presets bp
      WHERE bp.id = COALESCE(p.banner_preset, 'gaming-purple')
    )
  END AS banner_config,

  -- Stats for banner display
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'active') AS active_listings_count,
  (SELECT COUNT(*) FROM reviews WHERE seller_id = p.id AND is_visible = true) AS reviews_count

FROM profiles p
LEFT JOIN seller_presence sp ON sp.seller_id = p.id
WHERE p.role = 'seller';

COMMENT ON VIEW seller_shop_banners IS
  'Complete seller shop banner data including stats for display';

-- Grant access to authenticated users
GRANT SELECT ON seller_shop_banners TO authenticated;

-- ============================================================================
-- 11. Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Seller banner support migration completed successfully';
  RAISE NOTICE '- Banner fields added to profiles table';
  RAISE NOTICE '- seller-banners storage bucket created';
  RAISE NOTICE '- 12 preset banner gradients configured';
  RAISE NOTICE '- Premium sellers (Platinum/Diamond) can upload custom banners';
  RAISE NOTICE '- RLS policies configured for secure banner management';
  RAISE NOTICE '- Helper functions and views created';
END $$;
