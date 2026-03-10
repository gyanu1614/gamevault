-- =====================================================
-- ADD ADMIN ACCESS TO MESSAGING SYSTEM
-- =====================================================
-- Allow admins to view and participate in all conversations

-- Add admin policy for viewing conversations
CREATE POLICY "Admins can view all conversations"
ON conversations
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Add admin policy for viewing messages
CREATE POLICY "Admins can view all messages"
ON messages
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Add admin policy for sending messages in any conversation
CREATE POLICY "Admins can send messages in any conversation"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND auth.uid() = sender_id);

-- Add admin policy for updating messages
CREATE POLICY "Admins can update any message"
ON messages
FOR UPDATE
TO authenticated
USING (public.is_admin());
