-- Add games.is_spotlight for the mobile hamburger "Spotlight" grid.
--
-- Boolean flag the admin can flip from /admin/games to feature the game
-- in the New / Spotlight games card grid at the top of the mobile
-- marketplace menu (Services sheet). Independent of is_popular so the
-- homepage shelf and the menu spotlight can be curated separately.
-- Defaults to false; the grid stays hidden until at least one game is
-- spotlit (no sort_order fallback — this is an intentional curation).

BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_spotlight boolean NOT NULL DEFAULT false;

-- Partial index over sort_order: the menu query filters on
-- is_spotlight = true and orders by sort_order, so this covers the hot
-- path cheaply (mirrors idx_games_is_popular).
CREATE INDEX IF NOT EXISTS idx_games_is_spotlight
  ON public.games (sort_order)
  WHERE is_spotlight = true;

COMMENT ON COLUMN public.games.is_spotlight IS
  'When true, the game is featured in the mobile hamburger Spotlight games grid. Set via /admin/games spotlight toggle.';

COMMIT;
