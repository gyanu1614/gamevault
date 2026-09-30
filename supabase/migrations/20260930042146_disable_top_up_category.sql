-- Top Up is not a DropMarket category (owner, 2026-09-30). Games sell
-- currency (Fortnite's is V-Bucks, already its own Currency row), items and
-- accounts.
--
-- Data only, no schema change. Both switches are the ones the app already
-- honours:
--   * global_categories.is_active = false: the sell wizard, template
--     builder and admin pickers list active primaries only, and
--     findEnabledGameCategory refuses an inactive primary (no new Top Up
--     listings).
--   * game_categories.is_enabled = false: /{game}/top-up 404s through the
--     route gate, and the sitemap, game sub-nav, navbar menus and search stop
--     listing it.
-- Rows are kept (one paused genshin-impact listing still points at its
-- row). Undo is the reverse UPDATE.

UPDATE public.global_categories
   SET is_active = false,
       updated_at = now()
 WHERE slug = 'top-up'
   AND parent_id IS NULL;

UPDATE public.game_categories
   SET is_enabled = false,
       updated_at = now()
 WHERE type = 'top_up'
   AND is_enabled;
