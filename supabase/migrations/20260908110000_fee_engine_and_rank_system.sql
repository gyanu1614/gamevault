-- Fee engine + volume-based rank system (approved 2026-09-08).
--
-- 1) DB-driven fee config, editable from admin:
--      category_fee_config   base % per category (+ whether rank discount applies)
--      game_fee_overrides    per-game per-category % (replaces the base)
--      fee_config_audit      who changed what, when
--    Effective seller fee = (game override ?? category base)
--                           × rank fee_multiplier   (skipped where rank_discount=false)
--                           − founding discount     (existing programme, in lib/fees)
--    A per-seller admin override (profiles.fee_override_pct, with expiry) replaces
--    all of the above. Fees are snapshotted on each order at purchase time
--    (orders.platform_fee_rate — already stored), so edits never act retroactively.
--
-- 2) Ranks (bronze→legendary) become TRAILING-90-DAY volume ranks:
--      upgrade  = instant (daily cron), all criteria met in the window
--      demote   = 2 consecutive monthly strikes → reset to highest qualifying rank
--    Criteria per rank: counted GMV (single-buyer capped at 30%), completed orders,
--    % positive reviews (reviews.is_positive, no-reviews passes), completion rate.
--    Account age is no longer a criterion. Listing caps removed; bulk open to all.
--
-- Runs AFTER 20260908100000_metal_rank_tiers (assumes bronze..legendary keys).
--
-- ⚠️ ACL note (Supabase footgun): new FUNCTIONS are public-executable by
-- default — apply_rank_strikes gets an explicit REVOKE below. New TABLES are
-- RLS'd: fee tables are world-readable (fees are public information), writable
-- only via service role; the audit table is service-role only.

begin;

-- ── 1. Fee config tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.category_fee_config (
  category      text PRIMARY KEY
                CHECK (category IN ('currency', 'items', 'accounts', 'top-up')),
  base_pct      numeric(5,2) NOT NULL CHECK (base_pct >= 0 AND base_pct <= 50),
  -- Whether the seller-rank fee_multiplier applies to this category.
  rank_discount boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES public.profiles(id)
);

INSERT INTO public.category_fee_config (category, base_pct, rank_discount) VALUES
  ('currency', 10.00, true),
  ('items',    10.00, true),
  ('accounts', 15.00, true),
  ('top-up',    5.00, false)   -- thin-margin commodity: flat for every rank
ON CONFLICT (category) DO NOTHING;  -- never clobber admin-tuned values on rerun

CREATE TABLE IF NOT EXISTS public.game_fee_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug  text NOT NULL,
  category   text NOT NULL REFERENCES public.category_fee_config(category),
  pct        numeric(5,2) NOT NULL CHECK (pct >= 0 AND pct <= 50),
  note       text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  UNIQUE (game_slug, category)
);

-- Carry over the old high-risk account band (lib/fees ACCOUNT_RISK_BANDS).
INSERT INTO public.game_fee_overrides (game_slug, category, pct, note) VALUES
  ('gta-v',  'accounts', 20.00, 'High-risk account game (ex risk-band high)'),
  ('gta-6',  'accounts', 20.00, 'High-risk account game (ex risk-band high)'),
  ('gtavi',  'accounts', 20.00, 'High-risk account game (ex risk-band high)')
ON CONFLICT (game_slug, category) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fee_config_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor      uuid REFERENCES public.profiles(id),
  scope      text NOT NULL,   -- 'category' | 'game_override' | 'rank_multiplier' | 'seller_override'
  key        text NOT NULL,   -- e.g. 'items', 'gta-v/accounts', 'gold', seller uuid
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: fee tables are public info (quoted on the sell wizard + future /seller-fees
-- page); audit is admin/service only. Writes everywhere go through the service
-- role (admin server actions) — no write policies on purpose.
ALTER TABLE public.category_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_fee_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_config_audit    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_fee_config_read_all" ON public.category_fee_config;
CREATE POLICY "category_fee_config_read_all" ON public.category_fee_config
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "game_fee_overrides_read_all" ON public.game_fee_overrides;
CREATE POLICY "game_fee_overrides_read_all" ON public.game_fee_overrides
  FOR SELECT USING (true);
-- fee_config_audit: no policies → service role only.

-- ── 2. Rank config: multipliers + 90-day thresholds ─────────────────────────

ALTER TABLE public.seller_tier_config
  ADD COLUMN IF NOT EXISTS fee_multiplier      numeric(4,2) NOT NULL DEFAULT 1.00
    CHECK (fee_multiplier > 0 AND fee_multiplier <= 1),
  ADD COLUMN IF NOT EXISTS gmv_90d_min         numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_90d_min      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_rating_min numeric(5,2);  -- % positive; NULL = no bar

