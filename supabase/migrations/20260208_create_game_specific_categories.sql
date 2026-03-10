-- =====================================================
-- GAME-SPECIFIC CATEGORIES SYSTEM
-- Purpose: Allow each game to have its own unique categories
--          with optional fields (like region for gift cards)
-- Date: 2026-02-08
-- =====================================================

-- =====================================================
-- 1. UPDATE CATEGORIES TABLE
-- Add game_id to make categories game-specific
-- =====================================================

-- First, check if we need to migrate existing data
DO $$
BEGIN
  -- Add game_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'game_id'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN game_id uuid REFERENCES public.games(id) ON DELETE CASCADE;
  END IF;

  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN is_active boolean DEFAULT true NOT NULL;
  END IF;

  -- Add display_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN display_order integer DEFAULT 0;
  END IF;

  -- Add metadata column for special requirements (like region)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.categories.metadata IS 'Stores category-specific requirements like {"requires_region": true, "requires_platform": true, "available_regions": ["US", "UK", "EU"]}';
  END IF;
END $$;

-- Update the unique constraint to be game_id + slug
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_game_slug_unique UNIQUE (game_id, slug);

-- Create index for game_id lookups
CREATE INDEX IF NOT EXISTS idx_categories_game_id ON public.categories(game_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active) WHERE is_active = true;

-- =====================================================
-- 2. POPULATE GAME-SPECIFIC CATEGORIES
-- Define categories for each game
-- =====================================================

-- Clear existing categories (we'll repopulate with game-specific ones)
TRUNCATE public.categories CASCADE;

-- Helper function to get game ID by slug
CREATE OR REPLACE FUNCTION get_game_id(game_slug text)
RETURNS uuid AS $$
  SELECT id FROM public.games WHERE slug = game_slug LIMIT 1;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- ROBLOX CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('roblox'),
    'Robux',
    'robux',
    '💎',
    'Roblox in-game currency',
    1,
    '{"type": "currency", "unit_label": "Robux"}'::jsonb
  ),
  (
    get_game_id('roblox'),
    'Items',
    'items',
    '🎒',
    'In-game items and accessories',
    2,
    '{"type": "items"}'::jsonb
  ),
  (
    get_game_id('roblox'),
    'Accounts',
    'accounts',
    '👤',
    'Roblox accounts with various levels and items',
    3,
    '{"type": "account"}'::jsonb
  ),
  (
    get_game_id('roblox'),
    'Gift Cards',
    'gift-cards',
    '🎁',
    'Roblox gift card codes',
    4,
    '{
      "type": "gift_card",
      "requires_region": true,
      "available_regions": [
        {"code": "US", "name": "United States", "currency": "USD"},
        {"code": "UK", "name": "United Kingdom", "currency": "GBP"},
        {"code": "EU", "name": "Europe", "currency": "EUR"},
        {"code": "CA", "name": "Canada", "currency": "CAD"},
        {"code": "AU", "name": "Australia", "currency": "AUD"},
        {"code": "BR", "name": "Brazil", "currency": "BRL"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('roblox'),
    'Boosting',
    'boosting',
    '🚀',
    'Level boosting and achievement services',
    5,
    '{"type": "service"}'::jsonb
  ),
  (
    get_game_id('roblox'),
    'Limiteds',
    'limiteds',
    '⭐',
    'Limited edition items and collectibles',
    6,
    '{"type": "items", "is_limited": true}'::jsonb
  );

-- =====================================================
-- FORTNITE CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('fortnite'),
    'Accounts',
    'accounts',
    '👤',
    'Fortnite accounts with skins and V-Bucks',
    1,
    '{
      "type": "account",
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"]
    }'::jsonb
  ),
  (
    get_game_id('fortnite'),
    'V-Bucks',
    'vbucks',
    '💎',
    'Fortnite in-game currency',
    2,
    '{
      "type": "currency",
      "unit_label": "V-Bucks",
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"]
    }'::jsonb
  ),
  (
    get_game_id('fortnite'),
    'Skins',
    'skins',
    '🎨',
    'Exclusive and rare Fortnite skins',
    3,
    '{"type": "items"}'::jsonb
  ),
  (
    get_game_id('fortnite'),
    'Boosting',
    'boosting',
    '🚀',
    'Rank and level boosting services',
    4,
    '{"type": "service"}'::jsonb
  );

