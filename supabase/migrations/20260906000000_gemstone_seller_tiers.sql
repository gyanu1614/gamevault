-- Gemstone seller tiers — replace `unverified | bronze | silver | gold |
-- platinum | diamond` with a 5-tier gemstone ladder.
--
--   Tier 1  quartz    (was unverified + bronze) — entry tier, 3 listings pre-moderated
--   Tier 2  amethyst  (was silver)
--   Tier 3  ruby      (was gold)
--   Tier 4  sapphire  (was platinum)  — custom banner
--   Tier 5  diamond   (was diamond)   — custom banner
--
-- Every seller is KYC-verified (blue "Verified" badge keyed on is_verified), so
-- there is no "unverified" tier; new sellers start at quartz. Thresholds carry
-- over the previous numbers, remapped. Custom banners move from platinum/diamond
-- to sapphire/diamond. The "first 3 listings manually reviewed" rule moves from
-- unverified to quartz.
--
-- Ordered + idempotent: drop CHECKs → drop default → re-key config → migrate
-- data (profiles + history) → re-add CHECKs (gemstone only) → set default →
-- recreate tier-gated functions + the banner view. Safe to run twice.

begin;

-- ── 0. Quiet the banner trigger while we remap platinum→sapphire ────────────
-- validate_banner_update fires on seller_tier changes and would evaluate the
-- (old) platinum/diamond gate against rows in flight. Disable it for the data
-- migration; the CREATE OR REPLACE below installs the new-gate version.
ALTER TABLE public.profiles DISABLE TRIGGER USER;

-- ── 1. Drop guarding CHECKs so data can move ────────────────────────────────
ALTER TABLE public.profiles           DROP CONSTRAINT IF EXISTS profiles_seller_tier_check;
ALTER TABLE public.seller_tier_history DROP CONSTRAINT IF EXISTS seller_tier_history_previous_tier_check;
ALTER TABLE public.seller_tier_history DROP CONSTRAINT IF EXISTS seller_tier_history_new_tier_check;

-- ── 2. Drop the column default (was 'unverified') during the window ─────────
ALTER TABLE public.profiles ALTER COLUMN seller_tier DROP DEFAULT;

-- ── 3. Re-key seller_tier_config (PK = tier, no seed in baseline) ───────────
-- UPSERT the 5 gemstone rows first, then delete the legacy rows, so nothing
-- reading the config is ever momentarily empty.
INSERT INTO public.seller_tier_config
  (tier, display_name, description, min_sales, min_rating, min_age_days,
   min_completion_rate, commission_rate, listing_limit, banner_access,
   badge_color, sort_order, bulk_daily_cap, auto_approve_single,
   auto_approve_bulk, pre_moderation_listings)
VALUES
  ('quartz',   'Quartz',   'New seller — getting started',        0,   NULL, 0,   NULL, 0.0890, 20,   false, 'zinc',   1, NULL, true,  false, 3),
  ('amethyst', 'Amethyst', 'Established, active seller',           10,  4.0,  30,  90.0, 0.0790, 50,   false, 'violet', 2, NULL, true,  false, 0),
  ('ruby',     'Ruby',     'Trusted, high-energy seller',         50,  4.3,  90,  95.0, 0.0690, 100,  false, 'red',    3, NULL, true,  false, 0),
  ('sapphire', 'Sapphire', 'Top-tier, precision master',          200, 4.6,  180, 97.0, 0.0590, NULL, true,  'blue',   4, 20,   true,  true,  0),
  ('diamond',  'Diamond',  'Elite seller — the ultimate prestige',500, 4.8,  365, 99.0, 0.0490, NULL, true,  'lime',   5, 50,   true,  true,  0)
