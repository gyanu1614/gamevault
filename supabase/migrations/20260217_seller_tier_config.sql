-- ============================================================
-- SELLER TIER CONFIG SYSTEM
-- Source of truth for all tier thresholds + commission rates
-- Date: 2026-02-17
-- ============================================================

-- ── 1. Expand seller_tier column to include unverified + diamond ──────────────

-- Drop old constraint if it only had 4 values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_seller_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_seller_tier_check
  CHECK (seller_tier IN ('unverified', 'bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- Default new sellers to 'unverified'
ALTER TABLE public.profiles
  ALTER COLUMN seller_tier SET DEFAULT 'unverified';

-- Backfill any NULLs
UPDATE public.profiles
  SET seller_tier = 'unverified'
  WHERE seller_tier IS NULL;

-- ── 2. seller_tier_config table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_tier_config (
  tier                TEXT        PRIMARY KEY,
  display_name        TEXT        NOT NULL,
  description         TEXT,
  min_sales           INTEGER     NOT NULL DEFAULT 0,
  min_rating          NUMERIC(3,1),           -- NULL = no requirement
  min_age_days        INTEGER     NOT NULL DEFAULT 0,
  min_completion_rate NUMERIC(5,2),           -- NULL = no requirement, percentage 0-100
  commission_rate     NUMERIC(6,4) NOT NULL,  -- e.g. 0.0990 = 9.90%
  listing_limit       INTEGER,                -- NULL = unlimited
  banner_access       BOOLEAN     NOT NULL DEFAULT false,
  badge_color         TEXT        NOT NULL DEFAULT 'zinc',
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seller_tier_config ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can view tier requirements)
DROP POLICY IF EXISTS "seller_tier_config_public_read" ON public.seller_tier_config;
CREATE POLICY "seller_tier_config_public_read"
  ON public.seller_tier_config FOR SELECT USING (true);

-- ── 3. Seed all 6 tiers ───────────────────────────────────────────────────────

INSERT INTO public.seller_tier_config
  (tier, display_name, description, min_sales, min_rating, min_age_days,
   min_completion_rate, commission_rate, listing_limit, banner_access, badge_color, sort_order)
VALUES
  ('unverified', 'Unverified', 'New seller awaiting first sale',
   0,   NULL, 0,   NULL, 0.0990, 5,    false, 'zinc',   0),
  ('bronze',     'Bronze',     'Getting started — first sale completed',
   1,   3.5,  7,   80.0, 0.0890, 20,   false, 'orange', 1),
  ('silver',     'Silver',     'Established seller',
   10,  4.0,  30,  90.0, 0.0790, 50,   true,  'slate',  2),
  ('gold',       'Gold',       'Trusted & reliable seller',
   50,  4.3,  90,  95.0, 0.0690, 100,  true,  'yellow', 3),
  ('platinum',   'Platinum',   'Top-tier seller with proven track record',
   200, 4.6,  180, 97.0, 0.0590, NULL, true,  'cyan',   4),
  ('diamond',    'Diamond',    'Elite seller — the best of the best',
   500, 4.8,  365, 99.0, 0.0490, NULL, true,  'violet', 5)
ON CONFLICT (tier) DO UPDATE SET
  commission_rate     = EXCLUDED.commission_rate,
  min_sales           = EXCLUDED.min_sales,
  min_rating          = EXCLUDED.min_rating,
  min_age_days        = EXCLUDED.min_age_days,
  min_completion_rate = EXCLUDED.min_completion_rate,
  listing_limit       = EXCLUDED.listing_limit,
  banner_access       = EXCLUDED.banner_access,
  badge_color         = EXCLUDED.badge_color,
  sort_order          = EXCLUDED.sort_order;

-- ── 4. check_seller_tier_eligibility(user_id) ─────────────────────────────────
-- Returns the highest tier the seller currently qualifies for

CREATE OR REPLACE FUNCTION check_seller_tier_eligibility(p_user_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile          RECORD;
  v_total_sales      INTEGER;
  v_completion_rate  NUMERIC;
  v_account_age_days INTEGER;
  v_tier_config      RECORD;
  v_best_tier        TEXT := 'unverified';
BEGIN
  SELECT seller_rating, seller_tier, created_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'unverified';
  END IF;

  -- Completed sales
  SELECT COUNT(*) INTO v_total_sales
  FROM public.orders
  WHERE seller_id = p_user_id AND status = 'completed';

  -- Completion rate = completed / (all non-cancelled orders)
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 100.0
      ELSE (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
    END
  INTO v_completion_rate
  FROM public.orders
  WHERE seller_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded');

  -- Account age
  v_account_age_days := EXTRACT(DAY FROM NOW() - v_profile.created_at)::INTEGER;

  -- Walk tiers from highest to lowest, return first match
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

-- ── 5. upgrade_all_seller_tiers() ─────────────────────────────────────────────
-- Called by the daily cron job. Only upgrades, never downgrades.

CREATE OR REPLACE FUNCTION upgrade_all_seller_tiers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE tier = COALESCE(v_seller.seller_tier, 'unverified');

    SELECT COALESCE(sort_order, 0) INTO v_new_order
    FROM public.seller_tier_config
    WHERE tier = v_new_tier;

    -- Only apply if it's an upgrade
    IF v_new_order > v_current_order THEN
      UPDATE public.profiles SET seller_tier = v_new_tier WHERE id = v_seller.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 6. get_seller_tier_info(user_id) ──────────────────────────────────────────
-- Convenience function: returns current tier config + next tier info in one call

CREATE OR REPLACE FUNCTION get_seller_tier_info(p_user_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tier TEXT;
  v_eligible_tier TEXT;
  v_current_config RECORD;
  v_next_config RECORD;
BEGIN
  SELECT seller_tier INTO v_current_tier FROM public.profiles WHERE id = p_user_id;
  v_current_tier := COALESCE(v_current_tier, 'unverified');
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
