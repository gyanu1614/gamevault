-- ============================================================================
-- FEE ENGINE — PR 5 / part 5: drop the dormant fee ladders   (fee-engine.md §6 PR 6, §9 A11)
--
-- Money effect: NONE. Nothing reads any of this:
--   · category_fee_config + game_fee_overrides — the 20260908110000 "DB fee
--     grid" that no money path ever consumed (audit fee-inventory.md M6);
--     replaced by fee_rules + resolve_seller_fee (PR 1);
--   · seller_tier_config.commission_rate + fee_multiplier — the rank ladder's
--     third copy of a fee (M5), only ever displayed; rank steps are
--     discount_pts (PR 1), quoted as "−0.5 pts" (A6, part 4).
--
-- get_seller_tier_info() read commission_rate / fee_multiplier, so it is
-- re-created here WITHOUT them (same body otherwise — 20260909100000) and
-- returns the rank step instead: discount_pts + next_discount_pts. Every TS
-- reader switched in part 4 / part 5 of this PR.
--
-- KEPT (A12, §10 Q5): profiles.fee_override_pct / fee_override_expires_at —
-- dormant, unread, cheaper to leave than to drop and re-add.
-- KEPT: fee_config_audit (the admin action writes it).
--
-- IRREVERSIBLE by design (it drops columns and tables); it is the last step
-- and runs only once PRs 1–5 have been live. Rollback = re-create from
-- 20260908110000 (tables, columns, seed values) — data is not recoverable.
-- ============================================================================

-- ── 1. get_seller_tier_info without the dead columns ──────────────────────
CREATE OR REPLACE FUNCTION "public"."get_seller_tier_info"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
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
    -- Fee engine: the rank STEP (points off the category rate), never a rate.
    'discount_pts',       v_current_config.discount_pts,
    'listing_limit',      v_current_config.listing_limit,
    'banner_access',      v_current_config.banner_access,
    'window_gmv',         ROUND(v_gmv_counted, 2),
    'window_orders',      v_orders,
    'window_positive_pct',   CASE WHEN v_positive_pct IS NULL THEN NULL ELSE ROUND(v_positive_pct, 1) END,
    'window_completion_pct', ROUND(v_completion_rate, 1),
    'next_tier',            CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.tier ELSE NULL END,
    'next_discount_pts',    CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.discount_pts ELSE NULL END,
    'next_gmv_90d_min',     CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.gmv_90d_min ELSE NULL END,
    'next_orders_90d_min',  CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.orders_90d_min ELSE NULL END,
    'next_positive_rating_min', CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.positive_rating_min ELSE NULL END,
    'next_completion_min',  CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.min_completion_rate ELSE NULL END
  );
END;
$$;

-- ── 2. Drop the dead ladder columns and tables ─────────────────────────────
ALTER TABLE public.seller_tier_config
  DROP CONSTRAINT IF EXISTS seller_tier_config_fee_multiplier_check,
  DROP COLUMN IF EXISTS fee_multiplier,
  DROP COLUMN IF EXISTS commission_rate;

DROP TABLE IF EXISTS public.game_fee_overrides;   -- FK → category_fee_config, so first
DROP TABLE IF EXISTS public.category_fee_config;

-- ── 3. Proof — refuse to finish half-applied ──────────────────────────────
DO $$
DECLARE v_json json;
BEGIN
  IF to_regclass('public.category_fee_config') IS NOT NULL OR to_regclass('public.game_fee_overrides') IS NOT NULL THEN
    RAISE EXCEPTION 'fee engine PR 5: dead fee tables still exist';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'seller_tier_config'
               AND column_name IN ('commission_rate', 'fee_multiplier')) THEN
    RAISE EXCEPTION 'fee engine PR 5: seller_tier_config still carries a fee column';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND (p.prosrc ILIKE '%commission_rate%' OR p.prosrc ILIKE '%fee_multiplier%'
                                             OR p.prosrc ILIKE '%category_fee_config%' OR p.prosrc ILIKE '%game_fee_overrides%')) THEN
    RAISE EXCEPTION 'fee engine PR 5: a function still references a dropped fee column/table';
  END IF;
  -- The RPC still answers (a NULL user resolves to bronze) and names the step.
  v_json := public.get_seller_tier_info('00000000-0000-0000-0000-000000000000'::uuid);
  IF (v_json->>'current_tier') IS NULL OR NOT (v_json::jsonb ? 'discount_pts') THEN
    RAISE EXCEPTION 'fee engine PR 5: get_seller_tier_info did not return discount_pts';
  END IF;
END $$;