ON CONFLICT (tier) DO UPDATE SET
  display_name            = EXCLUDED.display_name,
  description             = EXCLUDED.description,
  min_sales               = EXCLUDED.min_sales,
  min_rating              = EXCLUDED.min_rating,
  min_age_days            = EXCLUDED.min_age_days,
  min_completion_rate     = EXCLUDED.min_completion_rate,
  commission_rate         = EXCLUDED.commission_rate,
  listing_limit           = EXCLUDED.listing_limit,
  banner_access           = EXCLUDED.banner_access,
  badge_color             = EXCLUDED.badge_color,
  sort_order              = EXCLUDED.sort_order,
  bulk_daily_cap          = EXCLUDED.bulk_daily_cap,
  auto_approve_single     = EXCLUDED.auto_approve_single,
  auto_approve_bulk       = EXCLUDED.auto_approve_bulk,
  pre_moderation_listings = EXCLUDED.pre_moderation_listings;

DELETE FROM public.seller_tier_config
WHERE tier IN ('unverified', 'bronze', 'silver', 'gold', 'platinum');
-- NB: legacy 'diamond' is NOT deleted — the UPSERT updated that row in place.

-- ── 4. Migrate profiles.seller_tier data ────────────────────────────────────
UPDATE public.profiles SET seller_tier = CASE seller_tier
    WHEN 'unverified' THEN 'quartz'
    WHEN 'bronze'     THEN 'quartz'
    WHEN 'silver'     THEN 'amethyst'
    WHEN 'gold'       THEN 'ruby'
    WHEN 'platinum'   THEN 'sapphire'
    WHEN 'diamond'    THEN 'diamond'
    ELSE 'quartz'  -- NULL / unknown → entry tier
  END
WHERE seller_tier IS NULL
   OR seller_tier NOT IN ('quartz', 'amethyst', 'ruby', 'sapphire', 'diamond');

-- ── 5. Migrate seller_tier_history data (before re-adding its CHECKs) ───────
UPDATE public.seller_tier_history SET previous_tier = CASE previous_tier
    WHEN 'unverified' THEN 'quartz'
    WHEN 'bronze'     THEN 'quartz'
    WHEN 'silver'     THEN 'amethyst'
    WHEN 'gold'       THEN 'ruby'
    WHEN 'platinum'   THEN 'sapphire'
    ELSE previous_tier  -- diamond stays; NULL stays NULL
  END
WHERE previous_tier IN ('unverified', 'bronze', 'silver', 'gold', 'platinum');

UPDATE public.seller_tier_history SET new_tier = CASE new_tier
    WHEN 'unverified' THEN 'quartz'
    WHEN 'bronze'     THEN 'quartz'
    WHEN 'silver'     THEN 'amethyst'
    WHEN 'gold'       THEN 'ruby'
    WHEN 'platinum'   THEN 'sapphire'
    ELSE new_tier  -- diamond stays
  END
WHERE new_tier IN ('unverified', 'bronze', 'silver', 'gold', 'platinum');

-- ── 6. Re-add CHECKs with gemstone values only ──────────────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_seller_tier_check
  CHECK (seller_tier = ANY (ARRAY['quartz','amethyst','ruby','sapphire','diamond']));

ALTER TABLE public.seller_tier_history
  ADD CONSTRAINT seller_tier_history_previous_tier_check
  CHECK (previous_tier IS NULL OR previous_tier = ANY (ARRAY['quartz','amethyst','ruby','sapphire','diamond']));
ALTER TABLE public.seller_tier_history
  ADD CONSTRAINT seller_tier_history_new_tier_check
  CHECK (new_tier = ANY (ARRAY['quartz','amethyst','ruby','sapphire','diamond']));

-- ── 7. Re-set the column default to the entry tier ──────────────────────────
ALTER TABLE public.profiles ALTER COLUMN seller_tier SET DEFAULT 'quartz';

-- ── 8. Recreate tier-gated functions (only tier literals changed) ───────────

-- 8a. Promotion eligibility — default 'unverified' → 'quartz'.
CREATE OR REPLACE FUNCTION "public"."check_seller_tier_eligibility"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_profile          RECORD;
  v_total_sales      INTEGER;
  v_completion_rate  NUMERIC;
  v_account_age_days INTEGER;
  v_tier_config      RECORD;
  v_best_tier        TEXT := 'quartz';
