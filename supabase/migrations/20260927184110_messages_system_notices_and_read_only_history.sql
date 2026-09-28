-- ============================================================================
-- Chat: DropMarket system notices, and message history users cannot rewrite.
-- Idempotent: safe to re-run. No data is changed.
--
-- 1. System notices. The dispute cards (dispute opened / resolved) were
--    inserted with sender_id = '00000000-0000-0000-0000-000000000000', which is
--    not a profile: messages.sender_id is a NOT NULL FK to profiles, so every
--    one of those inserts failed (and the errors were ignored). A notice now
--    has sender_id NULL. Every INSERT policy on messages requires
--    auth.uid() = sender_id, which is never true for NULL, so only the
--    service role can write one; a CHECK keeps a NULL-sender row to the
--    notice shape (a JSON object with a "type").
--
-- 2. Read-only history. "Users can update their own messages" lets any
--    participant UPDATE any message in their conversation, every column,
--    including the OTHER party's text (chat is dispute evidence). The app
--    only ever updates is_read / read_at (marking the other side's messages
--    read), so UPDATE is narrowed to those two columns for signed-in users.
--    RLS still decides WHICH rows; the column grant decides WHAT can change.
-- ============================================================================

ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;

COMMENT ON COLUMN public.messages.sender_id IS
  'The author. NULL = a DropMarket system notice (dispute opened/resolved card), written only by the service role: every INSERT policy requires auth.uid() = sender_id.';

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_system_notice_shape;
ALTER TABLE public.messages ADD CONSTRAINT messages_system_notice_shape
  CHECK (sender_id IS NOT NULL OR content LIKE '{"type":%');

REVOKE UPDATE ON TABLE public.messages FROM anon, authenticated;
GRANT UPDATE (is_read, read_at) ON TABLE public.messages TO authenticated;