UPDATE public.seller_tier_config AS c SET
  fee_multiplier      = v.mult,
  gmv_90d_min         = v.gmv,
  orders_90d_min      = v.ord,
  positive_rating_min = v.pos,
  min_completion_rate = v.compl,
  -- Effective items/currency rate (10% base × multiplier) — display continuity
  -- for surfaces still reading commission_rate.
  commission_rate     = v.rate,
  -- Legacy lifetime criteria are dead: zero them so nothing re-trips on them.
  min_sales           = 0,
  min_rating          = NULL,
  min_age_days        = 0,
  -- Rank no longer gates listings: no caps, bulk open to every rank.
  listing_limit       = NULL,
  bulk_daily_cap      = 50,
  auto_approve_single = true,
  auto_approve_bulk   = true
FROM (VALUES
  ('bronze',    1.00::numeric,     0::numeric,   0, NULL::numeric, NULL::numeric, 0.1000::numeric),
  ('silver',    0.95,            450,            5, 90.0,          90.0,          0.0950),
  ('gold',      0.90,           2000,           20, 93.0,          95.0,          0.0900),
  ('diamond',   0.85,           7500,           50, 96.0,          97.0,          0.0850),
  ('legendary', 0.80,          20000,          100, 98.0,          98.0,          0.0800)
) AS v(tier, mult, gmv, ord, pos, compl, rate)
WHERE c.tier = v.tier;

-- ── 3. Seller-level rank/fee state ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_strikes            integer NOT NULL DEFAULT 0,
  -- Admin rank pin: cron never promotes/demotes a pinned seller.
  ADD COLUMN IF NOT EXISTS tier_pinned             boolean NOT NULL DEFAULT false,
  -- Admin per-seller fee override (concierge deals): replaces every other fee
  -- rule while unexpired. NULL expiry = no expiry.
  ADD COLUMN IF NOT EXISTS fee_override_pct        numeric(5,2)
    CHECK (fee_override_pct IS NULL OR (fee_override_pct >= 0 AND fee_override_pct <= 50)),
  ADD COLUMN IF NOT EXISTS fee_override_expires_at timestamptz;

