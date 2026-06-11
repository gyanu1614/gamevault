-- =====================================================
-- ADMIN REDESIGN — PHASE A (additive only)
-- Date: 2026-06-10
--
-- Purpose: Create the new schema (global categories, game-category join,
-- attribute templates, attributes, options, conditional rules) ALONGSIDE
-- the existing schema. Backfill from current data. Do NOT touch existing
-- tables, columns, FKs, or policies.
--
-- After this migration:
--   - The live app reads the OLD tables (categories, listing_templates)
--     exactly as before. Zero behavior change.
--   - New tables (global_categories, game_categories, attribute_templates,
--     attributes, attribute_options, attribute_conditional_rules) are
--     populated and queryable.
--   - Phase B/C will introduce a new server-action layer that reads from
--     the new tables. Cutover happens then — not here.
--
-- Naming note:
--   We use `global_categories` rather than reusing the name `categories`
--   so the existing FK `listings.category_id → categories.id` and the
--   FK `categories.game_id → games.id` keep working.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. GLOBAL CATEGORIES (5 fixed rows at launch)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.global_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon_url text,
  icon_emoji text DEFAULT '📦',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.global_categories IS
  'Phase-A: the 5 global categories (Currency / Items / Accounts / Top Up / Boosting). '
  'Lives alongside the existing game-scoped `categories` table. App reads OLD table until '
  'Phase C cutover.';

CREATE INDEX IF NOT EXISTS idx_global_categories_active ON public.global_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_global_categories_sort ON public.global_categories(sort_order, name);

INSERT INTO public.global_categories (slug, name, description, icon_emoji, sort_order, is_active, seo_title, seo_description) VALUES
  ('currency', 'Currency',  'In-game currency (Robux, V-Bucks, gold, etc.)', '💰', 1, true,
    'Buy & Sell Game Currency Safely | GameVault',
    'Trade in-game currency across 30+ games with VaultShield escrow protection.'),
  ('items',    'Items',     'In-game items, pets, skins, fruits, knives, and more', '🎒', 2, true,
    'Buy & Sell Game Items Safely | GameVault',
    'Browse rare in-game items across the most popular titles.'),
  ('accounts', 'Accounts',  'Game accounts with progression, skins, and stats', '👤', 3, true,
    'Buy & Sell Game Accounts Safely | GameVault',
    'Premium game accounts protected by escrow.'),
  ('top-up',   'Top Up',    'Official top-ups (Genesis Crystals, UC, V-Bucks via Crew, etc.)', '⚡', 4, true,
    'Game Top Up Service | GameVault',
    'Top up your favorite games quickly and safely.'),
  ('boosting', 'Boosting',  'Rank, level, and achievement boosting services', '🚀', 5, false,
    'Boosting Services | GameVault',
    'Professional boosting services across competitive titles.')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. GAME ↔ CATEGORY JOIN
-- =====================================================

CREATE TABLE IF NOT EXISTS public.game_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  global_category_id uuid NOT NULL REFERENCES public.global_categories(id) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT true,
  requires_region boolean NOT NULL DEFAULT false,
  available_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_platform boolean NOT NULL DEFAULT false,
  available_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_modes text[] NOT NULL DEFAULT ARRAY['manual']::text[],
  sort_order int NOT NULL DEFAULT 0,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, global_category_id)
);

COMMENT ON TABLE public.game_categories IS
  'Phase-A: which global categories each game has enabled, plus per-pair settings '
  '(region/platform requirements, allowed delivery modes).';

CREATE INDEX IF NOT EXISTS idx_game_categories_game     ON public.game_categories(game_id);
CREATE INDEX IF NOT EXISTS idx_game_categories_category ON public.game_categories(global_category_id);
CREATE INDEX IF NOT EXISTS idx_game_categories_enabled  ON public.game_categories(is_enabled) WHERE is_enabled = true;

-- =====================================================
-- 3. ATTRIBUTE TEMPLATES (per game_category)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attribute_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_category_id uuid NOT NULL REFERENCES public.game_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_category_id)
);

