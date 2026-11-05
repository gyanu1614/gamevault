-- One database call for Admin → Listings (plan 2, phase 1).
--
-- Staff could reach Take Down only from a seller's 8 newest listings or an upheld report. This
-- pages, filters and searches every listing in SQL. Title, username and store name each already
-- have a trigram index (20261103143657), so the search stays index-backed as the table grows.
--
-- Called through the service role after requireRole, like the other admin list functions. Returns
-- display details only: no email or other private seller column.

CREATE OR REPLACE FUNCTION public.admin_listings_page(
  p_q      text,    -- an ILIKE pattern, already escaped by the caller
  p_id     uuid,    -- an exact listing id, when the search text is one
  p_status text,
  p_limit  integer,
  p_page   integer
) RETURNS jsonb
  LANGUAGE sql STABLE
  SET search_path = public
AS $$
  WITH sellers AS (
    SELECT id FROM public.profiles
    WHERE p_q IS NOT NULL AND (username ILIKE p_q OR shop_name ILIKE p_q)
  ), matched AS (
    SELECT l.id, l.created_at
    FROM public.listings l
    WHERE (p_status IS NULL OR l.status = p_status)
      AND (
        (p_q IS NULL AND p_id IS NULL)
        OR l.id = p_id
        OR l.title ILIKE p_q
        OR l.seller_id IN (SELECT id FROM sellers)
      )
  ), page AS (
    SELECT id, created_at FROM matched
    ORDER BY created_at DESC, id
    LIMIT p_limit OFFSET GREATEST(p_page - 1, 0) * p_limit
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM matched),
    'page', GREATEST(p_page, 1),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'slug', l.slug,
        'image', l.images[1],
        'price', l.price,
        'status', l.status,
        'created_at', l.created_at,
        'note', CASE WHEN l.status IN ('suspended', 'changes_requested') THEN l.moderation_notes
                     WHEN l.status = 'rejected' THEN COALESCE(l.rejection_reason, l.moderation_notes) END,
        'seller', jsonb_build_object(
          'id', p.id,
          'name', COALESCE(p.shop_name, p.username),
          'status', p.seller_status
        ),
        'game', CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object('name', g.name, 'slug', g.slug) END,
        'category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name, 'slug', c.slug) END
      ) ORDER BY page.created_at DESC, page.id)
      FROM page
      JOIN public.listings l ON l.id = page.id
      LEFT JOIN public.profiles p ON p.id = l.seller_id
      LEFT JOIN public.games g ON g.id = l.game_id
      LEFT JOIN public.game_categories c ON c.id = l.game_category_id
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_listings_page(text, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listings_page(text, uuid, text, integer, integer) TO service_role;
