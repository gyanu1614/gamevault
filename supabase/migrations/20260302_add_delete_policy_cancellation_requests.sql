-- ============================================================================
-- Add DELETE policy for buyers to delete their own pending cancellation requests
-- ============================================================================
-- This fixes the bug where buyers could not actually undo their cancellation requests
-- The DELETE command was succeeding without error, but RLS was silently blocking it
-- ============================================================================

CREATE POLICY "Buyers can delete own pending cancellation requests"
  ON order_cancellation_requests
  FOR DELETE
  USING (
    buyer_id = auth.uid()
    AND status = 'pending'
  );

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'order_cancellation_requests'
AND cmd = 'DELETE';
