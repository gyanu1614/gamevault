-- ============================================================
-- MASTER FIX: All RLS recursion & login issues
-- Created: 2026-02-19 | Updated: 2026-02-19 (v2 — complete)
-- Apply this SINGLE file in Supabase SQL Editor.
-- This replaces/supersedes all previous fix attempts.
--
-- Fixes:
--   1. "Database error granting user" on login
--      Cause: handle_new_user() trigger UPDATE on profiles
--             triggers "Users can update own profile (restricted)"
--             which self-queries profiles, which triggers
--             "Admins can update any profile" which queries
--             admin_roles inline → 42P17 infinite recursion
--
--   2. "infinite recursion detected in policy for relation admin_roles"
--      (42P17) on listing templates, marketplace, orders, etc.
--      Cause: admin_roles SELECT/ALL policies query admin_roles
--
--   3. Marketplace shows 0 listings
--      Cause: conflicting policy on listings table
--
--   4. is_guest_order column missing (PGRST204 on checkout)
--
--   5. audit_logs "Admins can read audit logs" uses inline
--      admin_roles subquery → 42P17 when admin reads logs
--
--   6. validate_banner_update() not SECURITY DEFINER
--      (safe after Part 4 ordering fix, but hardened here)
--
--   7. on_auth_user_created fires on UPDATE → every login
--      triggers profiles upsert chain unnecessarily
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PART 1: SECURITY DEFINER helper functions (bypass RLS)
-- ════════════════════════════════════════════════════════════

-- is_admin(): safe to use inside policies — bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

-- is_super_admin_safe(): for managing admin_roles itself
CREATE OR REPLACE FUNCTION public.is_super_admin_safe()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- has_permission(): existing function, ensure it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    JOIN public.role_permissions rp ON ar.role = rp.role
    WHERE ar.user_id = auth.uid()
      AND ar.is_active = true
      AND rp.permission = required_permission
  );
$$;

-- ════════════════════════════════════════════════════════════
-- PART 2: Fix admin_roles policies (the root recursion source)
-- ════════════════════════════════════════════════════════════

-- Drop ALL existing admin_roles policies
DROP POLICY IF EXISTS "Users can view own admin role" ON admin_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON admin_roles;
DROP POLICY IF EXISTS "Authenticated users can view admin status for chat" ON admin_roles;
DROP POLICY IF EXISTS "Admins can manage admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Only super_admin can manage admin roles" ON admin_roles;

-- Simple: users see their own row (auth.uid() = user_id — no subquery)
CREATE POLICY "Users can view own admin role"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- All authenticated users see active admin rows (for chat badge display)
CREATE POLICY "Authenticated users can view admin status for chat"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only super_admin can INSERT/UPDATE/DELETE — uses SECURITY DEFINER function
CREATE POLICY "Only super_admin can manage admin roles"
  ON admin_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin_safe())
  WITH CHECK (
    public.is_super_admin_safe()
    AND user_id != auth.uid()
  );

-- ════════════════════════════════════════════════════════════
-- PART 3: Fix profiles policies (self-referencing WITH CHECK)
-- ════════════════════════════════════════════════════════════

-- Drop the problematic self-referencing policies
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Simple policy: users can update their own row
-- Privilege escalation prevention is handled by TRIGGER below (safer)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile (uses SECURITY DEFINER — no recursion)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Ensure profiles are readable (needed for many things)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO public
  USING (true);

-- ════════════════════════════════════════════════════════════
-- PART 4: Trigger to prevent privilege escalation on profiles
-- Replaces the old self-referencing WITH CHECK approach
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- Normal users: preserve protected fields from OLD record
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

-- ════════════════════════════════════════════════════════════
-- PART 5: Fix handle_new_user trigger (login fails on UPDATE)
-- ════════════════════════════════════════════════════════════

-- Make referral code generator SECURITY DEFINER so it bypasses RLS
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
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    new_code := UPPER(
      SUBSTRING(REPLACE(COALESCE(NEW.username, 'USR'), '-', ''), 1, 3) ||
      SUBSTRING(ENCODE(gen_random_bytes(4), 'hex'), 1, 6)
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = new_code
    );
    attempts := attempts + 1;
    IF attempts > 10 THEN
      new_code := UPPER(SUBSTRING(ENCODE(gen_random_bytes(5), 'hex'), 1, 8));
      EXIT;
    END IF;
  END LOOP;
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code_for_new_user();

-- Ensure handle_new_user is SECURITY DEFINER and clean
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
  RETURN NEW;
END;
$$;

