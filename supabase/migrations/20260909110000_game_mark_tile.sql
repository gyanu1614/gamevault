-- GameMark tile styling: per-game tile background, plus an optional fill override.
--
-- `mark_bg` is the tile's background colour, one hex per game.
-- `mark_fill` is normally NULL: the component derives the silhouette fill from
-- `mark_bg` by WCAG relative luminance, picking whichever of white-92% /
-- near-black wins on contrast ratio. Set it only to override that pick on a
-- colour where the maths gives the wrong-feeling answer; when set, it wins
-- outright.

ALTER TABLE "public"."games"
  ADD COLUMN IF NOT EXISTS "mark_bg" "text",
  ADD COLUMN IF NOT EXISTS "mark_fill" "text";

ALTER TABLE "public"."games"
  DROP CONSTRAINT IF EXISTS "games_mark_bg_check";
ALTER TABLE "public"."games"
  ADD CONSTRAINT "games_mark_bg_check"
  CHECK ("mark_bg" IS NULL OR "mark_bg" ~* '^#[0-9a-f]{6}$');

ALTER TABLE "public"."games"
  DROP CONSTRAINT IF EXISTS "games_mark_fill_check";
ALTER TABLE "public"."games"
  ADD CONSTRAINT "games_mark_fill_check"
  CHECK ("mark_fill" IS NULL OR "mark_fill" = ANY (ARRAY['light'::"text", 'dark'::"text"]));

COMMENT ON COLUMN "public"."games"."mark_bg" IS
  'GameMark tile background, #rrggbb. NULL falls back to a neutral tile.';
COMMENT ON COLUMN "public"."games"."mark_fill" IS
  'GameMark silhouette fill override: light | dark. NULL = derive from mark_bg by WCAG contrast.';
