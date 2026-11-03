-- Admin lists read one page from one query.
--
-- The seller lists, the moderation queue, the reviews numbers, the games list and
-- the withdrawals queue each read whole tables into the server and joined them in
-- TypeScript. Past 1,000 rows PostgREST cuts a response off without an error, so
-- those screens would have shown wrong counts and wrong money as well as slowing
-- down.
--
-- Every function here is service-role only: the caller's staff check runs in
-- TypeScript first, and these return email addresses and money. SECURITY DEFINER
-- only where auth.users is read.

-- ── Active Sellers: one page, filtered and sorted in the database ───────────
CREATE OR REPLACE FUNCTION public.admin_active_sellers_page(
  p_search       text,      -- an ILIKE pattern, already escaped by the caller
  p_status       text,
  p_tier         text,
  p_default_tier text,      -- what a NULL seller_tier counts as
  p_verified     boolean,
  p_paused       boolean,   -- true = paused stores only
  p_sort         text,
  p_ascending    boolean,
  p_limit        integer,
  p_offset       integer
) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT
      p.id, p.username, p.full_name, p.email, p.avatar_url, p.shop_name, p.seller_tier, p.seller_status,
      p.kyc_status, p.is_verified, p.founding_seller, p.is_test, p.created_at, p.total_sales, p.seller_rating,
      p.total_reviews,
      COALESCE(pr.store_paused, false) AS store_paused,
      GREATEST(pr.last_active_at, pr.last_seen_at, u.last_sign_in_at) AS last_active_at
    FROM public.profiles p
    LEFT JOIN public.seller_presence pr ON pr.seller_id = p.id
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'seller'
      AND (p_status IS NULL OR COALESCE(p.seller_status, 'active') = p_status)
      AND (p_tier IS NULL OR COALESCE(p.seller_tier, p_default_tier) = p_tier)
      AND (p_verified IS NULL OR (p.is_verified IS TRUE) = p_verified)
      AND (p_paused IS NOT TRUE OR pr.store_paused IS TRUE)
      AND (
        p_search IS NULL
        OR p.username ILIKE p_search
        OR p.full_name ILIKE p_search
        OR p.shop_name ILIKE p_search
        OR p.email ILIKE p_search
      )
  ),
  enriched AS (
    SELECT
      b.*,
      COALESCE(l.active_listings, 0) AS active_listings,
      COALESCE(l.pending_listings, 0) AS pending_listings,
      l.latest_listing_at,
      COALESCE(o.completed_sales, 0) AS completed_sales,
      COALESCE(o.revenue, 0) AS revenue,
      COALESCE(w.pending_withdrawals, 0) AS pending_withdrawals,
      a.approved_at
    FROM base b
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE status = 'active') AS active_listings,
        count(*) FILTER (WHERE status = 'pending_approval') AS pending_listings,
        max(created_at) AS latest_listing_at
      FROM public.listings
      WHERE seller_id = b.id AND status IN ('active', 'pending_approval')
    ) l ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS completed_sales, sum(seller_payout) AS revenue
      FROM public.orders
      WHERE seller_id = b.id AND status = 'completed'
    ) o ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS pending_withdrawals
      FROM public.withdrawal_requests
      WHERE user_id = b.id AND status = 'pending'
    ) w ON true
    LEFT JOIN LATERAL (
      SELECT max(COALESCE(reviewed_at, created_at)) AS approved_at
      FROM public.seller_applications
      WHERE user_id = b.id AND status = 'approved'
    ) a ON true
  ),
  keyed AS (
    SELECT
      e.*,
      CASE p_sort
        WHEN 'sales' THEN e.completed_sales::numeric
        WHEN 'revenue' THEN e.revenue::numeric
        WHEN 'joined' THEN extract(epoch FROM e.created_at)
        WHEN 'last_active' THEN COALESCE(extract(epoch FROM e.last_active_at), 0)
        WHEN 'approved' THEN COALESCE(extract(epoch FROM e.approved_at), 0)
        WHEN 'recent_listing' THEN COALESCE(extract(epoch FROM e.latest_listing_at), 0)
        ELSE e.active_listings::numeric
      END AS sort_key
    FROM enriched e
  ),
  numbered AS (
    SELECT
      k.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN p_ascending THEN k.sort_key END ASC,
          CASE WHEN NOT p_ascending THEN k.sort_key END DESC,
          k.created_at DESC,
          k.id
      ) AS rn
    FROM keyed k
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM numbered),
    'rows', COALESCE(
      (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.rn) FROM numbered n WHERE n.rn > p_offset AND n.rn <= p_offset + p_limit),
      '[]'::jsonb
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_seller_totals() RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_sellers', (SELECT count(*) FROM public.profiles WHERE role = 'seller'),
    'active_listings', (SELECT count(*) FROM public.listings WHERE status = 'active'),
    'revenue', (SELECT COALESCE(sum(seller_payout), 0) FROM public.orders WHERE status = 'completed'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status = 'pending')
  );