-- Change to INSERT-only: login (UPDATE on auth.users) no longer
-- triggers a profiles upsert, eliminating the login trigger chain.
-- New users still get a profile on signup (INSERT).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- PART 6: Fix listings policies
-- ════════════════════════════════════════════════════════════

-- Drop conflicting admin listings policies (had inline admin_roles subquery)
DROP POLICY IF EXISTS "Admins can manage all listings" ON listings;
DROP POLICY IF EXISTS "Admins can view all listings" ON listings;

-- Recreate using SECURITY DEFINER is_admin()
CREATE POLICY "Admins can manage all listings"
  ON listings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Ensure public marketplace can see active listings
DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;
DROP POLICY IF EXISTS "Public can view active listings" ON listings;

CREATE POLICY "Public can view active listings"
  ON listings FOR SELECT
  TO public
  USING (status = 'active');

-- ════════════════════════════════════════════════════════════
-- PART 7: Fix listing_templates policies
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can manage listing templates" ON listing_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON listing_templates;

CREATE POLICY "Admins can manage listing templates"
  ON listing_templates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ════════════════════════════════════════════════════════════
-- PART 8: Fix orders policies
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ════════════════════════════════════════════════════════════
-- PART 9: Add missing orders columns (fixes checkout PGRST204)
-- ════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_guest_order BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.is_guest_order
  IS 'TRUE if the order was placed without a persistent account (guest checkout).';

CREATE INDEX IF NOT EXISTS idx_orders_guest
  ON orders (is_guest_order)
  WHERE is_guest_order = TRUE;

-- ════════════════════════════════════════════════════════════
-- PART 10: Fix audit_logs RLS (inline admin_roles subquery)
-- ════════════════════════════════════════════════════════════
-- The "Admins can read audit logs" policy uses an inline
-- admin_roles subquery → 42P17 when admin panel reads logs.
-- Replace with is_admin() SECURITY DEFINER.
-- The INSERT policy WITH CHECK (false) blocks authenticated-role
-- inserts; SECURITY DEFINER triggers bypass it, but we clean
-- it up to avoid confusion and future issues.

DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs are readable by admins" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

-- Admins can read — uses SECURITY DEFINER is_admin() (no recursion)
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Inserts only from SECURITY DEFINER functions (trigger runs as owner,
-- bypasses RLS entirely — this policy covers direct API calls)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);
-- Note: WITH CHECK (false) is correct here — direct INSERT via API is blocked.
-- The log_profile_privilege_changes() trigger is SECURITY DEFINER so it
-- runs as the function owner (postgres) and bypasses RLS completely.

-- ════════════════════════════════════════════════════════════
-- PART 11: Make validate_banner_update SECURITY DEFINER
-- ════════════════════════════════════════════════════════════
-- validate_banner_update() was NOT SECURITY DEFINER. While it
-- doesn't directly query admin_roles, hardening it prevents any
-- future RLS issues if the function is ever extended.

CREATE OR REPLACE FUNCTION validate_banner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If trying to set custom banner_url, check if user is premium tier
  IF NEW.banner_url IS NOT NULL AND
     NEW.banner_url IS DISTINCT FROM OLD.banner_url AND
     NEW.seller_tier NOT IN ('platinum', 'diamond') THEN
    RAISE EXCEPTION 'Custom banners are only available for Platinum and Diamond sellers';
  END IF;

  -- If downgrading from premium tier, clear custom banner
  IF OLD.seller_tier IN ('platinum', 'diamond') AND
     NEW.seller_tier NOT IN ('platinum', 'diamond') THEN
    NEW.banner_url := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_validate_banner_update ON profiles;
CREATE TRIGGER trigger_validate_banner_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (
    OLD.banner_url IS DISTINCT FROM NEW.banner_url OR
    OLD.seller_tier IS DISTINCT FROM NEW.seller_tier
  )
  EXECUTE FUNCTION validate_banner_update();

-- ════════════════════════════════════════════════════════════
-- DONE. Summary of what this fixes:
-- ════════════════════════════════════════════════════════════
-- ✅ Login "Database error granting user" — fixed via PART 3+4+5
-- ✅ 42P17 infinite recursion on admin_roles — fixed via PART 1+2
-- ✅ Marketplace 0 listings — fixed via PART 6
-- ✅ Template loading failure — fixed via PART 7
-- ✅ My Sales / My Purchases empty — fixed via PART 8
-- ✅ Checkout PGRST204 — fixed via PART 9
-- ✅ Admin panel audit log recursion — fixed via PART 10
-- ✅ validate_banner_update hardened — fixed via PART 11
