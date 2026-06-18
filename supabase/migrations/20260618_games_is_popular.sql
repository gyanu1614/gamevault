-- V17s — Add games.is_popular for homepage curation.
--
-- Boolean flag the admin can flip from /admin/games to surface the
-- game on the homepage "Popular Games" shelf. Defaults to false; the
-- shelf falls back to sort_order top-N when nothing is starred.

BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false;

-- Helpful index: most queries filter on is_popular = true and order by
-- sort_order, so a partial index covers the hot path cheaply.
CREATE INDEX IF NOT EXISTS idx_games_is_popular
  ON public.games (sort_order)
  WHERE is_popular = true;

COMMENT ON COLUMN public.games.is_popular IS
  'When true, the game is surfaced on the homepage Popular Games shelf. Set via /admin/games star toggle.';

COMMIT;
