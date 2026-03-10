-- =====================================================
-- GAME EXPANSION + TOP UP CATEGORY
-- Adds 12 new games and Top Up category type
-- Date: 2026-02-17
-- =====================================================

-- Helper function (will be dropped at end of migration)
CREATE OR REPLACE FUNCTION get_game_id(game_slug text)
RETURNS uuid AS $$
  SELECT id FROM public.games WHERE slug = game_slug LIMIT 1;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- 1. ADD 12 NEW GAMES
-- =====================================================

INSERT INTO public.games (name, slug, emoji, image_url, is_active) VALUES
  ('CS2',                'cs2',               '🔫', null, true),
  ('Genshin Impact',     'genshin-impact',    '⚔️', null, true),
  ('PUBG Mobile',        'pubg-mobile',       '🪖', null, true),
  ('Free Fire',          'free-fire',         '🔥', null, true),
  ('Mobile Legends',     'mobile-legends',    '⚡', null, true),
  ('Apex Legends',       'apex-legends',      '🎯', null, true),
  ('Call of Duty',       'call-of-duty',      '🪖', null, true),
  ('EA FC25',            'fc25',              '⚽', null, true),
  ('Escape from Tarkov', 'escape-from-tarkov','🏭', null, true),
  ('Rainbow Six Siege',  'r6-siege',          '🛡️', null, true),
  ('Grow a Garden',      'grow-a-garden',     '🌱', null, true),
  ('Steal a Brainrot',   'steal-a-brainrot',  '🧠', null, true)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. ADD CATEGORIES FOR CS2
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('cs2'),
    'Accounts',
    'accounts',
    '👤',
    'CS2 accounts with skins and rank',
    1,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('cs2'),
    'Skins & Items',
    'items',
    '🔫',
    'CS2 weapon skins, knives, gloves and cases',
    2,
    '{"type": "items", "sub_types": ["Skins", "Knives", "Gloves", "Cases", "Keys", "Stickers"]}'::jsonb
  ),
  (
    get_game_id('cs2'),
    'Boosting',
    'boosting',
    '🚀',
    'CS2 rank boosting and premier rating services',
    3,
    '{"type": "service"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 3. ADD CATEGORIES FOR GENSHIN IMPACT
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('genshin-impact'),
    'Top Up',
    'top-up',
    '⚡',
    'Genesis Crystals and Welkin Moon top-up',
    1,
    '{
      "type": "top_up",
      "sub_types": ["Genesis Crystals", "Welkin Moon", "Blessing"],
      "requires_region": true,
      "available_regions": [
        {"code": "GLOBAL", "name": "Global"},
        {"code": "CN", "name": "China"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('genshin-impact'),
    'Accounts',
    'accounts',
    '👤',
    'Genshin Impact accounts with characters and primos',
    2,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('genshin-impact'),
    'Items',
    'items',
    '🎒',
    'In-game items and resources',
    3,
    '{"type": "items"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 4. ADD CATEGORIES FOR PUBG MOBILE
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('pubg-mobile'),
    'Top Up',
    'top-up',
    '⚡',
    'UC (Unknown Cash) top-up',
    1,
    '{
      "type": "top_up",
      "sub_types": ["UC", "Royal Pass"],
      "unit_label": "UC"
    }'::jsonb
  ),
  (
    get_game_id('pubg-mobile'),
    'Accounts',
    'accounts',
    '👤',
    'PUBG Mobile accounts with skins and rank',
    2,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('pubg-mobile'),
    'Items',
    'items',
    '🎒',
    'Outfits, gun skins and crates',
    3,
    '{"type": "items"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 5. ADD CATEGORIES FOR FREE FIRE
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('free-fire'),
    'Top Up',
    'top-up',
    '⚡',
    'Diamonds top-up',
    1,
    '{
      "type": "top_up",
      "sub_types": ["Diamonds", "Membership"],
      "unit_label": "Diamonds"
    }'::jsonb
  ),
  (
    get_game_id('free-fire'),
    'Accounts',
    'accounts',
    '👤',
    'Free Fire accounts with skins',
    2,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('free-fire'),
    'Items',
    'items',
    '🎒',
    'Outfits, gun skins and bundles',
    3,
    '{"type": "items"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 6. ADD CATEGORIES FOR MOBILE LEGENDS
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('mobile-legends'),
    'Top Up',
    'top-up',
    '⚡',
    'Diamonds top-up for Mobile Legends',
    1,
    '{
      "type": "top_up",
      "sub_types": ["Diamonds", "Twilight Pass", "Weekly Diamond Pass"],
      "unit_label": "Diamonds"
    }'::jsonb
  ),
  (
    get_game_id('mobile-legends'),
    'Accounts',
    'accounts',
    '👤',
    'MLBB accounts with skins and heroes',
    2,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('mobile-legends'),
    'Boosting',
    'boosting',
    '🚀',
    'Rank boosting services',
    3,
    '{"type": "service"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 7. ADD CATEGORIES FOR APEX LEGENDS
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('apex-legends'),
    'Accounts',
    'accounts',
    '👤',
    'Apex Legends accounts with heirlooms and skins',
    1,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('apex-legends'),
    'Items',
    'items',
    '🎒',
    'Coins, crafting metals and bundles',
    2,
    '{"type": "items"}'::jsonb
  ),
  (
    get_game_id('apex-legends'),
    'Boosting',
    'boosting',
    '🚀',
    'Ranked boosting services',
    3,
    '{"type": "service"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 8. ADD CATEGORIES FOR CALL OF DUTY
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('call-of-duty'),
    'Accounts',
    'accounts',
    '👤',
    'COD accounts with camos and operators',
    1,
    '{
      "type": "account",
      "requires_platform": true,
      "available_platforms": ["PC (Battle.net)", "PC (Steam)", "PlayStation", "Xbox"]
    }'::jsonb
  ),
  (
    get_game_id('call-of-duty'),
    'Items',
    'items',
    '🎒',
    'COD Points, weapon blueprints and operator bundles',
    2,
    '{"type": "items", "sub_types": ["COD Points", "Blueprints", "Operator Bundles", "Camos"]}'::jsonb
  ),
  (
    get_game_id('call-of-duty'),
    'Boosting',
    'boosting',
    '🚀',
    'Ranked and prestige boosting',
    3,
    '{"type": "service"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 9. ADD CATEGORIES FOR EA FC25
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('fc25'),
    'Coins',
    'coins',
    '💰',
    'FC25 Ultimate Team coins',
    1,
    '{
      "type": "currency",
      "unit_label": "Coins",
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation", "Xbox"]
    }'::jsonb
  ),
  (
    get_game_id('fc25'),
    'Accounts',
    'accounts',
    '👤',
    'FC25 accounts with rating and coins',
    2,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('fc25'),
    'Items',
    'items',
    '🎒',
    'Player cards and packs',
    3,
    '{"type": "items"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 10. ADD CATEGORIES FOR ESCAPE FROM TARKOV
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('escape-from-tarkov'),
    'Currency',
    'currency',
    '💰',
    'Roubles, Dollars, Euros',
    1,
    '{"type": "currency", "sub_types": ["Roubles", "Dollars", "Euros", "Bitcoin"]}'::jsonb
  ),
  (
    get_game_id('escape-from-tarkov'),
    'Items',
    'items',
    '🎒',
    'Weapons, ammo, gear and quest items',
    2,
    '{"type": "items", "sub_types": ["Weapons", "Ammo", "Armor", "Quest Items", "Keys", "Barter Items"]}'::jsonb
  ),
  (
    get_game_id('escape-from-tarkov'),
    'Accounts',
    'accounts',
    '👤',
    'EFT accounts with stash and profile',
    3,
    '{"type": "account"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 11. ADD CATEGORIES FOR RAINBOW SIX SIEGE
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('r6-siege'),
    'Accounts',
    'accounts',
    '👤',
    'R6 accounts with operators and rank',
    1,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('r6-siege'),
    'R6 Credits',
    'currency',
    '💰',
    'Rainbow Six Credits and Renown',
    2,
    '{"type": "currency", "unit_label": "R6 Credits"}'::jsonb
  ),
  (
    get_game_id('r6-siege'),
    'Boosting',
    'boosting',
    '🚀',
    'Rank boosting services',
    3,
    '{"type": "service"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 12. ADD CATEGORIES FOR GROW A GARDEN
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('grow-a-garden'),
    'Seeds & Items',
    'items',
    '🌱',
    'Rare seeds, pets and garden items',
    1,
    '{"type": "items", "sub_types": ["Seeds", "Pets", "Tools", "Eggs", "Gear"]}'::jsonb
  ),
  (
    get_game_id('grow-a-garden'),
    'Currency',
    'currency',
    '💰',
    'In-game Sheckles and resources',
    2,
    '{"type": "currency", "unit_label": "Sheckles"}'::jsonb
  ),
  (
    get_game_id('grow-a-garden'),
    'Accounts',
    'accounts',
    '👤',
    'Game accounts with progress and items',
    3,
    '{"type": "account"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 13. ADD CATEGORIES FOR STEAL A BRAINROT
-- =====================================================

INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('steal-a-brainrot'),
    'Items',
    'items',
    '🧠',
    'Rare brainrots and in-game items',
    1,
    '{"type": "items", "sub_types": ["Brainrots", "Eggs", "Crates", "Accessories"]}'::jsonb
  ),
  (
    get_game_id('steal-a-brainrot'),
    'Currency',
    'currency',
    '💰',
    'In-game currency',
    2,
    '{"type": "currency"}'::jsonb
  )
