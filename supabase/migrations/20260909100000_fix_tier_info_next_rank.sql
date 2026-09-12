-- Fix: /account/tiers showed "You've reached Bronze — the top rank" for
-- Bronze sellers. Cause: plpgsql record-null semantics — `v_next_config IS
-- NOT NULL` is true only when EVERY field of the record is non-null, and the
-- rank rows now legitimately carry NULLs (listing_limit, positive_rating_min,
-- min_rating…), so the next-tier lookup always read as "no next tier".
-- Fix: test `v_next_config.tier IS NOT NULL` (found-ness via the PK) instead
-- of testing the whole record. No other behaviour changes.

begin;

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
    'next_tier',            CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.tier ELSE NULL END,
    'next_fee_multiplier',  CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.fee_multiplier ELSE NULL END,
    'next_gmv_90d_min',     CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.gmv_90d_min ELSE NULL END,
    'next_orders_90d_min',  CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.orders_90d_min ELSE NULL END,
    'next_positive_rating_min', CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.positive_rating_min ELSE NULL END,
    'next_completion_min',  CASE WHEN v_next_config.tier IS NOT NULL THEN v_next_config.min_completion_rate ELSE NULL END
  );
END;
$$;

commit;
