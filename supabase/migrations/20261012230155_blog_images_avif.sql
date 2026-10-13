-- Blog image pipeline (2026-10-12 blog revamp): every uploaded blog image is
-- stored ONCE as AVIF + WebP at fixed widths (src/lib/blog/images.ts). AVIF
-- is ~25% smaller than WebP at the same quality; the bucket's type list only
-- allowed JPEG / PNG / WebP / GIF, so AVIF uploads were refused.
-- Size cap unchanged (5 MB per file); still images only.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
 WHERE id = 'blog-images';