COMMENT ON TABLE public.attribute_templates IS
  'Phase-A: one attribute template per (game, global_category) pair. Replaces '
  '`listing_templates`. Live app still reads listing_templates until Phase C cutover.';

CREATE INDEX IF NOT EXISTS idx_attribute_templates_gc     ON public.attribute_templates(game_category_id);
CREATE INDEX IF NOT EXISTS idx_attribute_templates_active ON public.attribute_templates(is_active) WHERE is_active = true;

-- =====================================================
-- 4. ATTRIBUTES (schema-builder rows)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attributes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.attribute_templates(id) ON DELETE CASCADE,
  parent_attribute_id uuid NULL REFERENCES public.attributes(id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('text','number','textarea','select','multiselect','boolean','image_select')),
  is_required boolean NOT NULL DEFAULT false,
  placeholder text,
  help_text text,
  min_value numeric,
  max_value numeric,
  max_length int,
  default_value jsonb,
  sort_order int NOT NULL DEFAULT 0,
  seo_title text,
  seo_description text,
  facet_indexed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, slug)
);

COMMENT ON COLUMN public.attributes.slug IS
  'URL-safe slug. Used in future faceted browse URLs '
  'like /games/<game>/<category>/<attribute-slug>/<option-slug>.';
COMMENT ON COLUMN public.attributes.parent_attribute_id IS
  'Optional visual grouping hint. Show/hide logic lives in attribute_conditional_rules, not here.';

CREATE INDEX IF NOT EXISTS idx_attributes_template ON public.attributes(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_attributes_facet    ON public.attributes(facet_indexed) WHERE facet_indexed = true;

-- =====================================================
-- 5. ATTRIBUTE OPTIONS (enum values)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attribute_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_id uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  slug text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  description text,
  icon_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, slug)
);

COMMENT ON COLUMN public.attribute_options.slug IS
  'URL-safe slug for option-level landing pages (e.g. /games/<g>/items/brainrot-name/tralalero-tralala).';
COMMENT ON COLUMN public.attribute_options.value IS
  'Actual value written to listings.template_data when this option is selected. Usually the same as slug.';
COMMENT ON COLUMN public.attribute_options.icon_url IS
  'Used by image_select type — option thumbnails (brainrot art, rank badges, knife images).';

CREATE INDEX IF NOT EXISTS idx_attribute_options_attr ON public.attribute_options(attribute_id, sort_order);

-- =====================================================
-- 6. ATTRIBUTE CONDITIONAL RULES (show child if parent matches)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attribute_conditional_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_id uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  trigger_attribute_id uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  operator text NOT NULL CHECK (operator IN ('equals','not_equals','in','not_in')),
  trigger_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attribute_id <> trigger_attribute_id)
);

COMMENT ON TABLE public.attribute_conditional_rules IS
  'Show the child attribute (attribute_id) only when the trigger attribute (trigger_attribute_id) '
  'satisfies the operator against trigger_values. Multiple rules per child are AND-ed.';

CREATE INDEX IF NOT EXISTS idx_acr_attr    ON public.attribute_conditional_rules(attribute_id);
CREATE INDEX IF NOT EXISTS idx_acr_trigger ON public.attribute_conditional_rules(trigger_attribute_id);

-- =====================================================
-- 7. updated_at TRIGGER (shared across new tables)
-- =====================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_global_categories_touch ON public.global_categories;
CREATE TRIGGER trg_global_categories_touch BEFORE UPDATE ON public.global_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_game_categories_touch ON public.game_categories;
CREATE TRIGGER trg_game_categories_touch BEFORE UPDATE ON public.game_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_attribute_templates_touch ON public.attribute_templates;
CREATE TRIGGER trg_attribute_templates_touch BEFORE UPDATE ON public.attribute_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_attributes_touch ON public.attributes;
CREATE TRIGGER trg_attributes_touch BEFORE UPDATE ON public.attributes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_attribute_options_touch ON public.attribute_options;
CREATE TRIGGER trg_attribute_options_touch BEFORE UPDATE ON public.attribute_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- 8. RLS — public reads of active rows, admin writes
-- =====================================================