ON CONFLICT ON CONSTRAINT categories_game_slug_unique DO NOTHING;

-- =====================================================
-- 14. ADD DISPLAY_NAME COLUMN TO GAMES (for SEO/navbar)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.games ADD COLUMN display_name text;
    COMMENT ON COLUMN public.games.display_name IS 'Short display name for navbar/pills (defaults to name if null)';
  END IF;
END $$;

-- Update display names for games with long names
UPDATE public.games SET display_name = 'LoL' WHERE slug = 'lol';
UPDATE public.games SET display_name = 'LoL' WHERE slug = 'league-of-legends';
UPDATE public.games SET display_name = 'MLBB' WHERE slug = 'mobile-legends';
UPDATE public.games SET display_name = 'EFT' WHERE slug = 'escape-from-tarkov';
UPDATE public.games SET display_name = 'PUBG' WHERE slug = 'pubg-mobile';
UPDATE public.games SET display_name = 'COD' WHERE slug = 'call-of-duty';
UPDATE public.games SET display_name = 'FC25' WHERE slug = 'fc25';

-- =====================================================
-- 15. ADD SORT_ORDER COLUMN TO GAMES (for navbar ordering)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.games ADD COLUMN sort_order integer DEFAULT 99;
    COMMENT ON COLUMN public.games.sort_order IS 'Display order in navbar dropdowns (lower = first)';
  END IF;
