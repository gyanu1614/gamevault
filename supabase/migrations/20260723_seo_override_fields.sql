-- Auto-SEO engine — admin override fields for games + categories.
--
-- The template layer (lib/seo/templates.ts) auto-generates title / meta /
-- H1 / intro / FAQ for EVERY game and category from smart fallbacks, so a
-- newly-added game is instantly crawlable with no manual work. These
-- nullable columns let an admin OVERRIDE any generated field per page when
-- they want bespoke copy — blank = use the template. Purely additive; does
-- not touch marketplace logic.

BEGIN;

-- ─── games ────────────────────────────────────────────────────────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS seo_title       text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_h1          text,
  ADD COLUMN IF NOT EXISTS seo_intro       text,
  -- Ecosystem drives copy nuance (roblox experience vs pc/mmo/console).
  ADD COLUMN IF NOT EXISTS ecosystem       text
    CHECK (ecosystem IS NULL OR ecosystem IN ('roblox','pc','console','mobile','mmo','sports','other')),
  -- Manual index control. NULL = let the page decide by content/listings
  -- (current behaviour). TRUE/FALSE = admin force. seo_noindex_reason is
  -- for the admin badge tooltip.
  ADD COLUMN IF NOT EXISTS seo_indexable   boolean,
  ADD COLUMN IF NOT EXISTS seo_noindex_reason text;

COMMENT ON COLUMN public.games.seo_title IS 'Admin override for the <title>. Blank = generated from template.';
COMMENT ON COLUMN public.games.seo_description IS 'Admin override for the meta description. Blank = generated.';
COMMENT ON COLUMN public.games.seo_h1 IS 'Admin override for the page H1. Blank = generated.';
COMMENT ON COLUMN public.games.seo_intro IS 'Admin override for the visible intro paragraph. Blank = generated.';
COMMENT ON COLUMN public.games.ecosystem IS 'Game ecosystem — tunes SEO copy (roblox/pc/console/mobile/mmo/sports/other).';
COMMENT ON COLUMN public.games.seo_indexable IS 'Force index (true) / noindex (false). NULL = auto by content + listings.';

-- ─── categories ─────────────────────────────────────────────────────────────
-- Categories already carry type/label in `metadata` (jsonb). Add the same
-- override fields so a specific game+category page can have bespoke copy.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS seo_title       text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_h1          text,
  ADD COLUMN IF NOT EXISTS seo_intro       text;

COMMENT ON COLUMN public.categories.seo_title IS 'Admin override for the category <title>. Blank = generated.';
COMMENT ON COLUMN public.categories.seo_intro IS 'Admin override for the visible category intro. Blank = generated.';

COMMIT;
