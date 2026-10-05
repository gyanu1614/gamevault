-- Per-game hero background (2026-10-05, owner request).
--
-- ONE hero background image per game, shared by every page of that game:
-- the marketplace category pages (items, currency, accounts, boosting), the
-- game landing page, and the values / calculator / blog / sell hub pages.
-- Rendered by `GameHeroBackdrop` (src/components/marketplace/) with the
-- homepage hero's veil / light / fade recipe.
--
--   1. Five columns on public.games:
--        hero_bg_url         the default (1600 w) WebP, our bucket only
--        hero_bg_srcset      {"960": url, "1600": url, "2400": url} — content-
--                            hashed WebP files, served straight from storage
--                            (no image optimizer)
--        hero_bg_blur        a ~24 px wide WebP as a data: URL (LQIP), painted
--                            under the image so the hero is never empty
--        hero_bg_focal_y     vertical focal point 0–100 (object-position y)
--        hero_bg_updated_at  when the admin last uploaded / moved it
--      Anon reads them like every other games column: the baseline grants
--      SELECT on public.games to anon/authenticated and RLS shows active
--      games only (`is_active = true OR service_role`). No new grant needed;
--      writes stay admin/service-role only (existing RLS).
--   2. The PUBLIC bucket `game-heroes`: 6 MB, JPG/PNG/WebP/AVIF. Public read
--      policy only — NO insert/update/delete policy for anon/authenticated.
--      The admin upload goes browser → a signed upload URL minted by the
--      service role inside `requireAdmin()` (the source is too large for a
--      server-action body), then the server action re-encodes it with sharp
--      and writes the variants with the service role. Objects:
--        {gameId}/{hash}-{width}.webp   (immutable, content-hashed)
--        {gameId}/_source/{uuid}.{ext}  (deleted right after processing)
--
-- Additive and idempotent. No data is deleted or rewritten.
--
-- ⚠️ PUSH BEFORE THE APP DEPLOY is the clean order, but either order is safe:
-- the public read (src/lib/games/hero.server.ts) falls back to the static art
-- when the columns are missing, and the admin upload fails with a plain
-- message until the bucket exists.
--
-- Rollback:
--   ALTER TABLE public.games
--     DROP COLUMN hero_bg_url, DROP COLUMN hero_bg_srcset, DROP COLUMN hero_bg_blur,
--     DROP COLUMN hero_bg_focal_y, DROP COLUMN hero_bg_updated_at;
--   DROP POLICY game_heroes_public_read ON storage.objects;
--   (empty the bucket in the dashboard, then) DELETE FROM storage.buckets WHERE id = 'game-heroes';

-- ── 1. Columns ─────────────────────────────────────────────────────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS hero_bg_url text,
  ADD COLUMN IF NOT EXISTS hero_bg_srcset jsonb,
  ADD COLUMN IF NOT EXISTS hero_bg_blur text,
  ADD COLUMN IF NOT EXISTS hero_bg_focal_y smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS hero_bg_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.games'::regclass AND conname = 'games_hero_bg_focal_y_range'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_hero_bg_focal_y_range CHECK (hero_bg_focal_y BETWEEN 0 AND 100);
  END IF;

  -- The LQIP is inlined into every page of the game: keep it tiny and an image.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.games'::regclass AND conname = 'games_hero_bg_blur_shape'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_hero_bg_blur_shape CHECK (
        hero_bg_blur IS NULL
        OR (hero_bg_blur LIKE 'data:image/%' AND length(hero_bg_blur) <= 1600)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.games'::regclass AND conname = 'games_hero_bg_srcset_object'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_hero_bg_srcset_object CHECK (
        hero_bg_srcset IS NULL OR jsonb_typeof(hero_bg_srcset) = 'object'
      );
  END IF;
END $$;

COMMENT ON COLUMN public.games.hero_bg_url IS
  'Hero background, default 1600 w WebP in the game-heroes bucket. Written only by the admin hero upload (src/lib/actions/game-hero.ts).';
COMMENT ON COLUMN public.games.hero_bg_srcset IS
  'Hero background widths → public URLs, e.g. {"960": "...", "1600": "...", "2400": "..."}.';
COMMENT ON COLUMN public.games.hero_bg_blur IS
  'Hero background LQIP: a ~24 px wide WebP data: URL painted under the image.';
COMMENT ON COLUMN public.games.hero_bg_focal_y IS
  'Hero background vertical focal point, 0 (top) – 100 (bottom); 50 = centred.';

-- ── 2. Bucket + policy ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('game-heroes', 'game-heroes', true, 6291456,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (every game page renders the hero). Writes: none for
-- anon/authenticated — the service role bypasses RLS, and the browser upload
-- uses a signed upload URL the service role mints after requireAdmin().
DROP POLICY IF EXISTS game_heroes_public_read ON storage.objects;
CREATE POLICY game_heroes_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'game-heroes');

-- ── 3. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'game-heroes' AND public) THEN
    RAISE EXCEPTION 'game_hero_backgrounds: bucket game-heroes missing or not public';
  END IF;

  -- No write policy may name the bucket: writes are service-role only.
  SELECT string_agg(p.polname, ', ') INTO v_bad
    FROM pg_policy p
   WHERE p.polrelid = 'storage.objects'::regclass
     AND p.polcmd <> 'r'
     AND pg_get_expr(COALESCE(p.polqual, p.polwithcheck), p.polrelid) LIKE '%game-heroes%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'game_hero_backgrounds: unexpected write policy on game-heroes: %', v_bad;
  END IF;

  -- The public read path: anon must be able to SELECT the new columns.
  IF NOT has_column_privilege('anon', 'public.games', 'hero_bg_srcset', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.games', 'hero_bg_focal_y', 'SELECT') THEN
    RAISE EXCEPTION 'game_hero_backgrounds: anon cannot read the hero columns';
  END IF;
END $$;
