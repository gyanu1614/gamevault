-- DLT-001 · PART B (THE CLOSE) — revoke anon's access to public.profiles.
--
-- ⚠️ APPLY ONLY AFTER PR #81's CODE IS LIVE IN PRODUCTION.
--
-- This is the migration that actually closes the Critical finding. It is
-- separated from PART A (20260921004158_public_profiles_view.sql) because it
-- is the half that BREAKS the currently-deployed code: every public reader
-- still selecting `profiles` directly starts returning 42501 the moment this
-- lands. Once PR #81 is deployed, all 25 of those call sites read
-- `public_profiles` instead, and this is a no-op for the app.
--
-- Order (see the PR runbook):
--   A → re-run the hub-diff gate on the preview → merge → wait for deploy
--     → B → verify listing page, shop page, and that anon can no longer read
--       profiles with the public anon key.
--
-- Rollback: this file only narrows privileges, so recovery is a single
-- statement if something unexpected surfaces --
--   GRANT SELECT ON TABLE public.profiles TO anon;
--   CREATE POLICY "Public profiles are viewable by everyone"
--     ON public.profiles FOR SELECT USING (true);
-- which restores the pre-DLT-001 posture (and re-opens the hole, so treat it
-- as a break-glass step, not a fix).

-- ── 1. Marker: PART B is applied ───────────────────────────────────────────
-- The guard test probes this to tell "interim state, skip cleanly" from
-- "regressed". PART A's marker (public_profiles_version) says only that the
-- view exists.
CREATE OR REPLACE FUNCTION public.public_profiles_revoked_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.public_profiles_revoked_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles_revoked_version() TO service_role;

-- PART A must be applied first: B without the view would leave the public
-- pages with nothing to read at all.
DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NULL THEN
    RAISE EXCEPTION 'DLT-001B: public.public_profiles does not exist -- apply PART A (20260921004158) first';
  END IF;
END $$;

-- ── 2. Drop the open policy ────────────────────────────────────────────────
-- This is what currently lets ANY caller read EVERY row. PART A already
-- installed the replacements for `authenticated` (own row + is_admin + the
-- public projection), so dropping it here does not strand a signed-in user.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- ── 3. Column-scoped grant for anon ────────────────────────────────────────
-- public_profiles is security_invoker (DB-002 posture), so it reads the base
-- table as the CALLER -- a blanket REVOKE from anon would break the view too.
-- The fix is a column-scoped grant: anon may reference only the public
-- columns, on the table and therefore through the view. Verified on the local
-- stack: `SELECT * FROM public_profiles` succeeds as anon while
-- `SELECT email FROM profiles` fails with 42501. The column list is the
-- enforcement boundary, not just the view's shape -- so even a future view
-- that accidentally selects email cannot serve it to anon.
REVOKE ALL ON TABLE public.profiles FROM anon;

GRANT SELECT (
  id, username, avatar_url, bio, created_at, business_name,
  seller_tier, seller_rating, total_reviews, positive_reviews, total_sales,
  badges, is_verified, founding_seller, is_test, role,
  shop_name, shop_slug, shop_banner_url, shop_banner_position,
  shop_primary_color, shop_secondary_color, shop_theme, shop_layout,
  banner_url, banner_preset
) ON public.profiles TO anon;

-- 3a. anon needs a row policy to match the column grant (RLS is still on).
-- Column safety is the grant above; this only decides which ROWS.
DROP POLICY IF EXISTS profiles_anon_public_read ON public.profiles;
CREATE POLICY profiles_anon_public_read ON public.profiles
  FOR SELECT TO anon
  USING (true);

-- ── 4. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_leaked text;
  v_write  boolean;
  v_open   int;
BEGIN
  -- anon must hold NO column privilege on any sensitive column. This is the
  -- assertion that actually closes DLT-001; enumerated rather than listed so a
  -- column added to profiles later cannot silently become anon-readable.
  SELECT string_agg(a.attname, ', ' ORDER BY a.attname)
    INTO v_leaked
    FROM pg_attribute a
   WHERE a.attrelid = 'public.profiles'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped
     AND a.attname NOT IN (
       'id','username','avatar_url','bio','created_at','business_name',
       'seller_tier','seller_rating','total_reviews','positive_reviews','total_sales',
       'badges','is_verified','founding_seller','is_test','role',
       'shop_name','shop_slug','shop_banner_url','shop_banner_position',
       'shop_primary_color','shop_secondary_color','shop_theme','shop_layout',
       'banner_url','banner_preset')
     AND has_column_privilege('anon', a.attrelid, a.attname, 'SELECT');
  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION 'DLT-001B: anon can still read non-public profiles column(s): %', v_leaked;
  END IF;

  -- anon must hold no write privilege at all.
  SELECT bool_or(has_table_privilege('anon', 'public.profiles', priv))
    INTO v_write
    FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) AS priv;
  IF v_write THEN
    RAISE EXCEPTION 'DLT-001B: anon still holds a write privilege on public.profiles';
  END IF;

  -- anon must still be able to read the view (the public pages depend on it).
  IF NOT has_table_privilege('anon', 'public.public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'DLT-001B: anon cannot read public.public_profiles';
  END IF;

  -- the open policy must be gone.
  SELECT count(*) INTO v_open
    FROM pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Public profiles are viewable by everyone';
  IF v_open > 0 THEN
    RAISE EXCEPTION 'DLT-001B: the open profiles SELECT policy still exists';
  END IF;
END $$;
