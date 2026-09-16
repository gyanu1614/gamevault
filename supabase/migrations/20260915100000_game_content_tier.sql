-- Phase 1 · Step 1 — two-tier catalogue.
--
-- `content_tier` separates the two kinds of game the platform carries:
--   listed — marketplace only. Categories enabled, sellers can list, no
--            price data, no values hub. The bulk of the catalogue.
--   data   — carries a values/content hub (crawlers, price pages,
--            calculators). Today: steal-a-brainrot, adopt-me.
--
-- `source` records where a row came from so a bulk seed can be audited or
-- rolled back without guessing (seed-2026-09, trend-radar, seller-request,
-- admin).
--
-- Platform/ecosystem is NOT added here: public.games.ecosystem already
-- exists with a CHECK constraint (roblox|pc|console|mobile|mmo|sports|
-- other) and is read by resolveGameSeo(). The step-1 spec's `cross` value
-- maps to `other` in the seed rather than widening the constraint.
--
-- No new functions or views, so the default-EXECUTE revoke posture from
-- 20260913100000 is untouched.

ALTER TABLE "public"."games"
  ADD COLUMN IF NOT EXISTS "content_tier" "text" NOT NULL DEFAULT 'listed',
  ADD COLUMN IF NOT EXISTS "source" "text";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_content_tier_check'
  ) THEN
    ALTER TABLE "public"."games"
      ADD CONSTRAINT "games_content_tier_check"
      CHECK ("content_tier" = ANY (ARRAY['listed'::"text", 'data'::"text"]));
  END IF;
END $$;

COMMENT ON COLUMN "public"."games"."content_tier" IS
  'listed = marketplace-only game; data = game with a values/content hub (crawlers, price pages, calculators).';
COMMENT ON COLUMN "public"."games"."source" IS
  'Provenance of the row: seed-2026-09, trend-radar, seller-request, admin.';

-- The two existing content hubs. Slug-matched so re-running is a no-op on a
-- database where they are absent (e.g. a fresh local stack).
UPDATE "public"."games"
   SET "content_tier" = 'data'
 WHERE "slug" IN ('steal-a-brainrot', 'adopt-me')
   AND "content_tier" IS DISTINCT FROM 'data';

-- Hub indexability and the sitemap both filter on content_tier alongside
-- is_active; keep that lookup cheap as the catalogue grows past 200 rows.
CREATE INDEX IF NOT EXISTS "idx_games_content_tier"
  ON "public"."games" ("content_tier")
  WHERE "is_active" = true;

-- `updated_at` so the sitemap can emit a truthful <lastmod> for game hubs
-- and /[game]/sell (Step 1 deliverable 6). The baseline games table only
-- carried created_at, so a sitemap select of updated_at errored and silently
-- emptied the games section entirely.
--
-- Backfilled from created_at rather than now(): a row nobody has touched has
-- not changed, and stamping every game with the migration time would tell
-- Google 233 pages changed on the same day.
ALTER TABLE "public"."games"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;

UPDATE "public"."games" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

ALTER TABLE "public"."games"
  ALTER COLUMN "updated_at" SET DEFAULT "now"();

-- Reuses the baseline's shared trigger function (SECURITY DEFINER with a
-- pinned search_path there), so no new function is introduced.
DROP TRIGGER IF EXISTS "set_games_updated_at" ON "public"."games";
CREATE TRIGGER "set_games_updated_at"
  BEFORE UPDATE ON "public"."games"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
