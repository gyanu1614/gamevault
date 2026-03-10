-- ============================================================
-- Enable pgcrypto extension and backfill missing profiles
-- ============================================================

-- Step 1: Enable pgcrypto extension (required for gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Backfill missing profiles for existing users
INSERT INTO public.profiles (id, username, email, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  au.email,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON EXTENSION pgcrypto IS 'Required for referral code generation using gen_random_bytes()';
