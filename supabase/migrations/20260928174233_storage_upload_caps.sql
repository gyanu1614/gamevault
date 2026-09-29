-- Storage upload caps (2026-09-28).
--
-- Images are served unoptimized now (next.config images.unoptimized: the
-- Vercel optimizer quota ran out), so a stored file is exactly what visitors
-- download. Uploads are shrunk before storing (server: sharp for listing
-- images; browser: chat photos, delivery proof, avatars); the buckets enforce
-- the hard limits so no client can bypass them.
--
--  · avatars: had NO size or type limit. The client uploads a ~30-80 KB WebP
--    and the server refuses > 2 MB; the bucket now enforces the same, images
--    only. (It was created on the dashboard, with dashboard policies, and is
--    not in the storage guard: UPDATE only, never create it here, so no
--    policy is invented. A no-op on a local stack without the bucket.)
--  · blog-images (admin): no limit. The upload action allows 4 MB of PNG /
--    JPEG / WebP / GIF; the bucket now caps at 5 MB, images only.
--  · delivery-evidence (order chat files + delivery proof): the chat sends
--    PDFs and GIFs (validateChatAttachment) but the bucket's type list refused
--    them, so those sends failed; add both. Also 'image/mp4' was a typo for
--    'video/mp4'. Size stays 50 MB (proof videos).
--
-- Storage config only: no table, function or policy changes. Safe to push
-- before or after the app deploy.

UPDATE storage.buckets
   SET file_size_limit = 2097152,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'avatars';

UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 WHERE id = 'blog-images';

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
         'video/mp4', 'video/quicktime', 'video/webm'
       ]
 WHERE id = 'delivery-evidence';
