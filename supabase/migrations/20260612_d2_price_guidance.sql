-- ─────────────────────────────────────────────────────────────────────────────
-- Phase D2 — price guidance from completed sales.
--
-- Returns p25, median, p75, and the sample count of recently SOLD listings
-- for a given (game, category) pair. The wizard's Pricing sub-card shows a
-- band so the seller knows the going rate before they price too high/low.
--
-- Caveats:
--   - Uses `listings.status = 'sold'` + `listings.sold_at` (when available)
--     OR falls back to `updated_at` if `sold_at` doesn't exist on this
--     schema yet. The pure-listings approach is fine for a v1; a stronger
--     signal would join orders.completed_at, which can come in a later
--     iteration.
--   - Restricted to the last 60 days so the band stays current.
--   - Returns NULL fields when sample_size < 3 — we don't want to mislead
--     with a stat built on one or two outliers.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_price_guidance(uuid, text);
CREATE OR REPLACE FUNCTION public.get_price_guidance(
  p_game_id uuid,
  p_category_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id  uuid;
  v_p25          numeric;
  v_median       numeric;
  v_p75          numeric;
  v_count        integer;
BEGIN
  -- Resolve the legacy categories row from (game_id, metadata.type).
  SELECT id INTO v_category_id
  FROM public.categories
  WHERE game_id = p_game_id
    AND (metadata->>'type') = (
      CASE p_category_slug
        WHEN 'currency' THEN 'currency'
        WHEN 'items'    THEN 'items'
        WHEN 'accounts' THEN 'account'
        WHEN 'top-up'   THEN 'top_up'
        WHEN 'boosting' THEN 'service'
        ELSE p_category_slug
      END
    )
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'sample_size', 0, 'p25', NULL, 'median', NULL, 'p75', NULL
    );
  END IF;

  SELECT
    COUNT(*),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price),
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)
  INTO v_count, v_p25, v_median, v_p75
  FROM public.listings
  WHERE game_id     = p_game_id
    AND category_id = v_category_id
    AND status      = 'sold'
    AND updated_at  >= NOW() - INTERVAL '60 days';

  IF v_count < 3 THEN
    RETURN jsonb_build_object(
      'sample_size', v_count, 'p25', NULL, 'median', NULL, 'p75', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'sample_size', v_count,
    'p25',         ROUND(v_p25, 2),
    'median',      ROUND(v_median, 2),
    'p75',         ROUND(v_p75, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_price_guidance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_price_guidance(uuid, text) TO anon;
