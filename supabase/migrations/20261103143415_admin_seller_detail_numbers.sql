-- A seller's numbers on their admin page, counted in the database. The page read
-- every listing and order the seller has and added them up in TypeScript, so past
-- 1,000 rows (where PostgREST stops without an error) revenue and sales came out
-- wrong for the sellers who matter most.
CREATE OR REPLACE FUNCTION public.admin_seller_detail_numbers(p_seller_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'listing_counts', COALESCE(
      (SELECT jsonb_object_agg(status, n) FROM (
        SELECT status, count(*) AS n FROM public.listings WHERE seller_id = p_seller_id GROUP BY status
      ) by_status),
      '{}'::jsonb
    ),
    'total_orders', count(*),
    'completed_orders', count(*) FILTER (WHERE status = 'completed'),
    'revenue', COALESCE(sum(seller_payout) FILTER (WHERE status = 'completed'), 0),
    'gmv', COALESCE(sum(total_amount) FILTER (WHERE status = 'completed'), 0),
    'countable_orders', count(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))
  )
  FROM public.orders
  WHERE seller_id = p_seller_id;
$$;

revoke all on function public.admin_seller_detail_numbers(uuid) from public, anon, authenticated;
grant execute on function public.admin_seller_detail_numbers(uuid) to service_role;
