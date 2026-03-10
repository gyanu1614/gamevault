-- ============================================================================
-- ALLOW ADMIN DETECTION FOR CHAT
-- Created: 2026-02-15
-- Purpose: Allow all authenticated users to check if someone is an admin
--          (needed for proper admin message display in chats)
-- ============================================================================

-- Policy: All authenticated users can check who is an admin (for chat display)
-- This is safe because:
-- 1. It's read-only
-- 2. Admin status is public info (shown when they message in chats)
-- 3. Doesn't reveal sensitive admin data (only user_id and is_active)
CREATE POLICY "Authenticated users can view admin status for chat"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================================
-- NOTES
-- ============================================================================
-- This policy allows buyers and sellers to detect admin messages in order chats
-- so they can display them with the proper "Support Team" badge and styling.
-- Without this, admin messages appear as if sent by the other party.
-- ============================================================================
