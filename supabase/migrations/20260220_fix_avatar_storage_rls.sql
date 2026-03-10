-- ============================================================
-- Fix Avatar Storage RLS Policies
-- Allow authenticated users to manage their own avatars
-- ============================================================

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all avatars" ON storage.objects;

-- 1. Allow PUBLIC read access to all avatars (for profile viewing)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. Allow authenticated users to upload avatars to their own folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow service_role to upload any avatar (for admin operations)
CREATE POLICY "Service role can manage all avatars"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

COMMENT ON POLICY "Public can view avatars" ON storage.objects IS 'Allow anyone to view avatar images';
COMMENT ON POLICY "Users can upload own avatar" ON storage.objects IS 'Users can only upload to their own user ID folder: {user_id}/avatar.png';
COMMENT ON POLICY "Users can update own avatar" ON storage.objects IS 'Users can update their own avatar';
COMMENT ON POLICY "Users can delete own avatar" ON storage.objects IS 'Users can delete their own avatar';
COMMENT ON POLICY "Service role can manage all avatars" ON storage.objects IS 'Service role has full access for admin operations';
