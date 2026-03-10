-- Fix HTTP 431 error caused by base64 avatars bloating session cookies
-- Migration created: 2026-02-26
-- Issue: Avatar stored as 5-6 KB base64 data URI instead of 60-byte URL
-- Impact: Session cookies exceed browser header limits causing HTTP 431 on redirect

-- Step 1: Update all profiles with base64 avatars to use DiceBear API URLs
UPDATE profiles
SET
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || username,
  updated_at = now()
WHERE avatar_url LIKE 'data:image/svg+xml;base64,%';

-- Step 2: Update auth.users raw_user_meta_data to remove avatar_url
-- This prevents avatar from being stored in session cookies
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'avatar_url'
WHERE raw_user_meta_data ? 'avatar_url';

-- Log the migration
DO $$
DECLARE
  profiles_updated INTEGER;
  auth_users_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_updated FROM profiles WHERE avatar_url LIKE 'https://api.dicebear.com/%';
  SELECT COUNT(*) INTO auth_users_updated FROM auth.users WHERE NOT (raw_user_meta_data ? 'avatar_url');

  RAISE NOTICE 'Avatar Migration Complete:';
  RAISE NOTICE '  - Profiles with DiceBear URLs: %', profiles_updated;
  RAISE NOTICE '  - Auth users cleaned: %', auth_users_updated;
  RAISE NOTICE '  - Session cookie size reduced by ~5-6 KB per user';
END $$;
