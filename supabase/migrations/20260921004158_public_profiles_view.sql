-- DLT-001 (Critical) — profiles must not be readable with the public anon key.
--
-- Baseline 20260101000000:12576 shipped
--   CREATE POLICY "Public profiles are viewable by everyone"
--     ON public.profiles FOR SELECT USING (true);
-- and :14461 GRANT ALL ON TABLE public.profiles TO anon, with no column
-- narrowing anywhere. One unauthenticated GET with the anon key -- which ships
-- in every page's JS bundle -- returned email, paypal_email, seller_balance,
-- pending_balance, lifetime_earnings, kyc_status, stripe_*,
-- seller_restriction_reason and loyalty_balance for every user. Reproduced on
-- the local stack 2026-09-20 (delta audit).
--
-- ── Why anon is revoked but `authenticated` is NOT ─────────────────────────
-- Seven security_invoker views read profiles AS THE CALLER:
--   seller_dashboard_stats, seller_shop_banners, seller_applications_with_users,
--   disputes_with_users, moderation_queue, admin_review_overview,
--   recent_security_events
-- Proven on the local stack: REVOKE ... FROM authenticated makes every one of
-- them fail with "permission denied for table profiles" -- including
-- seller_dashboard_stats, which sellers read from the browser. So the table
-- grant stays for `authenticated` and RLS does the restricting: a signed-in
-- user sees their OWN row (all columns) and admins see everything; nobody
-- reads a stranger's row from the base table. anon loses the table outright
-- and reads public_profiles instead.
--
-- SECURITY DEFINER functions (handle_new_user, update_seller_rating, is_admin,
-- has_permission) bypass RLS, so the signup trigger and the review-rating
-- trigger are unaffected.
--
-- No DROP of any column or table. The legacy policy is replaced, not the data.

-- ── 1. Marker so the guard test can tell "not applied" from "regressed" ────
CREATE OR REPLACE FUNCTION public.public_profiles_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.public_profiles_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles_version() TO service_role;

-- ── 2. public_profiles — the display-only projection ───────────────────────
-- Superset of PUBLIC_SELLER_PROFILE_COLUMNS (AUTH-001, src/lib/shop/public-profile.ts)
-- plus the columns the marketplace//reviews readers select. Every column here
-- is already rendered publicly somewhere in the app.
--
-- is_test is included deliberately: it is not PII but a demo-account flag, and
-- ten public readers filter on it (public-hygiene, category-pairs,
-- indexable-games, both marketplace pages, api/listings, useRecentSales,
-- landingPageInventory, sitemap). Without it every public listing query would
-- start surfacing test accounts.
--
-- role and banner_preset are included because seller_shop_banners projects
-- them; they are non-sensitive (role is already visible as "is this a seller").
--
-- security_invoker so the view carries the CALLER's rights, never the owner's
-- (DB-002 posture, 20260913100000) -- which is why it needs its own policy
-- on the base table, added in step 3.
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

-- ── 3. RLS on the base table ───────────────────────────────────────────────
-- Replace the open policy. TO authenticated only: anon holds no grant after
-- step 4, and a policy naming anon would be misleading.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- 3a. A signed-in user reads their own row in full.
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3b. Admins read every row (the five admin views above are security_invoker
-- and inner-join profiles, so without this they silently return zero rows for
-- an admin session). is_admin() is SECURITY DEFINER, so no recursion.
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
-- what the baseline's "Public profiles are viewable by everyone" already
-- allowed for this role. This migration does not widen that; it closes the
-- ANON half, which is the Critical one because the anon key is public by
-- design and shipped in every JS bundle.
--
-- Closing the authenticated half needs column-scoped grants for
-- `authenticated` too, and Postgres column grants are role-wide -- they cannot
-- distinguish own-row from stranger-row. Verified on the local stack: adding
-- them makes `SELECT email` fail for a user's OWN row, which breaks
-- src/hooks/use-auth.tsx:106 (`select('*')`, the central auth hook), the
-- settings page and the wallet. That refactor -- route own-row full reads
-- through a SECURITY DEFINER `get_my_profile()` RPC, then narrow the
-- `authenticated` column grant -- is tracked as DLT-001b and is a separate
-- change from this hotfix.
DROP POLICY IF EXISTS profiles_public_projection_read ON public.profiles;
CREATE POLICY profiles_public_projection_read ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- ── 4. Grants: COLUMN-level for anon, so Postgres enforces the projection ──
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

-- 4a. anon needs a row policy to match the column grant (RLS is still on).
-- Column safety is the grant above; this only decides which ROWS.
DROP POLICY IF EXISTS profiles_anon_public_read ON public.profiles;
CREATE POLICY profiles_anon_public_read ON public.profiles
  FOR SELECT TO anon
  USING (true);

-- anon reads the view; authenticated keeps full-column table access for its
-- own row (use-auth `select('*')`, settings, wallet) under the policies above.
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 5. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_leaked    text;
  v_write     boolean;
  v_anon_view boolean;
  v_open      int;
  v_invoker   boolean;
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
    RAISE EXCEPTION 'DLT-001: anon can still read non-public profiles column(s): %', v_leaked;
  END IF;

  -- anon must hold no write privilege at all.
  SELECT bool_or(has_table_privilege('anon', 'public.profiles', priv))
    INTO v_write
    FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) AS priv;
  IF v_write THEN
    RAISE EXCEPTION 'DLT-001: anon still holds a write privilege on public.profiles';
  END IF;

  -- anon must be able to read the view.
  SELECT has_table_privilege('anon', 'public.public_profiles', 'SELECT') INTO v_anon_view;
  IF NOT v_anon_view THEN
    RAISE EXCEPTION 'DLT-001: anon cannot read public.public_profiles';
  END IF;

  -- the open policy must be gone.
  SELECT count(*) INTO v_open
    FROM pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Public profiles are viewable by everyone';
  IF v_open > 0 THEN
    RAISE EXCEPTION 'DLT-001: the open profiles SELECT policy still exists';
  END IF;

  -- the view must run as the caller, not the owner.
  SELECT COALESCE((SELECT o.option_value IN ('on','true')
                   FROM pg_options_to_table(c.reloptions) o
                   WHERE o.option_name = 'security_invoker'), false)
    INTO v_invoker
    FROM pg_class c
   WHERE c.oid = 'public.public_profiles'::regclass;
  IF NOT v_invoker THEN
    RAISE EXCEPTION 'DLT-001: public_profiles is not security_invoker';
  END IF;
END $$;
