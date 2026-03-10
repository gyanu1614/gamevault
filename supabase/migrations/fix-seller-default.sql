-- Fix seller_tier default to NULL instead of 'bronze'
-- This ensures new users are buyers by default, not sellers

-- 1. Update the profiles table to change seller_tier default to NULL
ALTER TABLE public.profiles
ALTER COLUMN seller_tier DROP DEFAULT;

ALTER TABLE public.profiles
ALTER COLUMN seller_tier SET DEFAULT NULL;

-- 2. Update existing constraint to allow NULL
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_seller_tier_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_seller_tier_check
CHECK (seller_tier IS NULL OR seller_tier IN ('bronze', 'silver', 'gold', 'platinum'));

-- 3. Update all existing profiles that have 'bronze' to NULL (make them buyers)
-- IMPORTANT: Only do this if you want to convert existing users to buyers
-- Comment out this line if you want to keep existing sellers as sellers
UPDATE public.profiles
SET seller_tier = NULL
WHERE seller_tier = 'bronze' AND total_sales = 0;

-- 4. Recreate the handle_new_user function to explicitly set seller_tier to NULL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    seller_tier,
    total_sales,
    seller_rating,
    total_reviews,
    kyc_status,
    payout_enabled
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    NULL,  -- Explicitly NULL - user is a buyer by default
    0,
    0.00,
    0,
    'pending',
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! New signups will now be buyers, not sellers.
