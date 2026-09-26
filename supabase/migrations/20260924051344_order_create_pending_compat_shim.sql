-- ─────────────────────────────────────────────────────────────────────────────
-- Checkout B3 — zero-downtime compatibility shim.  -- DROP in cleanup PR
--
-- 20260923185256_buyer_method_fees dropped the 21-arg order_create_pending
-- (round B) for the 19-arg overload that quotes the buyer fee itself. Between
-- `db push` and the deploy (either order) the OLD code still calls the 21-arg
-- shape. This file re-creates that shape as a thin delegate:
--
--   · p_payment_processing_fee_rate, p_payment_processing_fee and
--     p_total_amount are IGNORED — the fee and the total come from
--     buyer_fee_quote, exactly as for new code (the caller reads charge_minor
--     from the result, so the provider charge it mints is the quoted one);
--   · the method is derived from the args old code already sends:
--     the Payssion pm_id when present, else the provider name
--     (btcpay / coingate / fake). Old code never names 'wallet'; a fully
--     wallet-covered order simply mints no attempt, as before.
--
-- Service-role only, like the function it delegates to. Pinned by
-- src/test/guards/order-create-pending-shim.guard.integration.test.ts (both
-- overloads produce identical orders; an old-code checkout completes end to
-- end). Once every deploy that can call the 21-arg shape is gone, DROP this
-- overload and delete that guard.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.order_create_pending(
  p_buyer_id uuid, p_seller_id uuid, p_listing_id uuid, p_quantity integer,
  p_unit_price numeric, p_subtotal numeric,
  p_platform_fee_rate numeric, p_payment_processing_fee_rate numeric,
  p_platform_fee numeric, p_payment_processing_fee numeric,
  p_total_amount numeric, p_seller_payout numeric,
  p_seller_commission_pct numeric, p_seller_fee_trace jsonb,
  p_currency text, p_promo_code_id uuid, p_promo_discount numeric,
  p_wallet_minor bigint, p_provider text, p_pm_id text,
  p_fallback_expires_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- The three legacy money args are deliberately unread.
  RETURN public.order_create_pending(
    p_buyer_id, p_seller_id, p_listing_id, p_quantity,
    p_unit_price, p_subtotal,
    p_platform_fee_rate, p_platform_fee,
    p_seller_payout,
    p_seller_commission_pct, p_seller_fee_trace,
    p_currency, p_promo_code_id, p_promo_discount,
    p_wallet_minor, p_provider, p_pm_id,
    p_fallback_expires_at,
    COALESCE(NULLIF(p_pm_id, ''), p_provider));
END;
$$;
REVOKE ALL ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) TO service_role;
COMMENT ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz) IS
  'Checkout B3 compatibility shim — DROP in cleanup PR. Round-B (21-arg) shape for code deployed before B3: ignores the three legacy money args, derives the method (pm_id, else provider) and delegates to the 19-arg order_create_pending, which quotes and snapshots the buyer fee. Service-role only.';
