-- LOCAL STACK ONLY (applied by `pnpm test:reset`, never pushed).
--
-- Production creates a `profiles` row for every new auth user through the
-- trigger `on_auth_user_created` on auth.users → public.handle_new_user().
-- That trigger lives in the auth schema and was created on the dashboard, so
-- the baseline dump (public schema only) carries the FUNCTION but not the
-- TRIGGER. A fresh local stack therefore signs users up with no profile row,
-- and anything keyed on profiles(id) (seller_onboarding, listings…) fails
-- with a foreign-key error. Found 2026-10-08 on the open seller signup flow.
--
-- Test fixtures never noticed: makeFixture() inserts profiles explicitly.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Same story for the `avatars` bucket: created on the dashboard in prod
-- (20260928174233 only UPDATEs its caps). The store logo on /founding and the
-- profile avatar both upload here through the session client, so the local
-- stack needs the bucket and the owner-folder write policies prod has.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS avatars_owner_insert ON storage.objects;
CREATE POLICY avatars_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
