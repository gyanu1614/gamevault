-- Phase 1 · Step 1b — Unify the two category systems. PHASE B (contract). DRAFT.
--
-- *** NOT A LIVE MIGRATION. ***  This file lives in supabase/migrations_draft/
-- on purpose: the CLI only applies supabase/migrations/. To ship it (a later
-- step, after production has run Phase A clean for at least one week):
--   1. copy to supabase/migrations/$(date +%Y%m%d%H%M%S)_categories_unify_phase_b.sql
--   2. run the precondition query below read-only on prod — every counter 0
--   3. land the code change that stops writing listings.category_id anywhere
--      (grep: category_id on listings inserts/updates, throwaway.ts fixture)
--      and removes the `categories` reads left for rollback, THEN apply.
--
-- Everything Phase A designed is finishable here; nothing below needs a
-- schema Phase A did not create.

-- ─── 0. Precondition — refuse unless Phase A has run clean ───────────────────
DO $$
DECLARE
  v_unmatched int; v_game int; v_type int; v_slug int; v_legacy_unmapped int; v_pairs_unmapped int;
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RAISE NOTICE 'phase B already applied (public.categories gone) — nothing to do';
    RETURN;
  END IF;
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
  IF v_unmatched > 0 OR v_game > 0 OR v_type > 0 OR v_slug > 0 OR v_legacy_unmapped > 0 OR v_pairs_unmapped > 0 THEN
    RAISE EXCEPTION 'phase B precondition failed (unmatched=% game=% type=% slug=% legacy_unmapped=% pairs_unmapped=%) — do not contract',
      v_unmatched, v_game, v_type, v_slug, v_legacy_unmapped, v_pairs_unmapped;
  END IF;
  RAISE NOTICE 'phase B precondition ok';
END $$;

-- ─── 1. Drop the Phase-A sync triggers (both of them) ────────────────────────
DROP TRIGGER IF EXISTS trg_listings_category_sync ON public.listings;
DROP FUNCTION IF EXISTS public.listings_category_sync();
DROP TRIGGER IF EXISTS trg_game_categories_mirror_legacy ON public.game_categories;
DROP FUNCTION IF EXISTS public.game_categories_mirror_legacy();

-- ─── 2. listings.game_category_id becomes the FK ─────────────────────────────
ALTER TABLE public.listings ALTER COLUMN game_category_id SET NOT NULL;

-- ─── 3. moderation_queue — re-point at game_categories ───────────────────────
-- CREATE OR REPLACE VIEW cannot remove the category_id column, so drop +
-- create, then restore the db_p0 posture (security_invoker, no anon).
DROP VIEW IF EXISTS public.moderation_queue;
CREATE VIEW public.moderation_queue WITH (security_invoker = true) AS
 SELECT l.id, l.seller_id, l.game_id, l.game_category_id, l.title, l.description, l.price, l.original_price,
        l.quantity, l.min_quantity, l.delivery_method, l.delivery_time, l.delivery_method_type, l.images,
        l.template_data, l.region, l.platform, l.status, l.currency, l.views, l.sales, l.created_at, l.updated_at,
        l.approved_at, l.approved_by, l.rejection_reason,
        p.username AS seller_username, p.email AS seller_email, p.seller_tier,
        p.total_sales AS seller_total_sales, p.seller_rating,
        g.name AS game_name, g.slug AS game_slug,
        gc.name AS category_name, gc.slug AS category_slug,
        ( SELECT count(*) FROM public.listings l2
           WHERE l2.seller_id = l.seller_id
             AND l2.status = ANY (ARRAY['active'::text, 'sold'::text, 'archived'::text])
             AND l2.approved_at IS NOT NULL) AS seller_approved_listings_count
   FROM public.listings l
   JOIN public.profiles p ON l.seller_id = p.id
   JOIN public.games g ON l.game_id = g.id
   JOIN public.game_categories gc ON l.game_category_id = gc.id
  WHERE l.status = 'pending_approval'::text
  ORDER BY l.created_at;
ALTER VIEW public.moderation_queue OWNER TO postgres;
REVOKE ALL ON public.moderation_queue FROM PUBLIC, anon;
GRANT SELECT ON public.moderation_queue TO authenticated, service_role;

-- ─── 4. Dead legacy functions (types-only, no callers since before Step 1b) ──
DROP FUNCTION IF EXISTS public.category_requires_platform(uuid);
DROP FUNCTION IF EXISTS public.category_requires_region(uuid);
DROP FUNCTION IF EXISTS public.get_category_icon(uuid);
DROP FUNCTION IF EXISTS public.get_category_platforms(uuid);
DROP FUNCTION IF EXISTS public.get_category_regions(uuid);
DROP FUNCTION IF EXISTS public.get_game_categories(uuid);

-- ─── 5. Dead table — replaced by attribute_templates; 0 rows on prod ─────────
DROP TABLE IF EXISTS public.listing_templates;

-- ─── 6. Contract listings ────────────────────────────────────────────────────
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_category_id_fkey;
ALTER TABLE public.listings DROP COLUMN IF EXISTS category_id;

-- ─── 7. Contract game_categories ─────────────────────────────────────────────
ALTER TABLE public.game_categories DROP CONSTRAINT IF EXISTS game_categories_legacy_category_id_key;
ALTER TABLE public.game_categories DROP COLUMN IF EXISTS legacy_category_id;

-- ─── 8. Retire the legacy table ──────────────────────────────────────────────
DROP TABLE IF EXISTS public.categories;

-- After applying: `pnpm db:types`, delete the rollback note in
-- src/lib/categories/README (if still present), and re-run every guard file.
