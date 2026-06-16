-- ─────────────────────────────────────────────────────────────────────────────
-- Phase D1 — moderation gate + tier-based caps
--
-- Adds:
--   1. seller_tier_config columns: bulk_daily_cap, auto_approve_single,
--      auto_approve_bulk, pre_moderation_listings.
--   2. RPC `get_seller_publish_policy(user_id)` returning everything the
--      publish action (and the wizard UI) needs in one call:
--        - tier label
--        - listing_limit (lifetime active cap)
--        - active_count (how many active listings the seller currently has)
--        - bulk_daily_cap, bulk_today_count
--        - auto_approve_single, auto_approve_bulk
--        - is_verified
--        - approved_listings (counter for pre-moderation gate)
--        - pre_moderation_listings (threshold from tier_config)
--        - needs_moderation (true ⇒ new active listing should land as
--          pending_approval instead).
--   3. Replaces the hardcoded-5 in check_seller_needs_moderation() with a
--      tier_config lookup so it stays in sync if we change the rule.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend seller_tier_config
ALTER TABLE public.seller_tier_config
  ADD COLUMN IF NOT EXISTS bulk_daily_cap          INTEGER,
  ADD COLUMN IF NOT EXISTS auto_approve_single     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_approve_bulk       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_moderation_listings INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.seller_tier_config.bulk_daily_cap IS
  'Max bulk-uploaded listings per 24h window. NULL = unlimited. Single uploads use listing_limit.';
COMMENT ON COLUMN public.seller_tier_config.auto_approve_single IS
  'TRUE ⇒ single-listing publishes from this tier go directly to status=active (subject to pre_moderation_listings).';
COMMENT ON COLUMN public.seller_tier_config.auto_approve_bulk IS
  'TRUE ⇒ bulk-uploaded listings from this tier are auto-approved.';
COMMENT ON COLUMN public.seller_tier_config.pre_moderation_listings IS
  'Until the seller has this many approved listings, every new active listing is downgraded to pending_approval. 0 = no pre-moderation.';

-- 2. Per-tier policy: unverified needs the first 5 reviewed and gets a
--    25-listing cap. Bronze+ have no cap and auto-approve singles. Bulk
--    is gated until gold.
UPDATE public.seller_tier_config SET
  listing_limit           = CASE tier
                              WHEN 'unverified' THEN 25
                              ELSE NULL
                            END,
  bulk_daily_cap          = CASE tier
                              WHEN 'unverified' THEN 0
                              WHEN 'bronze'     THEN 5
                              WHEN 'silver'     THEN 20
                              WHEN 'gold'       THEN 50
                              WHEN 'platinum'   THEN 200
                              WHEN 'diamond'    THEN NULL
                            END,
  auto_approve_single     = CASE tier
                              WHEN 'unverified' THEN FALSE
                              ELSE TRUE
                            END,
  auto_approve_bulk       = CASE tier
                              WHEN 'unverified' THEN FALSE
                              WHEN 'bronze'     THEN FALSE
                              WHEN 'silver'     THEN FALSE
                              ELSE TRUE
                            END,
  pre_moderation_listings = CASE tier
                              WHEN 'unverified' THEN 5
                              ELSE 0
                            END;

-- 3. Update the existing trigger helper to read pre_moderation_listings
--    from tier_config instead of hardcoding 5.
CREATE OR REPLACE FUNCTION public.check_seller_needs_moderation(seller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier                  TEXT;
  v_pre_moderation_count  INTEGER;
  v_approved_count        INTEGER;
BEGIN
  SELECT seller_tier INTO v_tier
  FROM public.profiles
  WHERE id = seller_id;

  IF v_tier IS NULL THEN v_tier := 'unverified'; END IF;

  SELECT pre_moderation_listings INTO v_pre_moderation_count
  FROM public.seller_tier_config
  WHERE tier = v_tier;

  -- Unknown tier ⇒ behave like unverified.
  IF v_pre_moderation_count IS NULL THEN v_pre_moderation_count := 5; END IF;
  IF v_pre_moderation_count = 0 THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_approved_count
  FROM public.listings
  WHERE listings.seller_id = check_seller_needs_moderation.seller_id
    AND listings.status IN ('active', 'sold', 'archived')
    AND listings.approved_at IS NOT NULL;

  RETURN v_approved_count < v_pre_moderation_count;
END;
$$;

-- 4. One-shot policy RPC for the wizard.
DROP FUNCTION IF EXISTS public.get_seller_publish_policy(uuid);
CREATE OR REPLACE FUNCTION public.get_seller_publish_policy(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  SELECT COALESCE(seller_tier, 'unverified'), COALESCE(is_verified, FALSE)
  INTO v_tier, v_is_verified
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_tier IS NULL THEN
    -- profile row missing — treat as unverified
    v_tier := 'unverified';
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

  -- Bulk usage today: count listings created via metadata.source = 'bulk'
  -- in the last 24h. metadata key is added by the bulk action (Phase D5);
  -- safe to read as JSONB even before that ships.
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

GRANT EXECUTE ON FUNCTION public.get_seller_publish_policy(uuid) TO authenticated;
