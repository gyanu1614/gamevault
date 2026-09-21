-- DLT-001 · PART A (ADDITIVE ONLY) — create the public_profiles projection.
--
-- SAFE TO APPLY WHILE THE CURRENT PRODUCTION CODE IS RUNNING. Nothing here
-- removes a privilege or a policy: anon keeps the blanket grant and the
-- baseline's "Public profiles are viewable by everyone" policy stays in place
-- until PART B.
--
-- PART B deliberately does NOT live in this directory yet. `supabase db push`
-- applies every pending file in supabase/migrations/ AT ONCE, so a B sitting
-- here would ride along with this push and collapse the split. It waits in
-- supabase/migrations_pending/20260921151722_public_profiles_revoke_anon.sql
-- and ships via PR #82, which moves it here unchanged once PR #81's code is
-- live. See supabase/migrations_pending/README.md.
--
-- Why the split: the code in PR #81 reads `public_profiles`, and the schema
-- change that CLOSES the hole revokes anon's access to `profiles`. Applying
-- both at once couples the migration to the deploy — verified on the preview,
-- where `public_profiles` 404s on prod and the category grid's
-- `public_profiles!inner` embed returns PGRST200, so counts render 0 and
-- listing pages 404. Part A lets the view exist BEFORE the code ships, so the
-- new code works the moment it deploys; Part B then closes the hole with no
-- window in which either side is broken.
--
--   A (this file) → re-run gate → merge → deploy → B → verify
--
-- ⚠️ AFTER APPLYING A, WAIT FOR POSTGREST'S SCHEMA CACHE. A new view is
-- invisible over REST until PostgREST reloads: observed on the local stack,
-- where `GET /rest/v1/public_profiles` returned 404 while
-- `to_regclass('public.public_profiles')` was already non-null. Supabase
-- reloads on its own, but not instantly. Re-running the hub-diff gate before
-- the reload reproduces the exact false failure this split exists to avoid.
-- Confirm with:
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     "$SUPABASE_URL/rest/v1/public_profiles?select=id&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
-- Expect 200. If it is 404, wait and retry (or run: NOTIFY pgrst, 'reload schema';).
--
-- Background (why any of this exists): baseline 20260101000000:12576 shipped
--   CREATE POLICY "Public profiles are viewable by everyone"
--     ON public.profiles FOR SELECT USING (true);
-- and :14461 GRANT ALL ON TABLE public.profiles TO anon, with no column
-- narrowing. One unauthenticated GET with the anon key -- which ships in every
-- page's JS bundle -- returned email, paypal_email, seller_balance,
-- pending_balance, lifetime_earnings, kyc_status, stripe_*,
-- seller_restriction_reason. Reproduced on the local stack 2026-09-20.

-- ── 1. Marker: PART A is applied ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_profiles_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.public_profiles_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles_version() TO service_role;

-- ── 2. public_profiles — the display-only projection ───────────────────────
-- Superset of PUBLIC_SELLER_PROFILE_COLUMNS (AUTH-001, src/lib/shop/public-profile.ts)
-- plus the columns the marketplace and review readers select. Every column
-- here is already rendered publicly somewhere in the app.
--
-- is_test is included on purpose: it is a demo-account flag, not PII, and ten
-- public readers filter on it (public-hygiene, category-pairs,
-- indexable-games, both marketplace pages, api/listings, useRecentSales,
-- landingPageInventory, sitemap). Without it every public listing query would
-- start surfacing test accounts.
--
-- role and banner_preset are included because seller_shop_banners projects
-- them; both are non-sensitive.
--
-- security_invoker so the view carries the CALLER's rights, never the owner's
-- (DB-002 posture, 20260913100000).
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
  p.banner_preset
FROM public.profiles p;

COMMENT ON VIEW public.public_profiles IS
  'DLT-001: the only profiles projection anon may read. Display columns only -- no email, paypal_email, balances, KYC, Stripe ids or restriction state. Adding a column here makes it world-readable; public-profiles.guard.integration.test.ts pins the sensitive set.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 3. Additive RLS for `authenticated` ────────────────────────────────────
-- These are PERMISSIVE policies, so they only ever ADD visibility on top of
-- the baseline's still-present "Public profiles are viewable by everyone".
-- Applying them changes nothing observable today; they become the operative
-- policies the moment PART B drops the open one.
--
-- 3a. A signed-in user reads their own row in full.
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3b. Admins read every row. Five security_invoker admin views inner-join
-- profiles, so without this they would return zero rows for an admin session
-- once the open policy is gone. is_admin() is SECURITY DEFINER, no recursion.
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3c. A signed-in user must still see OTHER sellers' shop cards (listing
-- pages, reviews, checkout, wishlist), and PostgREST evaluates the base
-- table's policies through a security_invoker view.
--
-- SCOPE NOTE (deliberate, not an oversight): this is `USING (true)`, so a
-- signed-in user can still read every column of a stranger's row -- exactly
-- what the baseline already allowed for this role. Neither part widens that;
-- PART B closes the ANON half, which is the Critical one because the anon key
-- is public by design.
--
-- Closing the authenticated half needs column-scoped grants for
-- `authenticated` too, and Postgres column grants are role-wide -- they cannot
-- distinguish own-row from stranger-row. Verified on the local stack: adding
-- them makes `SELECT email` fail for a user's OWN row, which breaks
-- src/hooks/use-auth.tsx:106 (`select('*')`, the central auth hook), the
-- settings page and the wallet. That refactor -- route own-row full reads
-- through a SECURITY DEFINER `get_my_profile()` RPC, then narrow the grant --
-- is tracked as DLT-001b.
DROP POLICY IF EXISTS profiles_public_projection_read ON public.profiles;
CREATE POLICY profiles_public_projection_read ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- ── 4. Proof — PART A did its job, and did NOT close the hole yet ──────────
DO $$
DECLARE
  v_invoker boolean;
  v_open    int;
BEGIN
  -- The view must exist, be readable by anon, and run as the caller.
  IF NOT has_table_privilege('anon', 'public.public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'DLT-001A: anon cannot read public.public_profiles';
  END IF;

  SELECT COALESCE((SELECT o.option_value IN ('on','true')
                   FROM pg_options_to_table(c.reloptions) o
                   WHERE o.option_name = 'security_invoker'), false)
    INTO v_invoker
    FROM pg_class c
   WHERE c.oid = 'public.public_profiles'::regclass;
  IF NOT v_invoker THEN
    RAISE EXCEPTION 'DLT-001A: public_profiles is not security_invoker';
  END IF;

  -- PART A must be NON-BREAKING: the baseline policy is still in place, so
  -- current production code keeps reading profiles exactly as before. If this
  -- fails, someone has already applied PART B and A is being re-run out of
  -- order -- which is harmless, hence a NOTICE rather than an exception.
  SELECT count(*) INTO v_open
    FROM pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Public profiles are viewable by everyone';
  IF v_open = 0 THEN
    RAISE NOTICE 'DLT-001A: the open profiles policy is already gone -- PART B appears to be applied. Nothing to do.';
  END IF;
END $$;
