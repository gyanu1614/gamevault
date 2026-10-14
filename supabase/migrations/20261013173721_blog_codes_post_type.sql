-- Blog v2 (2026-10-13): a "Codes" post type — ONE codes page per game, served
-- at /{game}/codes and listed in the hub nav's Codes menu.
--
-- 1. post_type also allows 'codes'.
-- 2. At most one PUBLISHED codes post per game (drafts may overlap while a
--    replacement is written; publishing the second one is refused). Today no
--    codes posts exist, so the index builds on an empty set.
-- No new functions or views.

ALTER TABLE "public"."blog_posts" DROP CONSTRAINT IF EXISTS "blog_posts_post_type_check";
ALTER TABLE "public"."blog_posts"
  ADD CONSTRAINT "blog_posts_post_type_check"
  CHECK ("post_type" = ANY (ARRAY['guide'::"text", 'value'::"text", 'seller'::"text", 'codes'::"text"]));

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_one_codes_post_per_game"
  ON "public"."blog_posts" ("primary_game_slug")
  WHERE "post_type" = 'codes' AND "status" = 'published';