-- =====================================================
-- VALORANT CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('valorant'),
    'Accounts',
    'accounts',
    '👤',
    'Valorant accounts with ranks and skins',
    1,
    '{
      "type": "account",
      "requires_region": true,
      "available_regions": [
        {"code": "NA", "name": "North America"},
        {"code": "EU", "name": "Europe"},
        {"code": "ASIA", "name": "Asia Pacific"},
        {"code": "LATAM", "name": "Latin America"},
        {"code": "BR", "name": "Brazil"},
        {"code": "KR", "name": "Korea"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('valorant'),
    'VP (Valorant Points)',
    'vp',
    '💎',
    'Valorant Points currency',
    2,
    '{
      "type": "currency",
      "unit_label": "VP",
      "requires_region": true,
      "available_regions": [
        {"code": "NA", "name": "North America"},
        {"code": "EU", "name": "Europe"},
        {"code": "ASIA", "name": "Asia Pacific"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('valorant'),
    'Boosting',
    'boosting',
    '🚀',
    'Rank boosting services',
    3,
    '{"type": "service"}'::jsonb
  ),
  (
    get_game_id('valorant'),
    'Coaching',
    'coaching',
    '🎓',
    'Professional coaching sessions',
    4,
    '{"type": "service"}'::jsonb
  );

-- =====================================================
-- GTA V CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('gta-v'),
    'Accounts',
    'accounts',
    '👤',
    'GTA V accounts with progress and money',
    1,
    '{
      "type": "account",
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One"]
    }'::jsonb
  ),
  (
    get_game_id('gta-v'),
    'Money',
    'money',
    '💰',
    'GTA Online in-game cash',
    2,
    '{
      "type": "currency",
      "unit_label": "GTA$",
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One"]
    }'::jsonb
  ),
  (
    get_game_id('gta-v'),
    'Modded Accounts',
    'modded-accounts',
    '⚡',
    'Pre-modded GTA V accounts',
    3,
    '{
      "type": "account",
      "is_modded": true,
      "requires_platform": true,
      "available_platforms": ["PC", "PlayStation 5", "Xbox Series X/S"]
    }'::jsonb
  ),
  (
    get_game_id('gta-v'),
    'Unlocks',
    'unlocks',
    '🔓',
    'Vehicle and weapon unlock services',
    4,
    '{"type": "service"}'::jsonb
  );

-- =====================================================
-- MINECRAFT CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('minecraft'),
    'Accounts',
    'accounts',
    '👤',
    'Minecraft accounts (Java/Bedrock)',
    1,
    '{
      "type": "account",
      "requires_platform": true,
      "available_platforms": ["Java Edition", "Bedrock Edition", "Both"]
    }'::jsonb
  ),
  (
    get_game_id('minecraft'),
    'Server Items',
    'server-items',
    '🎒',
    'Items from popular Minecraft servers',
    2,
    '{"type": "items"}'::jsonb
  ),
  (
    get_game_id('minecraft'),
    'Minecoins',
    'minecoins',
    '💎',
    'Minecraft Marketplace currency',
    3,
    '{"type": "currency", "unit_label": "Minecoins"}'::jsonb
  ),
  (
    get_game_id('minecraft'),
    'Servers',
    'servers',
    '🖥️',
    'Minecraft server hosting and setups',
    4,
    '{"type": "service"}'::jsonb
  );