-- ── 4. Trailing-90-day eligibility ──────────────────────────────────────────
-- Replaces the lifetime-stats version. Window facts:
--   counted GMV  = Σ completed-order subtotals, each buyer capped at 30% of the
--                  raw total (anti wash-trading); currency treated at parity
--                  (EUR≈USD launch approximation — revisit with real fx).
--   orders       = completed orders in the window.
--   % positive   = visible reviews in the window with is_positive; none ⇒ pass.
--   completion   = completed ÷ (non-cancelled/refunded) orders in the window.
CREATE OR REPLACE FUNCTION "public"."check_seller_tier_eligibility"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_gmv_counted     NUMERIC := 0;
  v_orders          INTEGER := 0;
  v_completion_rate NUMERIC := 100.0;
  v_positive_pct    NUMERIC := NULL;  -- NULL = no reviews in window ⇒ passes
  v_review_count    INTEGER := 0;
  v_tier_config     RECORD;
  v_best_tier       TEXT := 'bronze';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'bronze';
  END IF;

  -- Window GMV + order count, single-buyer capped at 30% of raw GMV.
  WITH by_buyer AS (
    SELECT buyer_id, SUM(COALESCE(subtotal, 0)) AS gmv, COUNT(*) AS cnt
    FROM public.orders
    WHERE seller_id = p_user_id
      AND status = 'completed'
      AND COALESCE(completed_at, created_at) >= NOW() - INTERVAL '90 days'
    GROUP BY buyer_id
  ), totals AS (
    SELECT COALESCE(SUM(gmv), 0) AS raw_gmv, COALESCE(SUM(cnt), 0) AS orders
    FROM by_buyer
  )
  SELECT
    t.orders,
    COALESCE((SELECT SUM(LEAST(b.gmv, 0.30 * t.raw_gmv)) FROM by_buyer b), 0)
  INTO v_orders, v_gmv_counted
  FROM totals t;

  -- Window completion rate (same semantics as before, but windowed).
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 100.0
      ELSE (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
    END
  INTO v_completion_rate
  FROM public.orders
  WHERE seller_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded')
    AND created_at >= NOW() - INTERVAL '90 days';

  -- Window % positive (reviews.is_positive = rating >= 4, auto-set).
  SELECT COUNT(*),
         CASE WHEN COUNT(*) = 0 THEN NULL
              ELSE (COUNT(*) FILTER (WHERE is_positive) * 100.0 / COUNT(*)) END
  INTO v_review_count, v_positive_pct
  FROM public.reviews
  WHERE seller_id = p_user_id
    AND is_visible = true
    AND created_at >= NOW() - INTERVAL '90 days';

  FOR v_tier_config IN
    SELECT * FROM public.seller_tier_config ORDER BY sort_order DESC
  LOOP
    IF v_gmv_counted >= COALESCE(v_tier_config.gmv_90d_min, 0)
      AND v_orders >= COALESCE(v_tier_config.orders_90d_min, 0)
      AND (v_tier_config.positive_rating_min IS NULL
           OR v_review_count = 0
           OR v_positive_pct >= v_tier_config.positive_rating_min)
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

-- ── 5. Daily promote-only cron (now strike-aware, pin-aware) ────────────────
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
    SELECT id, seller_tier FROM public.profiles
    WHERE is_seller = true AND tier_pinned = false
  LOOP
    v_new_tier := check_seller_tier_eligibility(v_seller.id);

    SELECT COALESCE(sort_order, 0) INTO v_current_order
    FROM public.seller_tier_config
    WHERE tier = COALESCE(v_seller.seller_tier, 'bronze');

    SELECT COALESCE(sort_order, 0) INTO v_new_order
    FROM public.seller_tier_config
    WHERE tier = v_new_tier;

    IF v_new_order > v_current_order THEN
      UPDATE public.profiles
      SET seller_tier = v_new_tier, tier_strikes = 0
      WHERE id = v_seller.id;

      INSERT INTO public.seller_tier_history (user_id, previous_tier, new_tier, reason)
      VALUES (v_seller.id, v_seller.seller_tier, v_new_tier, 'auto_upgrade_90d_window');

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 6. Monthly strike check (NEW function → explicit REVOKE below) ──────────
-- Run on the 1st of each month. A seller whose trailing-90d numbers no longer
-- support their rank gets a strike; the second consecutive strike resets them
-- to the highest rank they currently qualify for. Any passing month clears
-- strikes. Pinned sellers are skipped.
CREATE OR REPLACE FUNCTION "public"."apply_rank_strikes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_seller        RECORD;
  v_eligible      TEXT;
  v_current_order INTEGER;
  v_elig_order    INTEGER;
  v_demoted       INTEGER := 0;
BEGIN
  FOR v_seller IN
    SELECT id, seller_tier, tier_strikes FROM public.profiles
    WHERE is_seller = true AND tier_pinned = false
  LOOP
    v_eligible := check_seller_tier_eligibility(v_seller.id);

    SELECT COALESCE(sort_order, 0) INTO v_current_order
    FROM public.seller_tier_config
    WHERE tier = COALESCE(v_seller.seller_tier, 'bronze');

    SELECT COALESCE(sort_order, 0) INTO v_elig_order
    FROM public.seller_tier_config
    WHERE tier = v_eligible;

    IF v_elig_order < v_current_order THEN
      IF v_seller.tier_strikes + 1 >= 2 THEN
        UPDATE public.profiles
        SET seller_tier = v_eligible, tier_strikes = 0
        WHERE id = v_seller.id;

        INSERT INTO public.seller_tier_history (user_id, previous_tier, new_tier, reason)
        VALUES (v_seller.id, v_seller.seller_tier, v_eligible, 'strike_demotion_90d_window');

        v_demoted := v_demoted + 1;
      ELSE
        UPDATE public.profiles
        SET tier_strikes = v_seller.tier_strikes + 1
        WHERE id = v_seller.id;
      END IF;
    ELSIF v_seller.tier_strikes > 0 THEN
      UPDATE public.profiles SET tier_strikes = 0 WHERE id = v_seller.id;
    END IF;
  END LOOP;

  RETURN v_demoted;
END;
$$;

-- NEW function: service-role only (cron route). Without this REVOKE any anon
-- user could demote every seller on the platform.
REVOKE ALL ON FUNCTION public.apply_rank_strikes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rank_strikes() FROM anon;
REVOKE ALL ON FUNCTION public.apply_rank_strikes() FROM authenticated;

-- ── 7. Tier info for /account/tiers: window stats + new thresholds ──────────
CREATE OR REPLACE FUNCTION "public"."get_seller_tier_info"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_tier    TEXT;
  v_strikes         INTEGER := 0;
  v_eligible_tier   TEXT;
  v_current_config  RECORD;
  v_next_config     RECORD;
  v_gmv_counted     NUMERIC := 0;
  v_orders          INTEGER := 0;
  v_completion_rate NUMERIC := 100.0;
  v_positive_pct    NUMERIC := NULL;
BEGIN
  SELECT seller_tier, tier_strikes INTO v_current_tier, v_strikes
  FROM public.profiles WHERE id = p_user_id;
  v_current_tier := COALESCE(v_current_tier, 'bronze');
  v_eligible_tier := check_seller_tier_eligibility(p_user_id);

  SELECT * INTO v_current_config FROM public.seller_tier_config WHERE tier = v_current_tier;
  SELECT * INTO v_next_config
  FROM public.seller_tier_config
  WHERE sort_order = v_current_config.sort_order + 1;

  -- Same window facts the eligibility check uses (kept in sync with it).
  WITH by_buyer AS (
    SELECT buyer_id, SUM(COALESCE(subtotal, 0)) AS gmv, COUNT(*) AS cnt
    FROM public.orders
    WHERE seller_id = p_user_id
      AND status = 'completed'
      AND COALESCE(completed_at, created_at) >= NOW() - INTERVAL '90 days'
    GROUP BY buyer_id
  ), totals AS (
    SELECT COALESCE(SUM(gmv), 0) AS raw_gmv, COALESCE(SUM(cnt), 0) AS orders
    FROM by_buyer
  )
  SELECT
    t.orders,
    COALESCE((SELECT SUM(LEAST(b.gmv, 0.30 * t.raw_gmv)) FROM by_buyer b), 0)
  INTO v_orders, v_gmv_counted
  FROM totals t;

  SELECT
    CASE WHEN COUNT(*) = 0 THEN 100.0
         ELSE (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*)) END
  INTO v_completion_rate
  FROM public.orders
  WHERE seller_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded')
    AND created_at >= NOW() - INTERVAL '90 days';

  SELECT CASE WHEN COUNT(*) = 0 THEN NULL
              ELSE (COUNT(*) FILTER (WHERE is_positive) * 100.0 / COUNT(*)) END
  INTO v_positive_pct
  FROM public.reviews
  WHERE seller_id = p_user_id
    AND is_visible = true
    AND created_at >= NOW() - INTERVAL '90 days';

  RETURN json_build_object(
    'current_tier',       v_current_tier,
    'eligible_tier',      v_eligible_tier,
    'tier_strikes',       v_strikes,
    'commission_rate',    v_current_config.commission_rate,
    'fee_multiplier',     v_current_config.fee_multiplier,
    'listing_limit',      v_current_config.listing_limit,
    'banner_access',      v_current_config.banner_access,
    'window_gmv',         ROUND(v_gmv_counted, 2),
    'window_orders',      v_orders,
    'window_positive_pct',   CASE WHEN v_positive_pct IS NULL THEN NULL ELSE ROUND(v_positive_pct, 1) END,
    'window_completion_pct', ROUND(v_completion_rate, 1),
    'next_tier',            CASE WHEN v_next_config IS NOT NULL THEN v_next_config.tier ELSE NULL END,
    'next_fee_multiplier',  CASE WHEN v_next_config IS NOT NULL THEN v_next_config.fee_multiplier ELSE NULL END,
    'next_gmv_90d_min',     CASE WHEN v_next_config IS NOT NULL THEN v_next_config.gmv_90d_min ELSE NULL END,
    'next_orders_90d_min',  CASE WHEN v_next_config IS NOT NULL THEN v_next_config.orders_90d_min ELSE NULL END,
    'next_positive_rating_min', CASE WHEN v_next_config IS NOT NULL THEN v_next_config.positive_rating_min ELSE NULL END,
    'next_completion_min',  CASE WHEN v_next_config IS NOT NULL THEN v_next_config.min_completion_rate ELSE NULL END
  );
END;
$$;

-- ── 8. Banner survives demotion ─────────────────────────────────────────────
-- Setting a NEW custom banner still requires diamond/legendary, but a banner
-- already earned is kept through a rank drop (one bad quarter shouldn't nuke a
-- veteran's storefront). Only the strip-on-demotion clause is removed.
CREATE OR REPLACE FUNCTION "public"."validate_banner_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.banner_url IS NOT NULL AND
     NEW.banner_url IS DISTINCT FROM OLD.banner_url AND
     NEW.seller_tier NOT IN ('diamond', 'legendary') THEN
    RAISE EXCEPTION 'Custom banners are only available for Diamond and Legendary sellers';
  END IF;

  RETURN NEW;
END;
$$;

-- Display paths follow the same rule: a stored banner renders regardless of
-- current tier (only diamond/legendary could ever have set it).
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

  IF user_profile.banner_url IS NOT NULL THEN
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
            WHEN ("p"."banner_url" IS NOT NULL) THEN "jsonb_build_object"('type', 'custom', 'url', "p"."banner_url")
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

commit;
