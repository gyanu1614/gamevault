-- =====================================================
-- MESSAGING SYSTEM RLS POLICIES
-- =====================================================
-- Enable RLS on conversations and messages tables
-- Allows users to create and view their own conversations

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CONVERSATIONS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

-- SELECT: Users can view conversations where they are buyer or seller
CREATE POLICY "Users can view their own conversations"
ON conversations
FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id OR
  auth.uid() = seller_id
);

-- INSERT: Users can create conversations
CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = buyer_id OR
  auth.uid() = seller_id
);

-- UPDATE: Users can update conversations they're part of
CREATE POLICY "Users can update their conversations"
ON conversations
FOR UPDATE
TO authenticated
USING (
  auth.uid() = buyer_id OR
  auth.uid() = seller_id
)
WITH CHECK (
  auth.uid() = buyer_id OR
  auth.uid() = seller_id
);

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- SELECT: Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
ON messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
  )
);

-- INSERT: Users can send messages in conversations they're part of
CREATE POLICY "Users can send messages in their conversations"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
  )
  AND auth.uid() = sender_id
);

-- UPDATE: Users can update messages they sent (for read receipts)
CREATE POLICY "Users can update their own messages"
ON messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
  )
);