ALTER TABLE public.global_categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_conditional_rules ENABLE ROW LEVEL SECURITY;

-- Helper: is_admin() check matches the pattern in existing migrations.
-- (Inlined as EXISTS subquery for portability.)

-- global_categories
CREATE POLICY "global_categories_public_read"
  ON public.global_categories FOR SELECT
  USING (is_active = true);
CREATE POLICY "global_categories_admin_all"
  ON public.global_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- game_categories
CREATE POLICY "game_categories_public_read"
  ON public.game_categories FOR SELECT
  USING (is_enabled = true);
CREATE POLICY "game_categories_admin_all"
  ON public.game_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- attribute_templates
CREATE POLICY "attribute_templates_public_read"
  ON public.attribute_templates FOR SELECT
  USING (is_active = true);
CREATE POLICY "attribute_templates_admin_all"
  ON public.attribute_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- attributes (readable when their template is active)
CREATE POLICY "attributes_public_read"
  ON public.attributes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.attribute_templates t WHERE t.id = attributes.template_id AND t.is_active = true));
CREATE POLICY "attributes_admin_all"
  ON public.attributes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- attribute_options (readable when their attribute is readable)
CREATE POLICY "attribute_options_public_read"
  ON public.attribute_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.attributes a
    JOIN public.attribute_templates t ON t.id = a.template_id
    WHERE a.id = attribute_options.attribute_id AND t.is_active = true
  ));
CREATE POLICY "attribute_options_admin_all"
  ON public.attribute_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- attribute_conditional_rules
CREATE POLICY "attribute_conditional_rules_public_read"
  ON public.attribute_conditional_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.attributes a
    JOIN public.attribute_templates t ON t.id = a.template_id
    WHERE a.id = attribute_conditional_rules.attribute_id AND t.is_active = true
  ));
CREATE POLICY "attribute_conditional_rules_admin_all"
  ON public.attribute_conditional_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- Grants
GRANT SELECT ON public.global_categories,
                public.game_categories,
                public.attribute_templates,
                public.attributes,
                public.attribute_options,
                public.attribute_conditional_rules
  TO authenticated, anon;
GRANT ALL ON public.global_categories,
              public.game_categories,
              public.attribute_templates,
              public.attributes,
              public.attribute_options,
              public.attribute_conditional_rules
  TO service_role;

-- =====================================================
-- 9. BACKFILL — game_categories from existing public.categories
--
-- Mapping rule:
--   public.categories.metadata->>'type' → global_categories.slug
--     'currency'   → 'currency'
--     'items'      → 'items'
--     'account'    → 'accounts'
--     'top_up'     → 'top-up'
--     'service'    → 'boosting'
--     'gift_card'  → SKIP (handled by separate launch surface later)
--
-- Multiple old rows may map to the same (game_id, global_category_id) —
-- e.g. Roblox has both "Items" and "Limiteds" (both type='items'). We
-- merge into one game_categories row and keep the OLDEST one's settings.
-- =====================================================

WITH mapped AS (
  SELECT
    c.game_id,
    gc.id AS global_category_id,
    COALESCE((c.metadata->>'requires_region')::boolean, false)   AS requires_region,
    COALESCE(c.metadata->'available_regions', '[]'::jsonb)       AS available_regions,
    COALESCE((c.metadata->>'requires_platform')::boolean, false) AS requires_platform,
    COALESCE(c.metadata->'available_platforms', '[]'::jsonb)     AS available_platforms,
    -- currency/items types are manual-only; everything else allows both
    CASE
      WHEN c.metadata->>'type' IN ('currency','items') THEN ARRAY['manual']::text[]
      ELSE ARRAY['manual','instant']::text[]
    END AS delivery_modes,
    c.display_order AS sort_order,
    c.created_at AS created_at_rank
  FROM public.categories c
  JOIN public.global_categories gc
    ON gc.slug = CASE c.metadata->>'type'
      WHEN 'currency' THEN 'currency'
      WHEN 'items'    THEN 'items'
      WHEN 'account'  THEN 'accounts'
      WHEN 'top_up'   THEN 'top-up'
      WHEN 'service'  THEN 'boosting'
      ELSE NULL
    END
  WHERE c.game_id IS NOT NULL
    AND c.is_active = true
), deduped AS (
  SELECT DISTINCT ON (game_id, global_category_id)
    game_id, global_category_id,
    requires_region, available_regions,
    requires_platform, available_platforms,
    delivery_modes, sort_order
  FROM mapped
  ORDER BY game_id, global_category_id, created_at_rank ASC
)
INSERT INTO public.game_categories
  (game_id, global_category_id, is_enabled,
   requires_region, available_regions,
   requires_platform, available_platforms,
   delivery_modes, sort_order)