-- =====================================================
-- LEAGUE OF LEGENDS CATEGORIES
-- =====================================================
INSERT INTO public.categories (game_id, name, slug, icon, description, display_order, metadata) VALUES
  (
    get_game_id('league-of-legends'),
    'Accounts',
    'accounts',
    '👤',
    'League of Legends accounts with champions and skins',
    1,
    '{
      "type": "account",
      "requires_region": true,
      "available_regions": [
        {"code": "NA", "name": "North America"},
        {"code": "EUW", "name": "Europe West"},
        {"code": "EUNE", "name": "Europe Nordic & East"},
        {"code": "KR", "name": "Korea"},
        {"code": "BR", "name": "Brazil"},
        {"code": "LAN", "name": "Latin America North"},
        {"code": "LAS", "name": "Latin America South"},
        {"code": "OCE", "name": "Oceania"},
        {"code": "TR", "name": "Turkey"},
        {"code": "RU", "name": "Russia"},
        {"code": "JP", "name": "Japan"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('league-of-legends'),
    'RP (Riot Points)',
    'rp',
    '💎',
    'League of Legends currency',
    2,
    '{
      "type": "currency",
      "unit_label": "RP",
      "requires_region": true,
      "available_regions": [
        {"code": "NA", "name": "North America"},
        {"code": "EUW", "name": "Europe West"},
        {"code": "EUNE", "name": "Europe Nordic & East"}
      ]
    }'::jsonb
  ),
  (
    get_game_id('league-of-legends'),
    'Boosting',
    'boosting',
    '🚀',
    'Rank boosting and elo services',
    3,
    '{"type": "service"}'::jsonb
  ),
  (
    get_game_id('league-of-legends'),
    'Coaching',
    'coaching',
    '🎓',
    'Professional LoL coaching',
    4,
    '{"type": "service"}'::jsonb
  );

-- =====================================================
-- 3. UPDATE LISTINGS TABLE
-- Add region and platform fields for listings
-- =====================================================

DO $$
BEGIN
  -- Add region field for listings (for gift cards, regional accounts, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'region'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN region text;
    CREATE INDEX idx_listings_region ON public.listings(region) WHERE region IS NOT NULL;
    COMMENT ON COLUMN public.listings.region IS 'Region code for region-specific listings (gift cards, regional accounts, etc.)';
  END IF;

  -- Add platform field for listings (for games with platform-specific items)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'platform'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN platform text;
    CREATE INDEX idx_listings_platform ON public.listings(platform) WHERE platform IS NOT NULL;
    COMMENT ON COLUMN public.listings.platform IS 'Platform for platform-specific listings (PC, PlayStation, Xbox, etc.)';
  END IF;
END $$;

-- =====================================================
-- 4. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get categories for a specific game
CREATE OR REPLACE FUNCTION get_game_categories(game_id_param uuid)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  icon text,
  description text,
  display_order integer,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.icon,
    c.description,
    c.display_order,
    c.metadata
  FROM public.categories c
  WHERE c.game_id = game_id_param
    AND c.is_active = true
  ORDER BY c.display_order ASC, c.name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a category requires region
CREATE OR REPLACE FUNCTION category_requires_region(category_id_param uuid)
RETURNS boolean AS $$
  SELECT COALESCE((metadata->>'requires_region')::boolean, false)
  FROM public.categories
  WHERE id = category_id_param;
$$ LANGUAGE sql STABLE;

-- Function to check if a category requires platform
CREATE OR REPLACE FUNCTION category_requires_platform(category_id_param uuid)
RETURNS boolean AS $$
  SELECT COALESCE((metadata->>'requires_platform')::boolean, false)
  FROM public.categories
  WHERE id = category_id_param;
$$ LANGUAGE sql STABLE;

-- Function to get available regions for a category
CREATE OR REPLACE FUNCTION get_category_regions(category_id_param uuid)
RETURNS jsonb AS $$
  SELECT COALESCE(metadata->'available_regions', '[]'::jsonb)
  FROM public.categories
  WHERE id = category_id_param;
$$ LANGUAGE sql STABLE;

-- Function to get available platforms for a category
CREATE OR REPLACE FUNCTION get_category_platforms(category_id_param uuid)
RETURNS jsonb AS $$
  SELECT COALESCE(metadata->'available_platforms', '[]'::jsonb)
  FROM public.categories
  WHERE id = category_id_param;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- 5. UPDATE LISTING TEMPLATES
-- Link templates to new game-specific categories
-- =====================================================

-- Update existing templates to reference new category structure
-- This will be handled by the template system dynamically

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.categories TO authenticated, anon;
GRANT ALL ON public.categories TO service_role;

-- Drop the helper function (only needed during migration)
DROP FUNCTION IF EXISTS get_game_id(text);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for game+category+region queries
CREATE INDEX IF NOT EXISTS idx_listings_game_category_region
  ON public.listings(game_id, category_id, region)
  WHERE status = 'active' AND region IS NOT NULL;

-- Composite index for game+category+platform queries
CREATE INDEX IF NOT EXISTS idx_listings_game_category_platform
  ON public.listings(game_id, category_id, platform)
  WHERE status = 'active' AND platform IS NOT NULL;

-- Full game+category+region+platform index for advanced filtering
CREATE INDEX IF NOT EXISTS idx_listings_full_filter
  ON public.listings(game_id, category_id, region, platform, price)
  WHERE status = 'active';

COMMENT ON INDEX idx_listings_full_filter IS 'Optimizes filtering by game, category, region, platform, and price';
