-- Phase 1 · Step 1b — Unify the two category systems. PHASE A (expand + backfill).
--
-- Before: `public.categories` (per-game rows, `listings.category_id` FK) is what
-- the public reads; `global_categories` + `game_categories` is what the admin
-- wizard / sell wizard / template builder write; `_category-bridge.ts` keeps
-- them in sync and carries the V24 workaround (duplicate legacy rows of one
-- metadata.type broke `.maybeSingle()` → "Couldn't resolve a category").
--
-- After this migration:
--   • global_categories is the taxonomy: 5 primaries + 8 sub-categories
--     (parent_id → primary), each with a `default_type` (fee key) and
--     `default_slug`. Nav / templates / admin pickers list `parent_id IS NULL`.
--   • game_categories is the ONLY per-game category row: slug, name, type,
--     copy, icons, sort — copied verbatim from the legacy row so every public
--     URL (/[game]/[categorySlug]) serves identically. UNIQUE (game_id, slug),
--     UNIQUE (game_id, global_category_id) kept, `type` CHECK-constrained.
--   • listings.game_category_id (nullable in Phase A) is backfilled from
--     categories via game_categories.legacy_category_id.
--   • Two Phase-A-only triggers keep both sides consistent so the reader
--     switch is revertable with `git revert` and no data migration:
--       game_categories → categories mirror (BEFORE INSERT/UPDATE)
--       listings.category_id ⇄ listings.game_category_id (BEFORE INSERT/UPDATE)
--     Both carry a recursion guard (transaction-local GUC app.category_sync).
--   • RLS parity: game_categories SELECT USING (true), exactly like categories.
--   • get_price_guidance() resolves via game_categories (CREATE OR REPLACE
--     keeps its existing ACL — no db-p0-grants list change).
--
-- Nothing is dropped. Phase B (separate step, after ≥1 clean week) drops the
-- triggers, listings.category_id, listing_templates, legacy_category_id, the
-- dead category_* functions and `categories` itself — see
-- supabase/migrations_draft/PHASE-B-DRAFT_categories_unify_phase_b.sql.
--
-- Idempotent: every step is IF NOT EXISTS / ON CONFLICT / WHERE … IS NULL and
-- the two data repairs are no-ops once applied. Ends with a proof block that
-- RAISES if any listing is unmatched or maps to a different game / type / slug.
--
-- Prod counts (read-only, 2026-09-17, before): categories 440 (439 active),
-- game_categories 466 (429 enabled), listings 103 (59 active), 3 legitimate
-- duplicate (game, type) groups (roblox items, valorant service, gta-v
-- account), 1 row with no type (gta-vi/buy-items), 1 gift_card row, 1 paused
-- listing whose category belongs to another game.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. global_categories — taxonomy columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.global_categories
  ADD COLUMN IF NOT EXISTS default_type text,
  ADD COLUMN IF NOT EXISTS default_slug text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.global_categories(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.global_categories.default_type IS
  'Fee / warranty key copied onto game_categories.type when a pair is created. Same literals as lib/fees CategoryType.';
COMMENT ON COLUMN public.global_categories.default_slug IS
  'Slug a new game_categories row gets unless the caller overrides it (currency → buy-{name} via lib/utils/category-canonical).';
COMMENT ON COLUMN public.global_categories.parent_id IS
  'NULL = primary (shown in nav / template / admin pickers). Set = sub-category of that primary (limiteds → items, …).';

-- The five primaries (seeded by 20260916104417).
UPDATE public.global_categories SET default_type = 'currency', default_slug = 'buy-currency' WHERE slug = 'currency';
UPDATE public.global_categories SET default_type = 'items',    default_slug = 'buy-items'    WHERE slug = 'items';
UPDATE public.global_categories SET default_type = 'account',  default_slug = 'buy-accounts' WHERE slug = 'accounts';
UPDATE public.global_categories SET default_type = 'top_up',   default_slug = 'top-up'       WHERE slug = 'top-up';
UPDATE public.global_categories SET default_type = 'service',  default_slug = 'boosting'     WHERE slug = 'boosting';

-- Eight sub-categories, promoted from legacy rows whose slug is not the
-- canonical one for their type (lib/utils/category-canonical.ts
-- SPECIAL_CATEGORY_SLUG_MAP + coaching). default_type is taken from the
-- legacy row when this environment has one (so game_categories.type ==
-- global default on prod) and falls back to the documented default on a
-- fresh stack. parent = the primary with the same default_type; gift-cards
-- has its own type (gift_card) and hangs under top-up.
-- Boosting stays is_active = false globally (per-game rows are preserved).
DO $$
DECLARE
  s record;
  v_type text;
  v_parent uuid;
BEGIN
  FOR s IN
    SELECT * FROM (VALUES
      ('limiteds',        'Limiteds',        'limiteds',            'items',     'Roblox limited items'),
      ('skins',           'Skins',           'buy-skins',           'items',     'Cosmetic skins'),
      ('server-items',    'Server Items',    'buy-server-items',    'items',     'Server-side items'),
      ('unlocks',         'Unlocks',         'buy-unlocks',         'service',   'Unlocks'),
      ('modded-accounts', 'Modded Accounts', 'buy-modded-accounts', 'account',   'Modded accounts'),
      ('servers',         'Servers',         'servers',             'service',   'Server hosting and setup'),
      ('coaching',        'Coaching',        'coaching',            'service',   'Coaching sessions'),
      ('gift-cards',      'Gift Cards',      'gift-cards',          'gift_card', 'Gift cards')
    ) AS t(slug, name, default_slug, fallback_type, description)
  LOOP
    SELECT c.metadata->>'type' INTO v_type
      FROM public.categories c
     WHERE c.slug = s.default_slug
       AND c.metadata->>'type' IN ('currency','items','account','top_up','service','gift_card')
     ORDER BY c.created_at LIMIT 1;
    v_type := COALESCE(v_type, s.fallback_type);

    SELECT id INTO v_parent FROM public.global_categories
     WHERE parent_id IS NULL AND default_type = v_type AND slug <> s.slug
     ORDER BY sort_order LIMIT 1;
    IF v_parent IS NULL AND v_type = 'gift_card' THEN
      SELECT id INTO v_parent FROM public.global_categories WHERE slug = 'top-up';
    END IF;
    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'no primary global category for type % (sub-category %)', v_type, s.slug;
    END IF;

    INSERT INTO public.global_categories
      (slug, name, description, icon_emoji, sort_order, is_active, default_type, default_slug, parent_id)
    VALUES
      (s.slug, s.name, s.description, '📦', 100, true, v_type, s.default_slug, v_parent)
    ON CONFLICT (slug) DO UPDATE
      SET default_type = EXCLUDED.default_type,
          default_slug = EXCLUDED.default_slug,
          parent_id    = COALESCE(public.global_categories.parent_id, EXCLUDED.parent_id);
    RAISE NOTICE 'global sub-category %: type=% parent=%', s.slug, v_type, v_parent;
  END LOOP;
END $$;

ALTER TABLE public.global_categories
  ALTER COLUMN default_type SET NOT NULL,
  ALTER COLUMN default_slug SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_categories_default_type_check') THEN
    ALTER TABLE public.global_categories
      ADD CONSTRAINT global_categories_default_type_check
      CHECK (default_type IN ('currency','items','account','top_up','service','gift_card'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_categories_parent_not_self') THEN
    ALTER TABLE public.global_categories
      ADD CONSTRAINT global_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_global_categories_parent ON public.global_categories (parent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. game_categories — per-game columns (the legacy row's fields move here)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.game_categories
  ADD COLUMN IF NOT EXISTS slug               text,
  ADD COLUMN IF NOT EXISTS name               text,
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS type               text,
  ADD COLUMN IF NOT EXISTS icon_emoji         text,
  ADD COLUMN IF NOT EXISTS icon_url           text,
  ADD COLUMN IF NOT EXISTS seo_h1             text,
  ADD COLUMN IF NOT EXISTS seo_intro          text,
  ADD COLUMN IF NOT EXISTS sub_types          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extras             jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legacy_category_id uuid;

COMMENT ON TABLE  public.game_categories IS
  'The per-game category row. Source of truth for /[game]/[slug] since Step 1b; `categories` is mirrored from it during Phase A and dropped in Phase B.';
COMMENT ON COLUMN public.game_categories.slug IS 'URL segment under /[game]/. Copied verbatim from the legacy row; UNIQUE per game.';
COMMENT ON COLUMN public.game_categories.type IS 'Fee / warranty key (lib/fees CategoryType). CHECK-constrained; not JSON.';
COMMENT ON COLUMN public.game_categories.sub_types IS 'Display chips (CategoryPills). Not filtered on.';
COMMENT ON COLUMN public.game_categories.extras IS 'Free-form leftovers from legacy metadata (unit_label, is_limited, …). Nothing filters or joins on this.';
COMMENT ON COLUMN public.game_categories.legacy_category_id IS 'Phase A mapping to public.categories.id. Dropped in Phase B.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. listings.game_category_id (nullable during Phase A)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS game_category_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_game_category_id_fkey') THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_game_category_id_fkey
      FOREIGN KEY (game_category_id) REFERENCES public.game_categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_game_category_id ON public.listings (game_category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Data repairs — explicit, logged, idempotent
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
BEGIN
  -- R1: gta-vi/buy-items has no metadata.type on prod (the only such row).
  -- Its slug and every other buy-items row say `items`.
  UPDATE public.categories c
     SET metadata = jsonb_set(COALESCE(c.metadata, '{}'::jsonb), '{type}', '"items"'::jsonb)
    FROM public.games g
   WHERE g.id = c.game_id AND g.slug = 'gta-vi' AND c.slug = 'buy-items'
     AND COALESCE(c.metadata->>'type', '') = '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'R1 gta-vi/buy-items metadata.type → items: % row(s)', n;

  -- Guard: after R1 every legacy row must carry an allowed type.
  SELECT count(*) INTO n FROM public.categories
   WHERE COALESCE(metadata->>'type','') NOT IN ('currency','items','account','top_up','service','gift_card');
  IF n > 0 THEN
    RAISE EXCEPTION 'categories: % row(s) still have an unmappable metadata.type — repair before applying', n;
  END IF;
END $$;

-- R2: the one paused listing whose category row belongs to another game.
-- Re-pointed to the same-type category of the listing's own game (the game is
-- what the seller picked first and what the URL is built from): listing
-- 590cac32-9074-41cc-b996-6834ef7fe14a (paused, valorant) pointed at
-- adopt-me/buy-accounts → valorant's account category. Pinned by id AND the
-- predicate, so it is a no-op anywhere the row is already consistent; a guard
-- after it raises if ANY cross-game listing remains.
DO $$
DECLARE
  r record;
  v_target uuid;
  n int := 0;
BEGIN
  FOR r IN
    SELECT l.id AS listing_id, l.status, l.game_id, l.category_id,
           c.slug AS cat_slug, c.metadata->>'type' AS cat_type, c.game_id AS cat_game_id
      FROM public.listings l
      JOIN public.categories c ON c.id = l.category_id
     WHERE c.game_id <> l.game_id
       -- pinned: the one row prod has (valorant listing on adopt-me/buy-accounts,
       -- confirmed by the owner from growth/step-1b-audit-counts.mjs 2026-09-17).
       AND l.id = '590cac32-9074-41cc-b996-6834ef7fe14a'::uuid
     ORDER BY l.created_at
  LOOP
    IF n >= 1 THEN
      RAISE EXCEPTION 'R2: more than one cross-game listing (second: %) — audit before applying', r.listing_id;
    END IF;
    SELECT id INTO v_target FROM public.categories
     WHERE game_id = r.game_id AND metadata->>'type' = r.cat_type
     ORDER BY (slug = r.cat_slug) DESC, is_active DESC, created_at
     LIMIT 1;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'R2: listing % (game %) has no % category in its own game — cannot repair automatically', r.listing_id, r.game_id, r.cat_type;
    END IF;
    UPDATE public.listings SET category_id = v_target WHERE id = r.listing_id;
    n := n + 1;
    RAISE NOTICE 'R2 listing % (%): category % (%) → % (same game)', r.listing_id, r.status, r.category_id, r.cat_slug, v_target;
  END LOOP;
  RAISE NOTICE 'R2 cross-game listing repair: % row(s)', n;

  SELECT count(*) INTO n FROM public.listings l JOIN public.categories c ON c.id = l.category_id WHERE c.game_id <> l.game_id;
  IF n > 0 THEN
    RAISE EXCEPTION 'listings: % row(s) still point at a category of another game — repair before applying', n;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill game_categories from categories (legacy row → pair row)
-- ─────────────────────────────────────────────────────────────────────────────
-- Resolution order per legacy row:
--   a) a sub-category global whose default_slug equals the legacy slug
--      (limiteds, buy-skins, …) — this is what keeps the 3 duplicate
--      (game, type) groups as distinct rows under UNIQUE (game_id, global_category_id);
--   b) else the primary global whose default_type equals metadata.type.
-- Then match the existing (game_id, global_category_id) pair or create one.
-- Legacy fields win for everything the public renders today (slug, name,
-- description, icon ← legacy `icon` (what /[game] rendered; icon_emoji was
-- an unrendered default), sort ← display_order, type); the pair keeps is_enabled
-- (5 prod rows stay disabled on purpose), seo_title/seo_description and its
-- region/platform settings (OR-merged with the legacy flags).

DO $$
DECLARE
  r record;
  v_global uuid;
  v_gc uuid;
  v_owner uuid;
  v_matched int := 0;
  v_created int := 0;
  v_known text[] := ARRAY['type','sub_types','requires_region','requires_platform','available_regions','available_platforms'];
  v_sub_types text[];
BEGIN
  FOR r IN
    SELECT c.*, g.slug AS game_slug
      FROM public.categories c
      JOIN public.games g ON g.id = c.game_id
     ORDER BY c.created_at, c.id
  LOOP
    SELECT id INTO v_global FROM public.global_categories
     WHERE parent_id IS NOT NULL AND default_slug = r.slug;
    IF v_global IS NULL THEN
      SELECT id INTO v_global FROM public.global_categories
       WHERE parent_id IS NULL AND default_type = r.metadata->>'type'
       ORDER BY sort_order LIMIT 1;
    END IF;
    IF v_global IS NULL THEN
      RAISE EXCEPTION 'categories %: %/% type % has no global category', r.id, r.game_slug, r.slug, r.metadata->>'type';
    END IF;

    v_sub_types := CASE
      WHEN jsonb_typeof(r.metadata->'sub_types') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(r.metadata->'sub_types'))
      ELSE '{}'::text[] END;

    SELECT id, legacy_category_id INTO v_gc, v_owner
      FROM public.game_categories
     WHERE game_id = r.game_id AND global_category_id = v_global;

    IF v_gc IS NOT NULL THEN
      IF v_owner IS NOT NULL AND v_owner <> r.id THEN
        RAISE EXCEPTION 'pair % (%/global %) is already mapped to legacy % — legacy row % (%) would collide; add a sub-category global for it',
          v_gc, r.game_slug, v_global, v_owner, r.id, r.slug;
      END IF;
      UPDATE public.game_categories gc SET
        legacy_category_id  = r.id,
        slug                = r.slug,
        name                = r.name,
        description         = r.description,
        type                = r.metadata->>'type',
        icon_emoji          = COALESCE(NULLIF(r.icon, ''), r.icon_emoji),
        icon_url            = COALESCE(r.icon_url, gc.icon_url),
        sort_order          = COALESCE(r.display_order, 0),
        seo_title           = COALESCE(gc.seo_title, r.seo_title),
        seo_description     = COALESCE(gc.seo_description, r.seo_description),
        seo_h1              = r.seo_h1,
        seo_intro           = r.seo_intro,
        sub_types           = v_sub_types,
        extras              = COALESCE(r.metadata, '{}'::jsonb) - v_known,
        requires_region     = gc.requires_region   OR COALESCE((r.metadata->>'requires_region')::boolean, false),
        requires_platform   = gc.requires_platform OR COALESCE((r.metadata->>'requires_platform')::boolean, false),
        available_regions   = CASE WHEN gc.available_regions   = '[]'::jsonb AND jsonb_typeof(r.metadata->'available_regions')   = 'array' THEN r.metadata->'available_regions'   ELSE gc.available_regions   END,
        available_platforms = CASE WHEN gc.available_platforms = '[]'::jsonb AND jsonb_typeof(r.metadata->'available_platforms') = 'array' THEN r.metadata->'available_platforms' ELSE gc.available_platforms END
      WHERE gc.id = v_gc;
      v_matched := v_matched + 1;
    ELSE
      INSERT INTO public.game_categories
        (game_id, global_category_id, is_enabled, legacy_category_id, slug, name, description, type,
         icon_emoji, icon_url, sort_order, seo_title, seo_description, seo_h1, seo_intro, sub_types, extras,
         requires_region, requires_platform, available_regions, available_platforms, created_at)
      VALUES
        (r.game_id, v_global, r.is_active, r.id, r.slug, r.name, r.description, r.metadata->>'type',
         COALESCE(NULLIF(r.icon, ''), r.icon_emoji), r.icon_url, COALESCE(r.display_order, 0), r.seo_title, r.seo_description, r.seo_h1, r.seo_intro, v_sub_types,
         COALESCE(r.metadata, '{}'::jsonb) - v_known,
         COALESCE((r.metadata->>'requires_region')::boolean, false),
         COALESCE((r.metadata->>'requires_platform')::boolean, false),
         CASE WHEN jsonb_typeof(r.metadata->'available_regions')   = 'array' THEN r.metadata->'available_regions'   ELSE '[]'::jsonb END,
         CASE WHEN jsonb_typeof(r.metadata->'available_platforms') = 'array' THEN r.metadata->'available_platforms' ELSE '[]'::jsonb END,
         r.created_at);
      v_created := v_created + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'backfill game_categories: matched % existing pair(s), created % new pair(s)', v_matched, v_created;
END $$;

-- Pairs that never had a legacy row (prod: the disabled ones) get the global
-- defaults and a mirrored legacy row (is_active = is_enabled, so nothing new
-- becomes public), so the invariant "every pair has a legacy row" holds from
-- day one and a listing can be inserted against any pair during Phase A.
DO $$
DECLARE
  r record;
  v_legacy uuid;
  n int := 0;
BEGIN
  FOR r IN
    SELECT gc.id, gc.game_id, gc.is_enabled, gc.sort_order, gc.description, gc.icon_emoji, gc.icon_url,
           gc.requires_region, gc.requires_platform, gc.available_regions, gc.available_platforms,
           g.name AS g_name, g.description AS g_description, g.icon_emoji AS g_icon, g.default_slug, g.default_type
      FROM public.game_categories gc
      JOIN public.global_categories g ON g.id = gc.global_category_id
     WHERE gc.legacy_category_id IS NULL
     ORDER BY gc.created_at, gc.id
  LOOP
    UPDATE public.game_categories SET
      slug        = r.default_slug,
      name        = r.g_name,
      type        = r.default_type,
      description = COALESCE(r.description, r.g_description),
      icon_emoji  = COALESCE(r.icon_emoji, r.g_icon)
    WHERE id = r.id;

    INSERT INTO public.categories
      (game_id, name, slug, description, icon, icon_emoji, icon_url, display_order, is_active, metadata)
    VALUES
      (r.game_id, r.g_name, r.default_slug, COALESCE(r.description, r.g_description),
       COALESCE(r.icon_emoji, r.g_icon), COALESCE(r.icon_emoji, r.g_icon), r.icon_url, r.sort_order, r.is_enabled,
       jsonb_build_object('type', r.default_type,
                          'requires_region', r.requires_region, 'requires_platform', r.requires_platform,
                          'available_regions', r.available_regions, 'available_platforms', r.available_platforms))
    RETURNING id INTO v_legacy;

    UPDATE public.game_categories SET legacy_category_id = v_legacy WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'pairs without a legacy row: % filled from global defaults + mirrored', n;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Backfill listings.game_category_id
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.listings l
   SET game_category_id = gc.id
  FROM public.game_categories gc
 WHERE gc.legacy_category_id = l.category_id
   AND l.game_category_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Constraints (only after the backfill has filled every row)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.game_categories
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN type SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_categories_type_check') THEN
    ALTER TABLE public.game_categories ADD CONSTRAINT game_categories_type_check
      CHECK (type IN ('currency','items','account','top_up','service','gift_card'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_categories_slug_check') THEN
    -- Stricter than today (today any non-empty text is accepted); prod's 23
    -- distinct slugs all match.
    ALTER TABLE public.game_categories ADD CONSTRAINT game_categories_slug_check
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_categories_game_id_slug_key') THEN
    -- Step 4's importer resolves (game slug, category slug); games.slug is
    -- already UNIQUE, so this makes the pair unique and indexed.
    ALTER TABLE public.game_categories ADD CONSTRAINT game_categories_game_id_slug_key UNIQUE (game_id, slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_categories_legacy_category_id_key') THEN
    ALTER TABLE public.game_categories ADD CONSTRAINT game_categories_legacy_category_id_key UNIQUE (legacy_category_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_categories_type ON public.game_categories (type) WHERE is_enabled = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS parity — categories is SELECT USING (true); game_categories must be too
-- ─────────────────────────────────────────────────────────────────────────────
-- Every reader filters is_enabled explicitly (incl. isEnabledGameCategory,
-- the AUTH-010 gate). Session-client money paths (checkout, orders) must still
-- see the category of a listing whose pair was disabled later, exactly as
-- they see an inactive legacy row today.

DROP POLICY IF EXISTS game_categories_public_read ON public.game_categories;
CREATE POLICY game_categories_public_read ON public.game_categories FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Phase-A sync triggers (both dropped in Phase B)
-- ─────────────────────────────────────────────────────────────────────────────
-- Recursion guard: a transaction-local GUC. The mirror writes categories
-- (no triggers there) and the listings trigger only reads, so neither can
-- loop today; the guard makes that true by construction if a trigger is ever
-- added on `categories` that writes back.

-- 9a. game_categories → categories mirror. SECURITY DEFINER because the
-- legacy table has no write policy (its writers were always service-role),
-- and an admin session updating game_categories must not fail on the mirror.
CREATE OR REPLACE FUNCTION public.game_categories_mirror_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legacy uuid;
  v_meta jsonb;
BEGIN
  IF current_setting('app.category_sync', true) = '1' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('app.category_sync', '1', true);

  v_meta := COALESCE(NEW.extras, '{}'::jsonb)
         || jsonb_build_object(
              'type', NEW.type,
              'requires_region', NEW.requires_region,
              'requires_platform', NEW.requires_platform,
              'available_regions', NEW.available_regions,
              'available_platforms', NEW.available_platforms)
         || CASE WHEN COALESCE(array_length(NEW.sub_types, 1), 0) > 0
                 THEN jsonb_build_object('sub_types', to_jsonb(NEW.sub_types))
                 ELSE '{}'::jsonb END;

  IF NEW.legacy_category_id IS NULL THEN
    -- Adopt a legacy row that already has this (game, slug) — written by a
    -- rollback-era code path — instead of colliding with categories_game_slug_unique.
    SELECT id INTO v_legacy FROM public.categories
     WHERE game_id = NEW.game_id AND slug = NEW.slug;
    IF v_legacy IS NULL THEN
      INSERT INTO public.categories
        (game_id, name, slug, description, icon, icon_emoji, icon_url, display_order, is_active, metadata,
         seo_title, seo_description, seo_h1, seo_intro)
      VALUES
        (NEW.game_id, NEW.name, NEW.slug, NEW.description, NEW.icon_emoji, COALESCE(NEW.icon_emoji, '📦'), NEW.icon_url,
         NEW.sort_order, NEW.is_enabled, v_meta, NEW.seo_title, NEW.seo_description, NEW.seo_h1, NEW.seo_intro)
      RETURNING id INTO v_legacy;
    END IF;
    NEW.legacy_category_id := v_legacy;
  END IF;

  UPDATE public.categories SET
    name            = NEW.name,
    slug            = NEW.slug,
    description     = NEW.description,
    icon            = NEW.icon_emoji,
    icon_emoji      = COALESCE(NEW.icon_emoji, '📦'),
    icon_url        = NEW.icon_url,
    display_order   = NEW.sort_order,
    is_active       = NEW.is_enabled,
    metadata        = v_meta,
    seo_title       = NEW.seo_title,
    seo_description = NEW.seo_description,
    seo_h1          = NEW.seo_h1,
    seo_intro       = NEW.seo_intro
  WHERE id = NEW.legacy_category_id;

  PERFORM set_config('app.category_sync', '', true);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.game_categories_mirror_legacy() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_game_categories_mirror_legacy ON public.game_categories;
CREATE TRIGGER trg_game_categories_mirror_legacy
  BEFORE INSERT OR UPDATE ON public.game_categories
  FOR EACH ROW EXECUTE FUNCTION public.game_categories_mirror_legacy();

-- 9b. listings.category_id ⇄ listings.game_category_id. Whichever side the
-- writer sets, the other is derived through legacy_category_id, so the
-- backfill invariant survives every writer (sell wizard, admin, guard
-- fixtures, and the rollback-era publish path).
CREATE OR REPLACE FUNCTION public.listings_category_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.category_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.game_category_id IS DISTINCT FROM OLD.game_category_id AND NEW.game_category_id IS NOT NULL THEN
    SELECT legacy_category_id INTO NEW.category_id FROM public.game_categories WHERE id = NEW.game_category_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.category_id IS DISTINCT FROM OLD.category_id AND NEW.category_id IS NOT NULL THEN
    SELECT id INTO NEW.game_category_id FROM public.game_categories WHERE legacy_category_id = NEW.category_id;
  ELSE
    IF NEW.game_category_id IS NULL AND NEW.category_id IS NOT NULL THEN
      SELECT id INTO NEW.game_category_id FROM public.game_categories WHERE legacy_category_id = NEW.category_id;
    END IF;
    IF NEW.category_id IS NULL AND NEW.game_category_id IS NOT NULL THEN
      SELECT legacy_category_id INTO NEW.category_id FROM public.game_categories WHERE id = NEW.game_category_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.listings_category_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_listings_category_sync ON public.listings;
CREATE TRIGGER trg_listings_category_sync
  BEFORE INSERT OR UPDATE OF category_id, game_category_id ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_category_sync();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. get_price_guidance — resolve through game_categories
-- ─────────────────────────────────────────────────────────────────────────────
-- Same signature and return shape; CREATE OR REPLACE keeps the baseline ACL
-- (callable by authenticated from sell-wizard.ts fetchPriceGuidance). The
-- legacy body picked a legacy row with LIMIT 1 (arbitrary when a game had
-- two rows of one type); this resolves the pair for the global slug, so
-- e.g. 'items' means the buy-items row, never limiteds.

CREATE OR REPLACE FUNCTION public.get_price_guidance(p_game_id uuid, p_category_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_game_category_id uuid;
  v_p25    numeric;
  v_median numeric;
  v_p75    numeric;
  v_count  integer;
BEGIN
  SELECT gc.id INTO v_game_category_id
    FROM public.game_categories gc
    JOIN public.global_categories g ON g.id = gc.global_category_id
   WHERE gc.game_id = p_game_id
     AND g.slug = p_category_slug
   LIMIT 1;

  IF v_game_category_id IS NULL THEN
    RETURN jsonb_build_object('sample_size', 0, 'p25', NULL, 'median', NULL, 'p75', NULL);
  END IF;

  SELECT
    COUNT(*),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price),
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)
  INTO v_count, v_p25, v_median, v_p75
  FROM public.listings
  WHERE game_id          = p_game_id
    AND game_category_id = v_game_category_id
    AND status           = 'sold'
    AND updated_at      >= NOW() - INTERVAL '60 days';

  IF v_count < 3 THEN
    RETURN jsonb_build_object('sample_size', v_count, 'p25', NULL, 'median', NULL, 'p75', NULL);
  END IF;

  RETURN jsonb_build_object(
    'sample_size', v_count,
    'p25',         ROUND(v_p25, 2),
    'median',      ROUND(v_median, 2),
    'p75',         ROUND(v_p75, 2)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Proof — the migration refuses to finish half-applied
-- ─────────────────────────────────────────────────────────────────────────────
-- The same query is in growth/step-1b-REPORT.md for the owner to run
-- read-only before and after. Expected: every counter 0.

DO $$
DECLARE
  v_unmatched int; v_game int; v_type int; v_slug int; v_legacy_unmapped int; v_pairs_unmapped int;
BEGIN
  SELECT
    count(*) FILTER (WHERE l.game_category_id IS NULL),
    count(*) FILTER (WHERE gc.game_id <> l.game_id),
    count(*) FILTER (WHERE gc.type <> c.metadata->>'type'),
    count(*) FILTER (WHERE gc.slug <> c.slug)
  INTO v_unmatched, v_game, v_type, v_slug
  FROM public.listings l
  LEFT JOIN public.game_categories gc ON gc.id = l.game_category_id
  JOIN public.categories c ON c.id = l.category_id;

  SELECT count(*) INTO v_legacy_unmapped FROM public.categories c
   WHERE NOT EXISTS (SELECT 1 FROM public.game_categories gc WHERE gc.legacy_category_id = c.id);
  SELECT count(*) INTO v_pairs_unmapped FROM public.game_categories WHERE legacy_category_id IS NULL;

  RAISE NOTICE 'proof: listings unmatched=% game_mismatch=% type_mismatch=% slug_mismatch=% | legacy rows without pair=% | pairs without legacy=%',
    v_unmatched, v_game, v_type, v_slug, v_legacy_unmapped, v_pairs_unmapped;

  IF v_unmatched > 0 OR v_game > 0 OR v_type > 0 OR v_slug > 0 OR v_legacy_unmapped > 0 OR v_pairs_unmapped > 0 THEN
    RAISE EXCEPTION 'categories unify Phase A: proof failed (unmatched=% game=% type=% slug=% legacy_unmapped=% pairs_unmapped=%)',
      v_unmatched, v_game, v_type, v_slug, v_legacy_unmapped, v_pairs_unmapped;
  END IF;
END $$;
