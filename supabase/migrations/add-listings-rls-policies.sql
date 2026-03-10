-- RLS Policies for Listings Table
-- Allows sellers to create and manage their own listings

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;
DROP POLICY IF EXISTS "Sellers can insert their own listings" ON listings;
DROP POLICY IF EXISTS "Sellers can update their own listings" ON listings;
DROP POLICY IF EXISTS "Sellers can delete their own listings" ON listings;
DROP POLICY IF EXISTS "Admins can manage all listings" ON listings;

-- 1. Public can view active listings
CREATE POLICY "Anyone can view active listings"
ON listings
FOR SELECT
TO public
USING (status = 'active');

-- 2. Sellers can insert their own listings
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
  -- Admins can create listings for any seller
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 3. Sellers can update their own listings
CREATE POLICY "Sellers can update their own listings"
ON listings
FOR UPDATE
TO authenticated
USING (
  auth.uid() = seller_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'seller'
  )
)
WITH CHECK (
  auth.uid() = seller_id
);

-- 4. Sellers can delete their own listings
CREATE POLICY "Sellers can delete their own listings"
ON listings
FOR DELETE
TO authenticated
USING (
  auth.uid() = seller_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'seller'
  )
);

-- 5. Admins can manage all listings
CREATE POLICY "Admins can manage all listings"
ON listings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);
