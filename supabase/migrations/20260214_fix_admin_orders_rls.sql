-- ============================================================================
-- FIX ADMIN ORDERS RLS POLICY
-- Created: 2026-02-14
-- Purpose: Update admin policy to check admin_roles table using is_admin() function
-- ============================================================================

-- Drop the old admin policy that checks profiles.role
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- Create new admin policy using is_admin() helper function
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (public.is_admin());

-- Also update the admin UPDATE policy
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Also update the admin DELETE policy
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- NOTES
-- ============================================================================
-- This fixes the admin access issue where the old policy checked profiles.role
-- but the application uses admin_roles table to determine admin status.
-- We use the is_admin() helper function which checks admin_roles table.
-- ============================================================================
