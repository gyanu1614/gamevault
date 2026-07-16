-- Beta C — Reactive seller-application lifecycle.
--
-- The client (src/hooks/use-auth.tsx) opens a realtime channel for
-- not-yet-approved users with two postgres_changes listeners so admin
-- approval flips the navbar CTA → seller menu and swaps the identity card
-- from username → shop_name WITHOUT a page refresh:
--   (a) seller_applications UPDATE → new application status
--   (b) profiles UPDATE            → role='seller' + fresh shop_name/shop_slug
--
-- For UPDATE payloads to carry the changed columns, both tables need
-- REPLICA IDENTITY FULL, and both must be in the supabase_realtime
-- publication. RLS already lets a user SELECT their own profiles row and
-- their own seller_applications rows, so the filtered subscription only ever
-- delivers the subscriber's own row.
--
-- IMPORTANT: without this migration the subscription silently receives
-- nothing; the client ships a visibilitychange + 60s poll fallback so the
-- stale-CTA bug still resolves, but realtime is the intended path.

ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE seller_applications REPLICA IDENTITY FULL;

-- Add to the realtime publication (idempotent guard — ADD TABLE errors if the
-- table is already a member, so skip those that are).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'seller_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_applications;
  END IF;
END $$;

COMMENT ON TABLE seller_applications IS 'Seller applications with REPLICA IDENTITY FULL for realtime UPDATE broadcasts — drives the reactive Become-a-Seller CTA in use-auth.tsx.';