SELECT
  game_id, global_category_id, true,
  requires_region, available_regions,
  requires_platform, available_platforms,
  delivery_modes, sort_order
FROM deduped
ON CONFLICT (game_id, global_category_id) DO NOTHING;

-- =====================================================
-- 10. BACKFILL — attribute_templates / attributes / attribute_options
--                from existing public.listing_templates.fields
-- =====================================================

-- 10a. One attribute_templates row per (game, category) listing_templates row
--      that maps to a known game_categories row.
INSERT INTO public.attribute_templates (game_category_id, name, version, is_active)
SELECT
  gc.id,
  lt.template_name,
  1,
  lt.is_active
FROM public.listing_templates lt
JOIN public.categories c        ON c.id = lt.category_id
JOIN public.global_categories g ON g.slug = CASE c.metadata->>'type'
    WHEN 'currency' THEN 'currency'
    WHEN 'items'    THEN 'items'
    WHEN 'account'  THEN 'accounts'
    WHEN 'top_up'   THEN 'top-up'
    WHEN 'service'  THEN 'boosting'
    ELSE NULL
  END
JOIN public.game_categories gc
  ON gc.game_id = lt.game_id AND gc.global_category_id = g.id
ON CONFLICT (game_category_id) DO NOTHING;

-- Helper: slugify a free-form string into a safe slug.
-- Lowercase, replace non-alnum with '-', collapse repeats, trim '-'.
CREATE OR REPLACE FUNCTION public.tmp_slugify(s text)
RETURNS text AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(s,'')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$ LANGUAGE sql IMMUTABLE;

-- 10b. Walk listing_templates.fields[] → attributes rows.
DO $$
DECLARE
  lt_row   public.listing_templates%ROWTYPE;
  gc_id    uuid;
  tpl_id   uuid;
  field    jsonb;
  attr_id  uuid;
  opt      jsonb;
  field_type text;
  norm_type  text;
  attr_slug  text;
  ord int;
