-- Fix Seller Listings SELECT Policy
-- CRITICAL: Sellers need to view ALL their own listings (draft, paused, pending_approval, etc.)
-- Date: 2026-02-09

-- Drop the old public select policy
DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;

-- Create updated SELECT policies

-- 1. Public can view active listings (marketplace)
CREATE POLICY "Public can view active listings"
ON listings
FOR SELECT
TO public
USING (status = 'active');

-- 2. Sellers can view ALL their own listings (regardless of status)
CREATE POLICY "Sellers can view their own listings"
ON listings
FOR SELECT
TO authenticated
USING (
  auth.uid() = seller_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'seller'
  )
);

-- Note: The "Admins can manage all listings" policy already covers admin SELECT access

-- Add comment for documentation
COMMENT ON POLICY "Sellers can view their own listings" ON listings IS
'Allows sellers to view all their own listings regardless of status (draft, active, paused, pending_approval, sold, archived). This is critical for the seller dashboard.';
