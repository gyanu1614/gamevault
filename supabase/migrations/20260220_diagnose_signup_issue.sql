-- ============================================================
-- Diagnose signup issue
-- Run this in Supabase SQL Editor to see what's wrong
-- ============================================================

-- Check if profiles table has all required columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check all triggers on auth.users
SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth';

-- Check the actual function definition
SELECT pg_get_functiondef('public.handle_new_user'::regproc);

-- Check RLS policies on profiles table
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
WHERE tablename = 'profiles'
  AND schemaname = 'public';
