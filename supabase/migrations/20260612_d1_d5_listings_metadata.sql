-- ─────────────────────────────────────────────────────────────────────────────
-- D1/D5 follow-up — add `metadata jsonb` to listings + refresh the policy RPC.
--
-- Problem: the D1 RPC reads `listings.metadata->>'source'` to count bulk
-- inserts in the last 24h, and the D5 bulk-publish action writes
-- `metadata: { source: 'bulk' }`. The column didn't exist, so publish was
-- failing with `column "metadata" does not exist`.
--
-- Fix: add the column (default '{}'::jsonb so existing rows stay valid)
-- and refresh the policy RPC against the now-existing column.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.metadata IS
  'Free-form structured tags. Today: { source: "bulk" } for D5 bulk uploads.';

-- Re-create the RPC against the new column. Same body as D1, no behavior
-- change beyond now actually being executable on schemas that lacked the
-- column before this ran.
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
