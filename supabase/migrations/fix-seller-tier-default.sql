-- =====================================================
-- FIX: seller_tier should be NULL by default
-- Issue: All new users were automatically bronze sellers
-- Date: January 25, 2026
-- =====================================================

-- Step 1: Drop the old constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_seller_tier_check;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;

-- Step 2: Add new constraints that allow NULL
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_seller_tier_check
CHECK (seller_tier IS NULL OR seller_tier IN ('bronze', 'silver', 'gold', 'platinum'));

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_kyc_status_check
CHECK (kyc_status IS NULL OR kyc_status IN ('pending', 'approved', 'rejected'));

-- Step 3: Reset users who shouldn't be sellers
-- This resets users who have bronze tier but:
-- - Never created a listing
-- - Never made a sale
-- - Have no business_name or paypal_email set

UPDATE public.profiles
SET
  seller_tier = NULL,
  kyc_status = NULL
WHERE
  seller_tier = 'bronze'
  AND total_sales = 0
  AND business_name IS NULL
  AND paypal_email IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE seller_id = profiles.id
  );

-- Step 4: Verify the fix
SELECT
  COUNT(*) FILTER (WHERE seller_tier IS NULL) as non_sellers,
  COUNT(*) FILTER (WHERE seller_tier IS NOT NULL) as sellers,
  COUNT(*) as total_users
FROM public.profiles;

-- =====================================================
-- COMPLETE ✅
-- =====================================================