$$;

-- ── Sellers (every person on the seller journey) ────────────────────────────
-- Stage mirrors deriveStage() in lib/founding/onboarding.ts; the guard test holds
-- the two together. `sells` holds { game, categories } rows today, and bare
-- strings or { slug | name } rows from before.
CREATE OR REPLACE FUNCTION public.admin_all_sellers_page(
  p_q        text,      -- an ILIKE pattern, already escaped by the caller
  p_stage    text,
  p_trust    text,
  p_founding boolean,
  p_limit    integer,
  p_page     integer,
  p_stalled_before timestamptz
) RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  WITH people AS (
    SELECT p.id, true AS is_seller, p.created_at AS profile_created_at, o.user_id AS onboarding_user_id
    FROM public.profiles p
    LEFT JOIN public.seller_onboarding o ON o.user_id = p.id
    WHERE p.role = 'seller'
    UNION ALL
    SELECT p.id, false, p.created_at, o.user_id
    FROM public.seller_onboarding o
    JOIN public.profiles p ON p.id = o.user_id
    WHERE p.role IS DISTINCT FROM 'seller'
  ),
  derived AS (
    SELECT
      pe.id, pe.is_seller,
      p.username, p.full_name, p.email, p.avatar_url,
      COALESCE(p.shop_name, o.store_name) AS shop_name,
      p.shop_slug, p.seller_tier, p.seller_status,
      p.is_verified IS TRUE AS is_verified,
      p.founding_seller IS TRUE AS founding_seller,
      p.is_test IS TRUE AS is_test,
      COALESCE(o.created_at, p.created_at) AS signed_up_at,
      o.country, o.discord, o.completed_at, o.sells,
      GREATEST(pr.last_active_at, pr.last_seen_at, o.updated_at) AS last_active_at,
      (SELECT max(a.signed_at) FROM public.seller_agreements a WHERE a.user_id = pe.id) AS agreement_signed_at,
      EXISTS (SELECT 1 FROM public.listings l WHERE l.seller_id = pe.id) AS has_listing,
      EXISTS (SELECT 1 FROM public.orders r WHERE r.seller_id = pe.id AND r.status = 'completed') AS has_sale,
      CASE
        WHEN pe.is_seller THEN 5
        WHEN NOT (
          COALESCE(o.country, '') <> ''
          AND o.is_adult_confirmed_at IS NOT NULL
          AND jsonb_typeof(o.sells) = 'array'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(o.sells) entry
            WHERE COALESCE(entry #>> '{game}', entry #>> '{slug}', entry #>> '{name}',
                           CASE WHEN jsonb_typeof(entry) = 'string' THEN entry #>> '{}' END) <> ''
          )
        ) THEN 2
        WHEN COALESCE(o.store_name, '') = '' THEN 3
        ELSE 4
      END AS stage
    FROM people pe
    JOIN public.profiles p ON p.id = pe.id
    LEFT JOIN public.seller_onboarding o ON o.user_id = pe.id
    LEFT JOIN public.seller_presence pr ON pr.seller_id = pe.id
  ),
  filtered AS (
    SELECT
      d.*,
      row_number() OVER (ORDER BY d.signed_up_at DESC, d.id) AS rn,
      count(*) OVER () AS total
    FROM derived d
    WHERE (
        p_stage IS NULL
        OR (p_stage = 'in_progress' AND d.stage < 5)
        OR (p_stage = 'live' AND d.stage = 5)
        OR (p_stage = 'listed' AND (d.has_listing OR d.has_sale))
        OR (p_stage = 'sold' AND d.has_sale)
        OR (p_stage = 'stalled' AND d.stage < 5 AND COALESCE(d.last_active_at, d.signed_up_at) < p_stalled_before)
      )
      AND (p_trust IS NULL OR (p_trust = 'verified' AND d.is_verified) OR (p_trust = 'new' AND NOT d.is_verified))
      AND (p_founding IS NOT TRUE OR d.founding_seller)
      AND (
        p_q IS NULL
        OR d.username ILIKE p_q
        OR d.full_name ILIKE p_q
        OR d.shop_name ILIKE p_q
        OR d.email ILIKE p_q
        OR d.discord ILIKE p_q
        OR d.country ILIKE p_q
      )
  ),
  paging AS (
    SELECT
      COALESCE(max(total), 0) AS total,
      LEAST(GREATEST(p_page, 1), GREATEST(ceil(COALESCE(max(total), 0)::numeric / p_limit)::integer, 1)) AS page
    FROM filtered
  ),
  shown AS (
    SELECT
      f.*,
      (SELECT count(*) FROM public.listings l WHERE l.seller_id = f.id AND l.status IN ('active', 'pending_approval')) AS active_listings,
      s.completed_sales,
      s.revenue,
      CASE WHEN f.stage = 5 THEN public.seller_available_balance(f.id, 'USD') END AS balance_minor
    FROM filtered f
    CROSS JOIN paging pg
    CROSS JOIN LATERAL (
      SELECT count(*) AS completed_sales, COALESCE(sum(r.seller_payout), 0) AS revenue
      FROM public.orders r
      WHERE r.seller_id = f.id AND r.status = 'completed'
    ) s
    WHERE f.rn > (pg.page - 1) * p_limit AND f.rn <= pg.page * p_limit
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM paging),
    'page', (SELECT page FROM paging),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.rn) FROM shown s), '[]'::jsonb),
    'funnel', (
      SELECT jsonb_build_object(
        'signed_up', count(*),
        'details', count(*) FILTER (WHERE d.stage >= 3),
        'store', count(*) FILTER (WHERE d.stage >= 4),
        'agreement', count(*) FILTER (WHERE d.agreement_signed_at IS NOT NULL OR d.stage = 5),
        'live', count(*) FILTER (WHERE d.stage = 5),
        'listed', count(*) FILTER (WHERE d.has_listing OR d.has_sale),
        'sold', count(*) FILTER (WHERE d.has_sale),
        'verified', count(*) FILTER (WHERE d.stage = 5 AND d.is_verified),
        'founding', count(*) FILTER (WHERE d.founding_seller)
      )
      FROM derived d
    )
  );
