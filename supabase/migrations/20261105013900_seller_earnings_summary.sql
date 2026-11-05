-- The wallet's headline numbers in one database call.
--
-- The page read every completed and in-flight order into the browser, in pages, then
-- asked for each order's private payout, to add up three sums. Past a few hundred
-- sales that is a long wait for three numbers. Service role only: the page authenticates
-- the seller and passes their own id. Read-only, and the old code never calls it, so
-- it is safe before or after the deploy.

CREATE OR REPLACE FUNCTION public.seller_earnings_summary(p_seller_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE
  SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_earned', COALESCE(sum(seller_payout) FILTER (WHERE status = 'completed'), 0),
    'this_month', COALESCE(sum(seller_payout) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('month', now())), 0),
    'pending_sales', COALESCE(sum(seller_payout) FILTER (WHERE status IN ('paid', 'delivering', 'delivered', 'disputed')), 0)
  )
  FROM orders
  WHERE seller_id = p_seller_id
$$;

REVOKE ALL ON FUNCTION public.seller_earnings_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_earnings_summary(uuid) TO service_role;
