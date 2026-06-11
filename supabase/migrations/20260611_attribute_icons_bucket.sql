-- =====================================================
-- ATTRIBUTE ICONS BUCKET (Phase B polish)
-- Date: 2026-06-11
--
-- Purpose: storage bucket for attribute_options.icon_url.
-- Used by the image_select attribute type (brainrot art, rank badges,
-- knife thumbnails, etc.). Public read; writes via service-role only.
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attribute-icons',
  'attribute-icons',
  true,
  1048576, -- 1 MB cap per file
  ARRAY['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp'];

-- Public read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'attribute_icons_public_read'
  ) THEN
    CREATE POLICY "attribute_icons_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'attribute-icons');
  END IF;
END $$;

-- NOTE: writes are intentionally not granted via RLS — we always upload
-- via the service-role client from src/lib/actions/admin-template-builder.ts
-- so we don't depend on profiles.role vs admin_roles inconsistency.
