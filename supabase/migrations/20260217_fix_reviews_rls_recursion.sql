-- =====================================================
-- Fix Reviews RLS Infinite Recursion
-- =====================================================
-- The INSERT policy was querying reviews table causing recursion
-- The UNIQUE constraint on order_id already prevents duplicates
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Buyers can create reviews for completed orders" ON reviews;

-- Recreate without the nested reviews SELECT
CREATE POLICY "Buyers can create reviews for completed orders"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND orders.buyer_id = auth.uid()
        AND orders.status = 'completed'
    )
  );

-- Note: The UNIQUE constraint on order_id already prevents duplicate reviews
-- So we don't need to check for existing reviews in the policy
