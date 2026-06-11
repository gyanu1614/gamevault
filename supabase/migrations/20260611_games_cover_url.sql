-- =====================================================
-- ADD cover_url TO GAMES + create game-covers bucket
-- Date: 2026-06-11
--
-- Purpose: store the portrait cover art (600×800) used on the
-- homepage Popular Games shelf. Separate from `games.image_url`
-- which is the navbar logo (square 256×256).
-- =====================================================

-- 1. Column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.games ADD COLUMN cover_url text;
    COMMENT ON COLUMN public.games.cover_url IS
      'Portrait cover art for the homepage Popular Games shelf (~600×800).';
  END IF;
END $$;

-- 2. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'game-covers',
  'game-covers',
  true,
  4194304, -- 4 MB
  ARRAY['image/png','image/jpeg','image/jpg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp'];

-- 3. Public read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'game_covers_public_read'
  ) THEN
    CREATE POLICY "game_covers_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'game-covers');
  END IF;
END $$;

-- writes go through the service-role client (see uploadGameCoverV2)
