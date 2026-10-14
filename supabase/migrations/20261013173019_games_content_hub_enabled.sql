-- Blog v2 (2026-10-13): a per-game switch for the content hub — the blog home,
-- its guides, and the hub nav's game picker. Off by default: the catalogue
-- carries ~235 games and most have no guides, so the picker listed games that
-- led nowhere. Admins switch a game on (Admin → Games → "Guides & content").
--
-- Separate from content_tier ('data' = has value pages): a game can have
-- guides without a values hub (Murder Mystery 2's started that way).
--
-- Starts ON for the games that have content today, and for any game a live
-- post is filed under, so no published article loses its home.
-- No new functions or views; games keeps its existing table grants.

ALTER TABLE "public"."games"
  ADD COLUMN IF NOT EXISTS "content_hub_enabled" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."games"."content_hub_enabled" IS
  'true = the game has a content hub (blog home + guides) and appears in the hub nav game picker. Admin switch.';

UPDATE "public"."games"
   SET "content_hub_enabled" = true
 WHERE "slug" IN ('murder-mystery-2', 'steal-a-brainrot', 'adopt-me', 'steal-an-egg')
    OR "slug" IN (
         SELECT DISTINCT "primary_game_slug"
           FROM "public"."blog_posts"
          WHERE "status" = 'published' AND "primary_game_slug" IS NOT NULL
       );
