-- Fix RLS policy for seller_applications to allow users to withdraw their own applications

-- Drop existing update policies if they exist
DROP POLICY IF EXISTS "Users can update their own pending/under_review application" ON seller_applications;
DROP POLICY IF EXISTS "Users can update their own application" ON seller_applications;
DROP POLICY IF EXISTS "Users can withdraw their own application" ON seller_applications;

-- Create policy that allows users to withdraw their own pending/under_review applications
CREATE POLICY "Users can withdraw their own application"
ON seller_applications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status IN ('pending', 'under_review')
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'withdrawn'
);