$$;

-- ── Moderation ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_moderation_stats(p_today timestamptz) RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending', (SELECT count(*) FROM public.listings WHERE status = 'pending_approval'),
    'awaiting_seller', (SELECT count(*) FROM public.listings WHERE status = 'changes_requested'),
    'approved_today', (SELECT count(*) FROM public.listings WHERE status = 'active' AND approved_at >= p_today),
    'rejected_today', (SELECT count(*) FROM public.listings WHERE status = 'rejected' AND rejected_at >= p_today),
    'total_approved', (SELECT count(*) FROM public.listings WHERE status = 'active' AND approved_at IS NOT NULL)
  );
$$;

-- Listings already released per seller (the "2/3 Reviewed" chip on the queue).
CREATE OR REPLACE FUNCTION public.admin_seller_released_counts(p_seller_ids uuid[])
  RETURNS TABLE (seller_id uuid, released bigint)
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT l.seller_id, count(*)
  FROM public.listings l
  WHERE l.seller_id = ANY (p_seller_ids)
    AND l.status IN ('active', 'sold', 'archived')
    AND l.approved_at IS NOT NULL
  GROUP BY l.seller_id;
$$;

-- ── Reviews + games ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_stats() RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_reviews', count(*),
    'flagged_reviews', count(*) FILTER (WHERE flagged_for_moderation),
    'hidden_reviews', count(*) FILTER (WHERE is_visible IS NOT TRUE),
    'avg_rating', COALESCE(avg(rating), 0)
  )
  FROM public.reviews;