BEGIN
  SELECT seller_rating, seller_tier, created_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'quartz';
  END IF;

  SELECT COUNT(*) INTO v_total_sales
  FROM public.orders
  WHERE seller_id = p_user_id AND status = 'completed';

  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 100.0
      ELSE (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
    END
  INTO v_completion_rate
  FROM public.orders
  WHERE seller_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded');

  v_account_age_days := EXTRACT(DAY FROM NOW() - v_profile.created_at)::INTEGER;

  FOR v_tier_config IN
    SELECT * FROM public.seller_tier_config ORDER BY sort_order DESC
  LOOP
    IF v_total_sales >= v_tier_config.min_sales
      AND (v_tier_config.min_rating IS NULL
           OR COALESCE(v_profile.seller_rating, 0) >= v_tier_config.min_rating)
      AND v_account_age_days >= v_tier_config.min_age_days
      AND (v_tier_config.min_completion_rate IS NULL
           OR v_completion_rate >= v_tier_config.min_completion_rate)
    THEN
      v_best_tier := v_tier_config.tier;
      EXIT;
    END IF;
  END LOOP;

  RETURN v_best_tier;
END;
$$;

-- 8b. Pre-moderation gate — default 'unverified' → 'quartz'; fallback 5 → 3.
CREATE OR REPLACE FUNCTION "public"."check_seller_needs_moderation"("seller_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier                  TEXT;
  v_pre_moderation_count  INTEGER;
  v_approved_count        INTEGER;
BEGIN
  SELECT seller_tier INTO v_tier
  FROM public.profiles
  WHERE id = seller_id;

  IF v_tier IS NULL THEN v_tier := 'quartz'; END IF;

  SELECT pre_moderation_listings INTO v_pre_moderation_count
  FROM public.seller_tier_config
  WHERE tier = v_tier;

  -- Unknown tier ⇒ behave like the entry tier (quartz = 3).
  IF v_pre_moderation_count IS NULL THEN v_pre_moderation_count := 3; END IF;
  IF v_pre_moderation_count = 0 THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_approved_count
  FROM public.listings
  WHERE listings.seller_id = check_seller_needs_moderation.seller_id
    AND listings.status IN ('active', 'sold', 'archived')
    AND listings.approved_at IS NOT NULL;

  RETURN v_approved_count < v_pre_moderation_count;
END;
$$;

-- 8c. Publish policy — two 'unverified' fallbacks → 'quartz'.
CREATE OR REPLACE FUNCTION "public"."get_seller_publish_policy"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier               TEXT;
  v_is_verified        BOOLEAN;
  v_listing_limit      INTEGER;
  v_bulk_daily_cap     INTEGER;
  v_auto_single        BOOLEAN;
  v_auto_bulk          BOOLEAN;
  v_pre_mod            INTEGER;
  v_active_count       INTEGER;
  v_approved_count     INTEGER;
  v_bulk_today_count   INTEGER;
BEGIN
  SELECT COALESCE(seller_tier, 'quartz'), COALESCE(is_verified, FALSE)
  INTO v_tier, v_is_verified
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'quartz';
    v_is_verified := FALSE;
  END IF;

  SELECT listing_limit, bulk_daily_cap, auto_approve_single,
         auto_approve_bulk, pre_moderation_listings
  INTO v_listing_limit, v_bulk_daily_cap, v_auto_single,
       v_auto_bulk, v_pre_mod
  FROM public.seller_tier_config
  WHERE tier = v_tier;

  SELECT COUNT(*) INTO v_active_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND status = 'active';

  SELECT COUNT(*) INTO v_approved_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND status IN ('active', 'sold', 'archived')
    AND approved_at IS NOT NULL;

  SELECT COUNT(*) INTO v_bulk_today_count
  FROM public.listings
  WHERE seller_id = p_user_id
    AND created_at >= NOW() - INTERVAL '24 hours'
    AND (metadata->>'source') = 'bulk';

  RETURN jsonb_build_object(
    'tier',                   v_tier,
    'is_verified',            v_is_verified,
    'listing_limit',          v_listing_limit,
    'active_count',           v_active_count,
    'bulk_daily_cap',         v_bulk_daily_cap,
    'bulk_today_count',       v_bulk_today_count,
    'auto_approve_single',    COALESCE(v_auto_single, FALSE),
    'auto_approve_bulk',      COALESCE(v_auto_bulk, FALSE),
    'approved_listings',      v_approved_count,
    'pre_moderation_listings', COALESCE(v_pre_mod, 0),
    'needs_moderation',       (
      COALESCE(v_pre_mod, 0) > 0
      AND v_approved_count < COALESCE(v_pre_mod, 0)
    ),
    'at_listing_limit', (
      v_listing_limit IS NOT NULL
      AND v_active_count >= v_listing_limit
    )
  );
END;
$$;

-- 8d. Tier info — COALESCE default 'unverified' → 'quartz'.
CREATE OR REPLACE FUNCTION "public"."get_seller_tier_info"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_tier TEXT;
  v_eligible_tier TEXT;
  v_current_config RECORD;
  v_next_config RECORD;
BEGIN
  SELECT seller_tier INTO v_current_tier FROM public.profiles WHERE id = p_user_id;
  v_current_tier := COALESCE(v_current_tier, 'quartz');
  v_eligible_tier := check_seller_tier_eligibility(p_user_id);

  SELECT * INTO v_current_config FROM public.seller_tier_config WHERE tier = v_current_tier;
  SELECT * INTO v_next_config
  FROM public.seller_tier_config
  WHERE sort_order = v_current_config.sort_order + 1;

  RETURN json_build_object(
    'current_tier', v_current_tier,
    'eligible_tier', v_eligible_tier,
    'commission_rate', v_current_config.commission_rate,
    'listing_limit', v_current_config.listing_limit,
    'banner_access', v_current_config.banner_access,
    'next_tier', CASE WHEN v_next_config IS NOT NULL THEN v_next_config.tier ELSE NULL END,
    'next_commission_rate', CASE WHEN v_next_config IS NOT NULL THEN v_next_config.commission_rate ELSE NULL END,
    'next_min_sales', CASE WHEN v_next_config IS NOT NULL THEN v_next_config.min_sales ELSE NULL END,
    'next_min_rating', CASE WHEN v_next_config IS NOT NULL THEN v_next_config.min_rating ELSE NULL END
  );
END;
$$;

-- 8e. Daily upgrade cron — COALESCE default 'unverified' → 'quartz'.
CREATE OR REPLACE FUNCTION "public"."upgrade_all_seller_tiers"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_seller        RECORD;
  v_new_tier      TEXT;
  v_current_order INTEGER;
  v_new_order     INTEGER;
  v_count         INTEGER := 0;
BEGIN
  FOR v_seller IN
    SELECT id, seller_tier FROM public.profiles WHERE is_seller = true
  LOOP
    v_new_tier := check_seller_tier_eligibility(v_seller.id);

    SELECT COALESCE(sort_order, 0) INTO v_current_order
    FROM public.seller_tier_config
    WHERE tier = COALESCE(v_seller.seller_tier, 'quartz');

    SELECT COALESCE(sort_order, 0) INTO v_new_order
    FROM public.seller_tier_config
    WHERE tier = v_new_tier;

    IF v_new_order > v_current_order THEN
      UPDATE public.profiles SET seller_tier = v_new_tier WHERE id = v_seller.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 8f. Banner eligibility — platinum/diamond → sapphire/diamond.
CREATE OR REPLACE FUNCTION "public"."can_upload_custom_banner"("user_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT seller_tier INTO user_tier
  FROM profiles
  WHERE id = user_id_param;

  IF user_tier IS NULL THEN
    RETURN false;
  END IF;

  RETURN user_tier IN ('sapphire', 'diamond');
END;
$$;

-- 8g. Banner update trigger — platinum/diamond → sapphire/diamond.
CREATE OR REPLACE FUNCTION "public"."validate_banner_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.banner_url IS NOT NULL AND
     NEW.banner_url IS DISTINCT FROM OLD.banner_url AND
     NEW.seller_tier NOT IN ('sapphire', 'diamond') THEN
    RAISE EXCEPTION 'Custom banners are only available for Sapphire and Diamond sellers';
  END IF;

  IF OLD.seller_tier IN ('sapphire', 'diamond') AND
     NEW.seller_tier NOT IN ('sapphire', 'diamond') THEN
    NEW.banner_url := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 8h. Resolved banner — platinum/diamond → sapphire/diamond.
CREATE OR REPLACE FUNCTION "public"."get_user_banner"("user_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_profile RECORD;
  preset_data RECORD;
BEGIN
  SELECT banner_url, banner_preset, seller_tier
  INTO user_profile
  FROM profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF user_profile.banner_url IS NOT NULL AND
     user_profile.seller_tier IN ('sapphire', 'diamond') THEN
    RETURN jsonb_build_object(
      'type', 'custom',
      'url', user_profile.banner_url,
      'tier', user_profile.seller_tier
    );
  END IF;

  SELECT * INTO preset_data
  FROM banner_presets
  WHERE id = COALESCE(user_profile.banner_preset, 'gaming-purple');

  IF NOT FOUND THEN
    SELECT * INTO preset_data
    FROM banner_presets
    WHERE id = 'gaming-purple';
  END IF;

  RETURN jsonb_build_object(
    'type', 'preset',
    'id', preset_data.id,
    'name', preset_data.name,
    'gradientFrom', preset_data.gradient_from,
    'gradientTo', preset_data.gradient_to,
    'gradientDirection', preset_data.gradient_direction,
    'tier', user_profile.seller_tier
  );
END;
$$;

-- ── 9. Recreate the seller_shop_banners VIEW banner gate ────────────────────
-- Plain view (not materialized). Only the tier gate changes; the rest of the
-- projection is preserved verbatim from the baseline.
CREATE OR REPLACE VIEW "public"."seller_shop_banners" AS
 SELECT "p"."id" AS "seller_id",
    "p"."username",
    "p"."shop_name",
    "p"."avatar_url",
    "p"."seller_tier",
    "p"."seller_rating",
    "p"."total_sales",
    COALESCE("sp"."is_online", false) AS "is_online",
        CASE
            WHEN (("p"."banner_url" IS NOT NULL) AND ("p"."seller_tier" = ANY (ARRAY['sapphire'::"text", 'diamond'::"text"]))) THEN "jsonb_build_object"('type', 'custom', 'url', "p"."banner_url")
            ELSE ( SELECT "jsonb_build_object"('type', 'preset', 'id', "bp"."id", 'name', "bp"."name", 'gradientFrom', "bp"."gradient_from", 'gradientTo', "bp"."gradient_to", 'gradientDirection', "bp"."gradient_direction") AS "jsonb_build_object"
               FROM "public"."banner_presets" "bp"
              WHERE ("bp"."id" = COALESCE("p"."banner_preset", 'gaming-purple'::"text")))
        END AS "banner_config",
    ( SELECT "count"(*) AS "count"
           FROM "public"."listings"
          WHERE (("listings"."seller_id" = "p"."id") AND ("listings"."status" = 'active'::"text"))) AS "active_listings_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."reviews"
          WHERE (("reviews"."seller_id" = "p"."id") AND ("reviews"."is_visible" = true))) AS "reviews_count"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."seller_presence" "sp" ON (("sp"."seller_id" = "p"."id")))
  WHERE ("p"."role" = 'seller'::"text");

-- ── 10. Re-enable triggers ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE TRIGGER USER;

commit;
