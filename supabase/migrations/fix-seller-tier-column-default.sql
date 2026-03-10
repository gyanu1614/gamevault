-- =====================================================
-- FIX: Remove DEFAULT 'bronze' from seller_tier column
-- Issue: Column still has DEFAULT even after constraint fix
-- Date: January 25, 2026
-- =====================================================

-- Remove the default value from seller_tier column
ALTER TABLE public.profiles
ALTER COLUMN seller_tier DROP DEFAULT;

-- Remove the default value from kyc_status column
ALTER TABLE public.profiles
ALTER COLUMN kyc_status DROP DEFAULT;

-- Reset all existing users to NULL (unless they have real seller activity)
UPDATE public.profiles
SET
  seller_tier = NULL,
  kyc_status = NULL
WHERE
  (seller_tier = 'bronze' OR seller_tier IS NOT NULL)
  AND total_sales = 0
  AND business_name IS NULL
  AND paypal_email IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE seller_id = profiles.id
  );

-- Verify the fix
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('seller_tier', 'kyc_status');

-- Count users
SELECT
  COUNT(*) FILTER (WHERE seller_tier IS NULL) as non_sellers,
  COUNT(*) FILTER (WHERE seller_tier IS NOT NULL) as sellers,
  COUNT(*) as total_users
FROM public.profiles;

-- =====================================================
-- COMPLETE ✅
-- =====================================================
