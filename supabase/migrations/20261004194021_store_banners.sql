-- Store banners for Silver+ sellers (2026-10-04).
--
-- The column already exists: `profiles.banner_url` (baseline), anon-readable
-- through the public_profiles column grant (20260921151722) and already in
-- the storefront allowlist (src/lib/shop/public-profile.ts). This migration:
--
--   1. Opens banners to Silver and Gold: seller_tier_config.banner_access was
--      true only for Diamond/Legendary. The TS mirror (src/lib/seller/tiers.ts
--      `bannerAccess`) is updated in the same PR; /account/tiers shows the perk
--      from this column.
--   2. Rewrites the `validate_banner_update` trigger function so a NEW banner
--      URL is accepted only when
--        a) the writer is trusted (`guarded_write_allowed()`: service role /
--           migration / SQL editor) — the upload server action is the only
--           writer, so a seller cannot point banner_url at an arbitrary URL
--           through PostgREST; and
--        b) the row's CURRENT rank has banner_access in seller_tier_config
--           (was a hard-coded Diamond/Legendary list).
--      Clearing a banner (NULL) stays allowed for the owner. A rank DROP does
--      not touch the stored URL (no destructive cleanup); the page simply does
--      not render it below Silver (src/lib/shop/store-banner.ts).
--   3. `can_upload_custom_banner(uuid)` reads the same config (it is
--      service-role only and not called by the app; kept consistent).
--   4. Creates the PUBLIC bucket `store-banners`: 2.5 MB, JPG/PNG/WebP only.
--      Public read policy only — NO insert/update/delete policy for anon or
--      authenticated, so only the service role (the server action, after its
--      rank check) can write. Objects live at `{userId}/banner.webp`.
--
-- Additive and idempotent. No data is deleted; no existing banner_url is
-- changed. Safe to push before or after the app deploy: before the deploy no
-- code writes banners; after it, uploads fail cleanly until this is pushed
-- (the bucket would be missing).
--
-- Rollback:
--   UPDATE public.seller_tier_config SET banner_access = false WHERE tier IN ('silver','gold');
--   -- and restore validate_banner_update from 20260908110000 §8.

-- ── 1. Banner access from Silver up ────────────────────────────────────────
UPDATE public.seller_tier_config
   SET banner_access = true
 WHERE tier IN ('silver', 'gold', 'diamond', 'legendary');

UPDATE public.seller_tier_config
   SET banner_access = false
 WHERE tier = 'bronze';

-- ── 2. Trigger: trusted writer + current rank's banner_access ─────────────
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

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_banner_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_banner_update() TO service_role;

-- ── 3. Eligibility probe reads the same config ─────────────────────────────
CREATE OR REPLACE FUNCTION public.can_upload_custom_banner(user_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT COALESCE(
    (SELECT c.banner_access
       FROM public.profiles p
       JOIN public.seller_tier_config c ON c.tier = p.seller_tier
      WHERE p.id = user_id_param),
    false);
$$;

REVOKE ALL ON FUNCTION public.can_upload_custom_banner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_custom_banner(uuid) TO service_role;

-- ── 4. Bucket + policy ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-banners', 'store-banners', true, 2621440, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (the banner renders on the public storefront). Writes: none for
-- anon/authenticated — the service role bypasses RLS.
DROP POLICY IF EXISTS store_banners_public_read ON storage.objects;
CREATE POLICY store_banners_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-banners');

-- ── 5. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(tier, ', ' ORDER BY sort_order) INTO v_bad
    FROM public.seller_tier_config
   WHERE (tier = 'bronze' AND banner_access)
      OR (tier IN ('silver', 'gold', 'diamond', 'legendary') AND NOT banner_access);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'store_banners: banner_access wrong for tier(s): %', v_bad;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'store-banners' AND public) THEN
    RAISE EXCEPTION 'store_banners: bucket store-banners missing or not public';
  END IF;

  -- No write policy may name the bucket: writes are service-role only.
  SELECT string_agg(p.polname, ', ') INTO v_bad
    FROM pg_policy p
   WHERE p.polrelid = 'storage.objects'::regclass
     AND p.polcmd <> 'r'
     AND pg_get_expr(COALESCE(p.polqual, p.polwithcheck), p.polrelid) LIKE '%store-banners%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'store_banners: unexpected write policy on store-banners: %', v_bad;
  END IF;

  IF has_function_privilege('authenticated', 'public.can_upload_custom_banner(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.validate_banner_update()', 'EXECUTE') THEN
    RAISE EXCEPTION 'store_banners: banner functions are executable by a session role';
  END IF;
END $$;
