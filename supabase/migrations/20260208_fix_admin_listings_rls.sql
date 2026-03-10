-- Fix Admin RLS Policy to use admin_roles table
-- This allows admins in admin_roles table to view and manage all listings

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can manage all listings" ON listings;

-- Create updated policy that checks admin_roles table
CREATE POLICY "Admins can manage all listings"
ON listings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role IN ('admin', 'super_admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role IN ('admin', 'super_admin', 'moderator')
  )
);

-- Also update the insert policy to check admin_roles
DROP POLICY IF EXISTS "Sellers can insert their own listings" ON listings;

CREATE POLICY "Sellers can insert their own listings"
ON listings
FOR INSERT
TO authenticated
WITH CHECK (
  -- Sellers can only create listings for themselves
  (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'seller'
    )
  )
  OR
  -- Admins from admin_roles table can create listings for any seller
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role IN ('admin', 'super_admin')
  )
);