BEGIN
  FOR lt_row IN
    SELECT lt.*
    FROM public.listing_templates lt
    JOIN public.categories c ON c.id = lt.category_id
    WHERE c.metadata->>'type' IN ('currency','items','account','top_up','service')
  LOOP
    -- Resolve game_category_id for this listing_template
    SELECT gc.id INTO gc_id
    FROM public.global_categories g
    JOIN public.game_categories gc
      ON gc.game_id = lt_row.game_id
     AND gc.global_category_id = g.id
    WHERE g.slug = CASE (
        SELECT metadata->>'type' FROM public.categories WHERE id = lt_row.category_id
      )
      WHEN 'currency' THEN 'currency'
      WHEN 'items'    THEN 'items'
      WHEN 'account'  THEN 'accounts'
      WHEN 'top_up'   THEN 'top-up'
      WHEN 'service'  THEN 'boosting'
      ELSE NULL
    END;

    IF gc_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO tpl_id FROM public.attribute_templates WHERE game_category_id = gc_id;
    IF tpl_id IS NULL THEN CONTINUE; END IF;

    -- If we already populated attributes for this template, skip (idempotency).
    IF EXISTS (SELECT 1 FROM public.attributes WHERE template_id = tpl_id) THEN
      CONTINUE;
    END IF;

    ord := 0;
    FOR field IN SELECT jsonb_array_elements(lt_row.fields)
    LOOP
      field_type := field->>'type';
      -- Map old type names to new check-constraint values
      norm_type := CASE field_type
        WHEN 'text'     THEN 'text'
        WHEN 'number'   THEN 'number'
        WHEN 'textarea' THEN 'textarea'
        WHEN 'select'   THEN 'select'
        WHEN 'boolean'  THEN 'boolean'
        ELSE 'text'
      END;

      attr_slug := public.tmp_slugify(coalesce(field->>'name', field->>'label', 'attr-' || ord::text));
      IF attr_slug = '' THEN attr_slug := 'attr-' || ord::text; END IF;

      -- If a slug collision occurs within the same template, append the ordinal.
      IF EXISTS (SELECT 1 FROM public.attributes WHERE template_id = tpl_id AND slug = attr_slug) THEN
        attr_slug := attr_slug || '-' || ord::text;
      END IF;

      INSERT INTO public.attributes
        (template_id, slug, name, type, is_required, placeholder,
         min_value, max_value, max_length, default_value, sort_order)
      VALUES
        (tpl_id,
         attr_slug,
         coalesce(field->>'label', field->>'name', attr_slug),
         norm_type,
         coalesce((field->>'required')::boolean, false),
         field->>'placeholder',
         CASE WHEN field ? 'min' THEN (field->>'min')::numeric ELSE NULL END,
         CASE WHEN field ? 'max' THEN (field->>'max')::numeric ELSE NULL END,
         CASE WHEN field ? 'maxLength' THEN (field->>'maxLength')::int ELSE NULL END,
         field->'defaultValue',
         ord)
      RETURNING id INTO attr_id;

      -- Options for select-type fields
      IF norm_type = 'select' AND field ? 'options' THEN
        DECLARE
          opt_ord int := 0;
          opt_slug text;
        BEGIN
          FOR opt IN SELECT jsonb_array_elements(field->'options')
          LOOP
            opt_slug := public.tmp_slugify(coalesce(opt->>'value', opt->>'label', 'opt-' || opt_ord::text));
            IF opt_slug = '' THEN opt_slug := 'opt-' || opt_ord::text; END IF;
            IF EXISTS (SELECT 1 FROM public.attribute_options WHERE attribute_id = attr_id AND slug = opt_slug) THEN
              opt_slug := opt_slug || '-' || opt_ord::text;
            END IF;

            INSERT INTO public.attribute_options
              (attribute_id, slug, value, label, sort_order)
            VALUES
              (attr_id,
               opt_slug,
               coalesce(opt->>'value', opt_slug),
               coalesce(opt->>'label', opt->>'value', opt_slug),
               opt_ord);
            opt_ord := opt_ord + 1;
          END LOOP;
        END;
      END IF;

      ord := ord + 1;
    END LOOP;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.tmp_slugify(text);

-- =====================================================
-- 11. listings — add template_version_used (additive)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'template_version_used'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN template_version_used int;
    COMMENT ON COLUMN public.listings.template_version_used IS
      'Stamps which attribute_templates.version was active when this listing was created. '
      'NULL for listings created before Phase A or via the old flow.';
  END IF;
END $$;

-- =====================================================
-- 12. NOTICE
-- =====================================================

DO $$
DECLARE
  gc_count int;
  tpl_count int;
  attr_count int;
  opt_count int;
BEGIN
  SELECT COUNT(*) INTO gc_count  FROM public.game_categories;
  SELECT COUNT(*) INTO tpl_count FROM public.attribute_templates;
  SELECT COUNT(*) INTO attr_count FROM public.attributes;
  SELECT COUNT(*) INTO opt_count FROM public.attribute_options;
  RAISE NOTICE 'Phase A migration complete:';
  RAISE NOTICE '  global_categories:  5 rows seeded (Boosting disabled)';
  RAISE NOTICE '  game_categories:    % rows backfilled',  gc_count;
  RAISE NOTICE '  attribute_templates: % rows backfilled', tpl_count;
  RAISE NOTICE '  attributes:         % rows backfilled',  attr_count;
  RAISE NOTICE '  attribute_options:  % rows backfilled',  opt_count;
  RAISE NOTICE 'Existing tables untouched. App reads OLD schema as before.';
END $$;

COMMIT;
