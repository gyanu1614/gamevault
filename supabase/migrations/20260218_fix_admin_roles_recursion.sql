-- ============================================================
-- CRITICAL FIX: admin_roles infinite recursion
-- Created: 2026-02-18
-- Root cause:
--   Policies on admin_roles (FOR SELECT, FOR ALL) contained
--   subqueries that SELECT from admin_roles itself. PostgreSQL
--   re-evaluates RLS policies on every row access, so querying
--   admin_roles inside an admin_roles policy = infinite loop.
--
-- Fix strategy:
--   1. Drop ALL existing policies on admin_roles
--   2. Create a SECURITY DEFINER helper that bypasses RLS
--      when checking super_admin status
--   3. Recreate policies using ONLY the safe helper OR
--      simple column comparisons (auth.uid() = user_id)
--      which do NOT re-query admin_roles
--
-- Also fixes:
--   - Listings not appearing in marketplace (active listings
--     policy conflict with seller-own-listings policy)
--   - listing_templates SELECT (admin check was recursive too)
-- ============================================================

-- ─── STEP 1: Create a SECURITY DEFINER bypass function ──────────────────────
-- This function runs with superuser privileges so it bypasses RLS entirely.
-- Safe to use inside policies because it cannot itself trigger those policies.

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

-- Recreate is_admin() as SECURITY DEFINER (it already is, but ensure it's clean)
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

-- ─── STEP 2: Drop ALL existing policies on admin_roles ──────────────────────

DROP POLICY IF EXISTS "Users can view own admin role" ON admin_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON admin_roles;
DROP POLICY IF EXISTS "Authenticated users can view admin status for chat" ON admin_roles;
DROP POLICY IF EXISTS "Admins can manage admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Only super_admin can manage admin roles" ON admin_roles;

-- ─── STEP 3: Recreate policies WITHOUT self-referencing subqueries ───────────

-- 3a. Any authenticated user can read rows where they are the user
--     (needed for own-role check, chat badge, moderation checks)
--     Uses ONLY auth.uid() = user_id — zero recursion risk.
CREATE POLICY "Users can view own admin role"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3b. All authenticated users can see active admin rows
--     (needed for chat "Support Team" badge display)
--     Simple boolean column — zero recursion risk.
CREATE POLICY "Authenticated users can view admin status for chat"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 3c. Only super_admin can INSERT/UPDATE/DELETE admin_roles.
--     Uses is_super_admin_safe() which is SECURITY DEFINER — bypasses RLS.
CREATE POLICY "Only super_admin can manage admin roles"
  ON admin_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin_safe())
  WITH CHECK (
    public.is_super_admin_safe()
    AND user_id != auth.uid()   -- cannot grant self
  );

-- ─── STEP 4: Fix listings policies ──────────────────────────────────────────
-- Problem: Multiple overlapping SELECT policies could conflict.
-- The "Admins can manage all listings" FOR ALL policy using admin_roles
-- subquery may also trigger recursion if called during an admin_roles check.
-- Fix: Use is_admin() SECURITY DEFINER instead of inline subqueries.

-- Drop the old admin listings policies that use inline admin_roles subqueries
DROP POLICY IF EXISTS "Admins can manage all listings" ON listings;
DROP POLICY IF EXISTS "Admins can view all listings" ON listings;

-- Recreate using SECURITY DEFINER function (safe)
CREATE POLICY "Admins can manage all listings"
  ON listings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 5: Fix listing_templates policy ───────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage listing templates" ON listing_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON listing_templates;

CREATE POLICY "Admins can manage listing templates"
  ON listing_templates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 6: Fix orders admin policy ────────────────────────────────────────
-- 20260214_fix_admin_orders_rls.sql already uses is_admin() — verify it's current.
-- Drop and recreate to be sure.

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

-- ─── STEP 7: Fix profiles admin policy ──────────────────────────────────────
-- The "Admins can update any profile" policy in security_rls_hardening
-- uses an inline admin_roles subquery — replace with SECURITY DEFINER.

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── STEP 8: Ensure listings have correct public SELECT policy ───────────────
-- Make sure the public/anonymous marketplace can still see active listings.
-- This policy must exist and must NOT be blocked by other policies.

DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;
DROP POLICY IF EXISTS "Public can view active listings" ON listings;

-- Single clean public SELECT policy
CREATE POLICY "Public can view active listings"
  ON listings FOR SELECT
  TO public
  USING (status = 'active');

-- ─── VERIFICATION NOTES ─────────────────────────────────────────────────────
-- After applying this migration:
--   1. Admin pages: should stop throwing 42P17 infinite recursion
--   2. Marketplace: active listings should appear for anonymous users
--   3. Listing creation: template loading should work (no more admin_roles recursion)
--   4. Orders: sellers see their sales, buyers see their purchases
--   5. Admin panel: admins can manage listings/orders/users
