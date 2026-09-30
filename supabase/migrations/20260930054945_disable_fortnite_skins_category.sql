-- Fortnite "Skins" is the same thing as Fortnite "Items" (owner, 2026-09-30:
-- "items and skins, it's the same thing, so just items"). Fortnite is the only
-- game with a Skins category (global sub-category `skins`, parent Items).
--
-- Data only, same switches as 20260930042146_disable_top_up_category:
--   * game_categories.is_enabled = false for Fortnite's Skins row:
--     /fortnite/buy-skins 404s through the route gate and drops out of the
--     sitemap, sub-nav, navbar menus, search and the game hub.
--   * global_categories.is_active = false for `skins`, so no picker offers it
--     and findEnabledGameCategory refuses it (no new Skins listings anywhere).
-- Its two listings (1 sold, 1 archived, none active) keep their row; order
-- pages read categories by id and game_categories stays publicly readable.
-- Undo is the reverse UPDATE.

UPDATE public.game_categories gc
   SET is_enabled = false,
       updated_at = now()
  FROM public.games g, public.global_categories glc
 WHERE gc.game_id = g.id
   AND gc.global_category_id = glc.id
   AND g.slug = 'fortnite'
   AND glc.slug = 'skins'
   AND gc.is_enabled;

UPDATE public.global_categories
   SET is_active = false,
       updated_at = now()
 WHERE slug = 'skins'
   AND parent_id IS NOT NULL;
