-- Enable real-time updates for the notifications table.
--
-- The navbar bell subscribes to INSERT events on notifications (filtered by
-- user_id) so a new order / order-message notification flips the bell instantly
-- instead of waiting on the 60s poll fallback. Without adding the table to the
-- supabase_realtime publication those INSERT events never reach the client.
--
-- IMPORTANT: like the other fix-*.sql files, this MUST also be executed against
-- the live Supabase project (SQL editor) — committing the file alone does not
-- change the running publication.

-- REPLICA IDENTITY FULL so UPDATE/DELETE broadcasts carry the full row too
-- (INSERT works without it, but this keeps the table consistent with `orders`).
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Idempotent publication add — mirrors the guard style used elsewhere so a
-- re-run (or a project where it's already published) is a no-op instead of an
-- error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

COMMENT ON TABLE public.notifications IS 'In-app notifications. Added to supabase_realtime so the navbar bell reacts to INSERTs in realtime (per-user SELECT RLS gates delivery).';
