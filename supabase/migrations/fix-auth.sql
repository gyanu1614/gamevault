-- ============================================
-- GAMEVAULT - AUTH SETUP & FIX
-- ============================================
-- Run this in Supabase SQL Editor to fix signup/login issues
-- This script is idempotent (safe to run multiple times)

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================

create extension if not exists "uuid-ossp";

-- ============================================
-- 2. CREATE PROFILES TABLE (if not exists)
-- ============================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Seller information
  seller_tier text default null check (seller_tier in ('bronze', 'silver', 'gold', 'platinum')),
  total_sales integer default 0,
  seller_rating numeric(3, 2) default 0.00 check (seller_rating >= 0 and seller_rating <= 5),
  total_reviews integer default 0,

  -- KYC status
  kyc_status text default 'pending' check (kyc_status in ('pending', 'approved', 'rejected')),
  kyc_submitted_at timestamptz,

  -- Seller payout info
  stripe_account_id text,
  payout_enabled boolean default false,

  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30)
);

-- ============================================
-- 3. ENABLE RLS ON PROFILES
-- ============================================

alter table public.profiles enable row level security;

-- ============================================
-- 4. DROP EXISTING POLICIES (to recreate them)
-- ============================================

drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

-- ============================================
-- 5. CREATE POLICIES
-- ============================================

-- Allow everyone to view profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

-- Allow users to update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Allow service role to insert profiles (for trigger)
create policy "Service role can insert profiles"
  on profiles for insert
  with check (true);

-- ============================================
-- 6. CREATE/REPLACE UPDATE TIMESTAMP FUNCTION
-- ============================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================
-- 7. CREATE UPDATE TRIGGER
-- ============================================

drop trigger if exists update_profiles_updated_at on public.profiles;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 8. CREATE/REPLACE HANDLE NEW USER FUNCTION
-- ============================================

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
exception
  when others then
    -- Log error but don't fail user creation
    raise warning 'Error creating profile for user %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql;

-- ============================================
-- 9. CREATE TRIGGER ON AUTH.USERS
-- ============================================

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================
-- 10. GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant usage on schema
grant usage on schema public to postgres, anon, authenticated, service_role;

-- Grant permissions on profiles table
grant all on public.profiles to postgres, service_role;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- Grant permissions on functions
grant execute on function public.handle_new_user() to postgres, service_role;
grant execute on function update_updated_at_column() to postgres, service_role;

-- ============================================
-- 11. VERIFY SETUP
-- ============================================

-- Check if trigger exists
do $$
declare
  trigger_count integer;
begin
  select count(*) into trigger_count
  from pg_trigger
  where tgname = 'on_auth_user_created';

  if trigger_count > 0 then
    raise notice '✅ Trigger "on_auth_user_created" exists';
  else
    raise warning '❌ Trigger "on_auth_user_created" NOT found';
  end if;
end $$;

-- Check if function exists
do $$
declare
  function_count integer;
begin
  select count(*) into function_count
  from pg_proc
  where proname = 'handle_new_user';

  if function_count > 0 then
    raise notice '✅ Function "handle_new_user" exists';
  else
    raise warning '❌ Function "handle_new_user" NOT found';
  end if;
end $$;

-- Check if profiles table exists
do $$
declare
  table_count integer;
begin
  select count(*) into table_count
  from information_schema.tables
  where table_schema = 'public' and table_name = 'profiles';

  if table_count > 0 then
    raise notice '✅ Table "profiles" exists';
  else
    raise warning '❌ Table "profiles" NOT found';
  end if;
end $$;

-- ============================================
-- DONE!
-- ============================================

-- After running this script:
-- 1. Try signing up with a new account
-- 2. Check the profiles table: SELECT * FROM profiles;
-- 3. If still having issues, check Supabase logs in Dashboard > Logs
