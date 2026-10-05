-- Store banner focal point (2026-10-04, owner request 2026-10-05).
--
-- The public shop header is now a short strip (~212 px at max-w-7xl) cut from
-- the stored 1500 × 400 banner, so the seller chooses WHICH horizontal slice
-- shows: Settings → Seller → Shop Banner lets them drag the image up/down and
-- saves a vertical focal position 0–100. The page renders the banner with
-- `object-position: 50% <y>%` (src/lib/shop/store-banner.ts).
--
--   1. `profiles.banner_focal_y smallint NOT NULL DEFAULT 50`, CHECK 0–100.
--      Existing rows take the default (50 = centred, today's rendering).
--   2. Writes go through the same path as banner_url: the store-banner server
--      action, which checks the session owner + Silver rank + rate limit and
--      writes with the SERVICE ROLE. `validate_banner_update` now also
--      refuses a focal change from a non-trusted writer, and its trigger
--      fires on a focal change too.
--   3. Anon reads it exactly like banner_url: column-scoped SELECT grant on
--      profiles (DLT-001B posture, 20260921151722) and a column on the
--      security_invoker `public_profiles` view (20260921004158). The view is
--      re-created with the SAME column list, the new column appended last
--      (CREATE OR REPLACE VIEW may only add columns at the end).
--
-- ⚠️ PUSH BEFORE THE APP DEPLOY. The new code selects `banner_focal_y` on the
-- shop page and in the banner settings; against a database without the column
-- those selects fail (42703) and /shop/[slug] would 404. Pushing this first is
-- safe for the CURRENT code: nothing it reads changes.
--
-- Additive and idempotent. No data is deleted or rewritten.
--
-- Rollback:
--   CREATE OR REPLACE VIEW can't drop a column: re-run 20260921004158 §2's
--   view body after `DROP VIEW public.public_profiles` (re-grant SELECT to
--   anon, authenticated), restore validate_banner_update + its trigger from
--   20261004194021 §2 / baseline :11446, then
--   ALTER TABLE public.profiles DROP COLUMN banner_focal_y;

-- ── 1. Column ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_focal_y smallint NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass
       AND conname = 'profiles_banner_focal_y_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_banner_focal_y_range CHECK (banner_focal_y BETWEEN 0 AND 100);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.banner_focal_y IS
  'Store banner vertical focal point, 0 (top) – 100 (bottom); rendered as object-position 50% <y>%. Written only by the store-banner server action (service role).';

-- ── 2. Trigger: focal changes are trusted-writer only ──────────────────────
CREATE OR REPLACE FUNCTION public.validate_banner_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
  IF NEW.banner_url IS NOT NULL AND NEW.banner_url IS DISTINCT FROM OLD.banner_url THEN
    IF NOT public.guarded_write_allowed() THEN
      RAISE EXCEPTION 'Store banners can only be set through the banner upload'
        USING ERRCODE = '42501';
    END IF;

    IF NOT COALESCE(
         (SELECT c.banner_access FROM public.seller_tier_config c WHERE c.tier = NEW.seller_tier),
         false) THEN
      RAISE EXCEPTION 'Store banners unlock at Silver rank';
    END IF;
  END IF;

  IF NEW.banner_focal_y IS DISTINCT FROM OLD.banner_focal_y
     AND NOT public.guarded_write_allowed() THEN
    RAISE EXCEPTION 'The banner position can only be set through the banner settings'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_banner_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_banner_update() TO service_role;

-- Same trigger, now also on a focal change (baseline :11446 fired only on
-- banner_url / seller_tier).
DROP TRIGGER IF EXISTS trigger_validate_banner_update ON public.profiles;
CREATE TRIGGER trigger_validate_banner_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.banner_url IS DISTINCT FROM NEW.banner_url
    OR OLD.seller_tier IS DISTINCT FROM NEW.seller_tier
    OR OLD.banner_focal_y IS DISTINCT FROM NEW.banner_focal_y
  )
  EXECUTE FUNCTION public.validate_banner_update();

-- ── 3. Anon reads it like banner_url ───────────────────────────────────────
GRANT SELECT (banner_focal_y) ON public.profiles TO anon;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.bio,
  p.created_at,
  p.business_name,
  p.seller_tier,
  p.seller_rating,
  p.total_reviews,
  p.positive_reviews,
  p.total_sales,
  p.badges,
  p.is_verified,
  p.founding_seller,
  p.is_test,
  p.role,
  p.shop_name,
  p.shop_slug,
  p.shop_banner_url,
  p.shop_banner_position,
  p.shop_primary_color,
  p.shop_secondary_color,
  p.shop_theme,
  p.shop_layout,
  p.banner_url,
  p.banner_preset,
  p.banner_focal_y
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 4. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_invoker boolean;
BEGIN
  IF NOT has_column_privilege('anon', 'public.profiles', 'banner_focal_y', 'SELECT') THEN
    RAISE EXCEPTION 'store_banner_focal_y: anon cannot read profiles.banner_focal_y';
  END IF;
  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT') THEN
    RAISE EXCEPTION 'store_banner_focal_y: anon can read profiles.email (DLT-001 regressed)';
  END IF;

  SELECT COALESCE((SELECT o.option_value IN ('on','true')
                   FROM pg_options_to_table(c.reloptions) o
                   WHERE o.option_name = 'security_invoker'), false)
    INTO v_invoker
    FROM pg_class c
   WHERE c.oid = 'public.public_profiles'::regclass;
  IF NOT v_invoker THEN
    RAISE EXCEPTION 'store_banner_focal_y: public_profiles is not security_invoker';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'public_profiles' AND column_name = 'banner_focal_y'
  ) THEN
    RAISE EXCEPTION 'store_banner_focal_y: public_profiles.banner_focal_y missing';
  END IF;

  IF has_function_privilege('anon', 'public.validate_banner_update()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.validate_banner_update()', 'EXECUTE') THEN
    RAISE EXCEPTION 'store_banner_focal_y: validate_banner_update is executable by a session role';
  END IF;
END $$;