$$;

CREATE OR REPLACE FUNCTION public.admin_game_listing_counts()
  RETURNS TABLE (game_id uuid, active_listings bigint)
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT l.game_id, count(*) FROM public.listings l WHERE l.status = 'active' GROUP BY l.game_id;
$$;

-- ── Withdrawals ─────────────────────────────────────────────────────────────
-- The queue called withdrawal_risk_snapshot once per seller on the page.
CREATE OR REPLACE FUNCTION public.withdrawal_risk_snapshots(p_seller_ids uuid[])
  RETURNS TABLE (seller_id uuid, snapshot jsonb)
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id, public.withdrawal_risk_snapshot(id) FROM unnest(p_seller_ids) AS id;
$$;

CREATE OR REPLACE FUNCTION public.admin_withdrawal_totals(p_open_statuses text[]) RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'counts', COALESCE(
      (SELECT jsonb_object_agg(status, n) FROM (
        SELECT status, count(*) AS n FROM public.withdrawal_requests GROUP BY status
      ) by_status),
      '{}'::jsonb
    ),
    'approved_sum', COALESCE(sum(amount) FILTER (WHERE status = 'approved'), 0),
    'paid_sum', COALESCE(sum(amount) FILTER (WHERE status = 'completed'), 0),
    'clearing_sum', COALESCE(sum(amount) FILTER (WHERE status = ANY (p_open_statuses)), 0)
  )
  FROM public.withdrawal_requests;
$$;

-- ── Service role only ───────────────────────────────────────────────────────
-- A new function still carries Postgres's built-in EXECUTE for PUBLIC: the
-- default-privileges change in 20260913100000 cannot remove that one.
revoke all on function public.admin_active_sellers_page(text, text, text, text, boolean, boolean, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_active_sellers_page(text, text, text, text, boolean, boolean, text, boolean, integer, integer) to service_role;
revoke all on function public.admin_seller_totals() from public, anon, authenticated;
grant execute on function public.admin_seller_totals() to service_role;
revoke all on function public.admin_all_sellers_page(text, text, text, boolean, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_all_sellers_page(text, text, text, boolean, integer, integer, timestamptz) to service_role;
revoke all on function public.admin_moderation_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_moderation_stats(timestamptz) to service_role;
revoke all on function public.admin_seller_released_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_seller_released_counts(uuid[]) to service_role;
revoke all on function public.admin_review_stats() from public, anon, authenticated;
grant execute on function public.admin_review_stats() to service_role;
revoke all on function public.admin_game_listing_counts() from public, anon, authenticated;
grant execute on function public.admin_game_listing_counts() to service_role;
revoke all on function public.withdrawal_risk_snapshots(uuid[]) from public, anon, authenticated;
grant execute on function public.withdrawal_risk_snapshots(uuid[]) to service_role;
revoke all on function public.admin_withdrawal_totals(text[]) from public, anon, authenticated;
grant execute on function public.admin_withdrawal_totals(text[]) to service_role;
