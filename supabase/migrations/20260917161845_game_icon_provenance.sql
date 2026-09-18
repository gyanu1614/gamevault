-- Phase 1 · Step 1e — game icon provenance.
--
-- Icons are filled automatically from third-party identifier sources
-- (Roblox thumbnails, Apple App Store, Steam) by scripts/fill-game-icons.mjs. Two
-- columns record WHERE an icon came from and WHEN it was fetched, so the
-- filler can refresh stale automated icons without ever touching one a
-- human uploaded through the admin wizard.
--
--   image_source    roblox | appstore | steam | wikidata | manual
--   image_synced_at when the automated fetch last wrote image_url
--
-- `manual` is the protected value: --refresh re-fetches rows whose
-- image_source is an automated source AND whose image_synced_at is older
-- than the cutoff. A manual icon has image_synced_at NULL and is skipped
-- by every code path.
--
-- NOTE: the column filled is public.games.image_url — the game logo column
-- that the admin wizard (uploadGameLogoV2) already writes. There is no
-- games.icon_url; `icon_url` is only a header in data/games-seed.csv, which
-- the seeder maps onto image_url.
--
-- No new functions or views, so the default-EXECUTE revoke posture from
-- 20260913100000 is untouched. Storage reuses the existing category-icons
-- bucket under the wizard's games/ prefix, so no bucket is created here.

ALTER TABLE "public"."games"
  ADD COLUMN IF NOT EXISTS "image_source" "text",
  ADD COLUMN IF NOT EXISTS "image_synced_at" timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_image_source_check'
  ) THEN
    ALTER TABLE "public"."games"
      ADD CONSTRAINT "games_image_source_check"
      CHECK ("image_source" IS NULL OR "image_source" = ANY (ARRAY[
        'roblox'::"text", 'appstore'::"text", 'steam'::"text",
        'wikidata'::"text", 'manual'::"text"
      ]));
  END IF;
END $$;

COMMENT ON COLUMN "public"."games"."image_source" IS
  'Provenance of games.image_url: roblox|appstore|steam|wikidata = fetched by scripts/fill-game-icons.mjs; manual = uploaded by an admin. Never overwrite a manual icon.';
COMMENT ON COLUMN "public"."games"."image_synced_at" IS
  'When an automated fetch last wrote image_url. NULL for manual uploads. --refresh re-fetches automated icons older than the cutoff.';

-- Backfill: every icon that exists TODAY predates the filler, so it came
-- from a human (the admin wizard) or the legacy logo import. Mark it
-- manual so the filler treats it as protected and never overwrites it.
UPDATE "public"."games"
   SET "image_source" = 'manual'
 WHERE "image_url" IS NOT NULL
   AND "image_url" <> ''
   AND "image_source" IS NULL;

-- Partial index: the filler's hot query is "automated icons older than X".
CREATE INDEX IF NOT EXISTS "games_image_synced_at_idx"
  ON "public"."games" ("image_synced_at")
  WHERE "image_source" IN ('roblox', 'appstore', 'steam', 'wikidata');