END $$;

-- Set sort order for high-traffic games (lower = appears first in dropdowns)
UPDATE public.games SET sort_order = 1  WHERE slug = 'roblox';
UPDATE public.games SET sort_order = 2  WHERE slug = 'fortnite';
UPDATE public.games SET sort_order = 3  WHERE slug = 'valorant';
UPDATE public.games SET sort_order = 4  WHERE slug = 'cs2';
UPDATE public.games SET sort_order = 5  WHERE slug = 'lol';
UPDATE public.games SET sort_order = 5  WHERE slug = 'league-of-legends';
UPDATE public.games SET sort_order = 6  WHERE slug = 'gta-v';
UPDATE public.games SET sort_order = 7  WHERE slug = 'genshin-impact';
UPDATE public.games SET sort_order = 8  WHERE slug = 'pubg-mobile';
UPDATE public.games SET sort_order = 9  WHERE slug = 'free-fire';
UPDATE public.games SET sort_order = 10 WHERE slug = 'mobile-legends';
UPDATE public.games SET sort_order = 11 WHERE slug = 'apex-legends';
UPDATE public.games SET sort_order = 12 WHERE slug = 'minecraft';
UPDATE public.games SET sort_order = 13 WHERE slug = 'call-of-duty';
UPDATE public.games SET sort_order = 14 WHERE slug = 'fc25';
UPDATE public.games SET sort_order = 15 WHERE slug = 'escape-from-tarkov';
UPDATE public.games SET sort_order = 16 WHERE slug = 'r6-siege';
UPDATE public.games SET sort_order = 17 WHERE slug = 'grow-a-garden';
UPDATE public.games SET sort_order = 18 WHERE slug = 'steal-a-brainrot';

-- =====================================================
-- 16. CREATE INDEX FOR SORT ORDER
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_games_sort_order ON public.games(sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories((metadata->>'type')) WHERE is_active = true;

-- =====================================================
-- CLEANUP
-- =====================================================

DROP FUNCTION IF EXISTS get_game_id(text);

DO $$
BEGIN
  RAISE NOTICE 'Game expansion migration completed:';
  RAISE NOTICE '- 12 new games added (CS2, Genshin Impact, PUBG Mobile, Free Fire, Mobile Legends,';
  RAISE NOTICE '  Apex Legends, Call of Duty, FC25, EFT, R6 Siege, Grow a Garden, Steal a Brainrot)';
  RAISE NOTICE '- Top Up category type added for mobile games';
  RAISE NOTICE '- display_name and sort_order columns added to games table';
  RAISE NOTICE '- All games now have appropriate categories with sub_types in metadata';
END $$;
