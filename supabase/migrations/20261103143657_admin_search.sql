-- Admin search: indexes that serve "contains", and one call for the header box.
--
-- Staff search by part of a name, email, order number or listing title. A leading
-- % cannot use a normal index, so each of these walked its whole table, four tables
-- per pause in typing from the header alone. Trigram indexes answer those queries
-- directly. Only the tables that grow get one; disputes and applications stay small.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx ON public.profiles USING gin (username extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_email_trgm_idx ON public.profiles USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_full_name_trgm_idx ON public.profiles USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_shop_name_trgm_idx ON public.profiles USING gin (shop_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_title_trgm_idx ON public.listings USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS orders_order_number_search_trgm_idx ON public.orders USING gin (order_number_search extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS reviews_comment_trgm_idx ON public.reviews USING gin (comment extensions.gin_trgm_ops);

-- The header search box: one request per pause in typing (was four), called from
-- the browser so it never queues behind a running server action. Null for anyone
-- but staff with two-factor. Patterns are ILIKE patterns, escaped by the caller.
CREATE OR REPLACE FUNCTION public.admin_quick_search(p_like text, p_order_like text, p_limit integer DEFAULT 3)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'users', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, username, email, full_name
        FROM public.profiles
        WHERE username ILIKE p_like OR email ILIKE p_like OR full_name ILIKE p_like
        LIMIT p_limit
      ) r
    ), '[]'::jsonb),
    'applications', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, display_name, status
        FROM public.seller_applications
        WHERE display_name ILIKE p_like OR full_legal_name ILIKE p_like OR alternate_email ILIKE p_like
        LIMIT p_limit
      ) r
    ), '[]'::jsonb),
    'disputes', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, title, reason, status
        FROM public.disputes
        WHERE title ILIKE p_like OR reason::text ILIKE p_like
        LIMIT p_limit
      ) r
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, order_number, status
        FROM public.orders
        WHERE order_number_search ILIKE p_order_like
        LIMIT p_limit
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

revoke all on function public.admin_quick_search(text, text, integer) from public, anon;
grant execute on function public.admin_quick_search(text, text, integer) to authenticated;
