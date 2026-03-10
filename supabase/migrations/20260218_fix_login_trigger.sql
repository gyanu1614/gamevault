-- ============================================================
-- CRITICAL FIX: "Database error granting user" on login
-- Created: 2026-02-18
--
-- Root cause:
--   On every login, Supabase fires the `on_auth_user_created`
--   trigger (AFTER INSERT OR UPDATE ON auth.users) which calls
--   handle_new_user(). That function upserts into profiles.
--
--   The upsert fires the BEFORE INSERT trigger
--   trg_generate_referral_code → generate_referral_code_for_new_user().
--
--   Inside that function:
--     EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code)
--
--   This queries profiles WITH RLS active. The profiles RLS
--   policies include one that self-references profiles:
--     "Users can update own profile (restricted)" WITH CHECK (
--       role = (SELECT role FROM profiles WHERE id = auth.uid()) ...
--     )
--
--   That self-reference plus the admin_roles infinite recursion
--   (fixed in 20260218_fix_admin_roles_recursion.sql) causes the
--   whole login transaction to abort with code "Database error
--   granting user".
--
-- Fixes:
--   1. Make generate_referral_code_for_new_user() SECURITY DEFINER
--      so it bypasses RLS when checking referral code uniqueness
--   2. Fix profiles self-referencing UPDATE policy to avoid
--      subqueries that re-query profiles during UPDATE
--   3. Ensure handle_new_user() is safe and minimal
-- ============================================================

-- ─── FIX 1: Make referral code generator SECURITY DEFINER ────────────────────
-- This allows the trigger to query profiles for uniqueness check
-- without hitting RLS policies (which can recurse).

CREATE OR REPLACE FUNCTION generate_referral_code_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts  INT := 0;
BEGIN
  -- If referral_code already set, do nothing
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    new_code := UPPER(
      SUBSTRING(REPLACE(COALESCE(NEW.username, 'USR'), '-', ''), 1, 3) ||
      SUBSTRING(ENCODE(gen_random_bytes(4), 'hex'), 1, 6)
    );
    -- Exit if unique (no collision) — SECURITY DEFINER bypasses RLS here
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = new_code
    );
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback: pure random 8-char hex
      new_code := UPPER(SUBSTRING(ENCODE(gen_random_bytes(5), 'hex'), 1, 8));
      EXIT;
    END IF;
  END LOOP;

  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

-- Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code_for_new_user();

-- ─── FIX 2: Fix profiles self-referencing UPDATE policy ──────────────────────
-- The old policy did:
--   WITH CHECK (
--     role = (SELECT role FROM profiles WHERE id = auth.uid())
--     ...
--   )
-- This re-queries profiles during a profiles UPDATE → can recurse or deadlock.
-- Replace with a trigger-based guard instead (more reliable).

DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Simple safe policy: users can update their own row.
-- Privilege-escalation prevention is handled by the trigger below.
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── FIX 3: Trigger to prevent privilege escalation on profiles ───────────────
-- Since we removed the self-referencing WITH CHECK, we use a BEFORE UPDATE
-- trigger to enforce that normal users cannot change role/seller_tier/is_verified.
-- Admins (checked via is_admin() SECURITY DEFINER) can change anything.

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user is an admin, allow all changes
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Otherwise, preserve protected fields from OLD record
  NEW.role        := OLD.role;
  NEW.seller_tier := OLD.seller_tier;
  NEW.is_verified := COALESCE(OLD.is_verified, false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- ─── FIX 4: Ensure handle_new_user is safe and SECURITY DEFINER ──────────────
-- Already SECURITY DEFINER from 20260127_add_email_to_profiles.sql
-- but re-create to ensure it's clean and handles the referral_code column.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email      = EXCLUDED.email,
    updated_at = NOW();
  -- Note: referral_code is set by trg_generate_referral_code BEFORE INSERT trigger
  RETURN NEW;
END;
$$;

-- Ensure the auth trigger still exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── FIX 5: Fix profiles SELECT policy (ensure users can read profiles) ───────
-- Some select policies on profiles may also be missing or broken.
-- Ensure a clean set exists.

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

-- Anyone (incl. anonymous) can view public profile data (username, avatar, etc.)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO public
  USING (true);

-- ─── VERIFICATION NOTES ──────────────────────────────────────────────────────
-- After applying:
--   1. Login should succeed without "Database error granting user"
--   2. New user signup should also work correctly
--   3. Referral codes are still generated for new users
--   4. Normal users still cannot escalate their own role/tier
--   5. Admins can still update any profile field (via is_admin() check in trigger)
