-- ============================================
-- GAMEVAULT - AUTH TESTING & DEBUGGING
-- ============================================
-- Run these queries to debug signup/login issues

-- ============================================
-- 1. CHECK IF EXTENSIONS ARE ENABLED
-- ============================================

SELECT
  extname AS extension_name,
  extversion AS version
FROM pg_extension
WHERE extname = 'uuid-ossp';

-- Expected: Should return 1 row with uuid-ossp

-- ============================================
-- 2. CHECK IF PROFILES TABLE EXISTS
-- ============================================

SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'profiles';

-- Expected: Should return 1 row

-- ============================================
-- 3. CHECK PROFILES TABLE STRUCTURE
-- ============================================

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected: Should show all profile columns

-- ============================================
-- 4. CHECK IF TRIGGER EXISTS
-- ============================================

SELECT
  tgname AS trigger_name,
  tgtype AS trigger_type,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Expected: Should return 1 row

-- ============================================
-- 5. CHECK IF FUNCTION EXISTS
-- ============================================

SELECT
  proname AS function_name,
  prosecdef AS is_security_definer,
  prokind AS kind
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Expected: Should return 1 row, prosecdef should be 't' (true)

-- ============================================
-- 6. CHECK RLS POLICIES ON PROFILES
-- ============================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Expected: Should return 3 policies (select, update, insert)

-- ============================================
-- 7. CHECK EXISTING PROFILES
-- ============================================

SELECT
  id,
  username,
  full_name,
  seller_tier,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Shows existing user profiles

-- ============================================
-- 8. CHECK AUTH USERS (requires admin access)
-- ============================================

-- CAUTION: Only run if you have access to auth.users
-- This requires service_role or admin privileges

SELECT
  id,
  email,
  raw_user_meta_data->>'username' AS username,
  created_at,
  confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Shows users from auth.users table

-- ============================================
-- 9. CHECK FOR ORPHANED AUTH USERS
-- ============================================

-- Find auth.users that don't have a profile
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'username' AS username,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- Expected: Should be empty (no orphaned users)

-- ============================================
-- 10. TEST TRIGGER MANUALLY (if needed)
-- ============================================

-- CAUTION: Only use this to manually create profiles for orphaned users
-- Replace the UUID and values with actual data

-- INSERT INTO public.profiles (id, username, full_name)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,  -- Replace with actual user ID
--   'testuser',
--   'Test User'
-- );

-- ============================================
-- 11. CHECK TABLE PERMISSIONS
-- ============================================

SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- Expected: Should show permissions for anon, authenticated, service_role

-- ============================================
-- 12. CHECK IF RLS IS ENABLED
-- ============================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- Expected: rls_enabled should be 't' (true)

-- ============================================
-- COMMON ISSUES & SOLUTIONS
-- ============================================

/*
ISSUE 1: "fetch failed" during signup
SOLUTION:
  - Make sure fix-auth.sql has been run
  - Check Supabase project URL and API keys are correct
  - Verify RLS policies exist

ISSUE 2: User created but no profile
SOLUTION:
  - Check if trigger exists (query #4)
  - Check if trigger is enabled
  - Run fix-auth.sql to recreate trigger

ISSUE 3: "permission denied for table profiles"
SOLUTION:
  - Check RLS policies (query #6)
  - Check table permissions (query #11)
  - Run fix-auth.sql to fix permissions

ISSUE 4: "duplicate key value violates unique constraint"
SOLUTION:
  - Username already exists
  - Check existing profiles (query #7)
  - Choose a different username

ISSUE 5: Supabase connection error
SOLUTION:
  - Verify NEXT_PUBLIC_SUPABASE_URL in .env.local
  - Verify NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
  - Check if Supabase project is active
*/
