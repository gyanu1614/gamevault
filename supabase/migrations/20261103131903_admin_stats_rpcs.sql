-- ============================================================================
-- Admin numbers from one query each, instead of downloading tables.
--
-- Before (admin speed audit 2026-11-03): the dashboard ran 18 count queries and
-- walked every collected order, 1,000 rows per request, on every visit. Analytics
-- ran 18 more counts and walked every collected order and promo usage again;
-- the orders page walked the orders a third time; the disputes page walked every
-- dispute; the header sent 5 requests a minute per open tab; the applications
-- page sent 6 requests for its tab counts. Nothing was cached.
--
--   1. admin_overview_stats(): every headline number for the dashboard,
--      analytics, orders and disputes screens, in one statement: one pass over
--      each table with COUNT FILTER / SUM. The numbers are the same for every
--      staff member, so the app caches this for 60 seconds (lib/admin/overview-stats).
--      Service role only: the caller checks the staff member first. The status
--      sets come from src/lib/admin/status-sets.ts, the one source of truth.
--   2. admin_header_snapshot(): the admin header's queue badges and the caller's
--      unread notifications, in one call from the browser. Answers only for
--      staff with two-factor (is_admin).
--   3. admin_application_counts(): the applications page's tab counts, one pass.
--
-- Tests: src/test/guards/admin-stats-rpcs.guard.integration.test.ts
-- ============================================================================

begin;

create or replace function public.admin_overview_stats(
  p_today timestamptz,
  p_week timestamptz,
  p_month timestamptz,
  p_prev_month timestamptz,
  p_collected text[],
  p_in_progress text[],
  p_open_disputes text[],
  p_finished_disputes text[]
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with order_rows as (
    select
      o.*,
      status = any (p_collected) as collected,
      -- What DropMarket charged on the order: the buyer's fees plus the seller
      -- fee, which is not a column (subtotal - seller_payout).
      coalesce(platform_fee, 0) + coalesce(payment_processing_fee, 0) + coalesce(vaultshield_tier_fee, 0)
        + (coalesce(subtotal, 0) - coalesce(seller_payout, 0)) as charged
    from public.orders o
  ),
  orders_agg as (
    select
      count(*) as total,
      count(*) filter (where created_at >= p_today) as today,
      count(*) filter (where created_at >= p_week) as week,
      count(*) filter (where created_at >= p_month) as month,
      count(*) filter (where created_at >= p_prev_month and created_at < p_month) as prev_month,
      count(*) filter (where status = any (p_in_progress)) as in_progress,
      count(*) filter (where status = 'completed') as completed,
      count(*) filter (where status = 'disputed') as disputed,
      count(*) filter (where status = 'refunded') as refunded,
      count(*) filter (where is_guest_order) as guest,
      coalesce(sum(total_amount) filter (where collected), 0) as revenue_total,
      coalesce(sum(total_amount) filter (where collected and created_at >= p_today), 0) as revenue_today,
      coalesce(sum(total_amount) filter (where collected and created_at >= p_month), 0) as revenue_month,
      coalesce(sum(total_amount) filter (where collected and created_at >= p_prev_month and created_at < p_month), 0) as revenue_prev_month,
      coalesce(sum(platform_fee) filter (where collected), 0) as fees_total,
      coalesce(sum(charged) filter (where collected), 0) as charged_total,
      coalesce(sum(charged) filter (where collected and created_at >= p_month), 0) as charged_month,
      coalesce(sum(charged) filter (where collected and created_at >= p_prev_month and created_at < p_month), 0) as charged_prev_month,
      coalesce(avg(total_amount) filter (where collected and status = 'completed'), 0) as avg_completed_value,
      count(distinct buyer_id) filter (where collected) as distinct_buyers
    from order_rows
  ),
  daily as (
    select
      to_char(d.day, 'YYYY-MM-DD') as date,
      coalesce(x.charged, 0) as revenue,
      coalesce(x.orders, 0) as orders
    from generate_series(
      (p_today at time zone 'UTC')::date - 29,
      (p_today at time zone 'UTC')::date,
      interval '1 day'
    ) as d(day)
    left join (
      select (created_at at time zone 'UTC')::date as day, sum(charged) as charged, count(*) as orders
      from order_rows
      where collected and created_at >= p_today - interval '29 days'
      group by 1
    ) x on x.day = d.day::date
    order by d.day
  ),
  profiles_agg as (
    select
      count(*) as total,
      count(*) filter (where created_at >= p_today) as today,
      count(*) filter (where created_at >= p_month) as month,
      count(*) filter (where created_at >= p_prev_month and created_at < p_month) as prev_month,
      count(*) filter (where role = 'seller') as sellers
    from public.profiles
  ),
  listings_agg as (
    select
      count(*) as total,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where created_at >= p_month) as month
    from public.listings
  ),
  promos_agg as (
    select count(*) as usages, coalesce(sum(discount_amount), 0) as total_discount
    from public.promo_code_usages
  ),
  disputes_agg as (
    select
      count(*) as total,
      count(*) filter (where status::text = any (p_open_disputes)) as open_all,
      count(*) filter (where status::text = any (p_finished_disputes)) as finished,
      count(*) filter (where status = 'open') as open,
      count(*) filter (where status = 'under_review') as under_review,
      count(*) filter (where status = 'escalated') as escalated,
      count(*) filter (where status in ('awaiting_seller_response', 'awaiting_buyer_response')) as awaiting_response,
      count(*) filter (where created_at >= p_today) as today,
      count(*) filter (where priority = 'urgent' and status::text = any (p_open_disputes)) as urgent_open,
      count(*) filter (where status::text = any (p_finished_disputes) and resolved_at >= p_week) as resolved_week
    from public.disputes
  ),
  applications_agg as (
    select
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'approved') as approved,
      count(*) filter (where status = 'approved' and updated_at >= p_today) as approved_today,
      count(*) filter (where status = 'rejected') as rejected
    from public.seller_applications
  ),
  fraud_agg as (
    select
      count(*) filter (where status = 'open') as open,
      count(*) filter (where status = 'open' and severity = 'high') as high
    from public.fraud_flags
  )
  select jsonb_build_object(
    'orders', (select to_jsonb(orders_agg) from orders_agg),
    'daily', (select coalesce(jsonb_agg(to_jsonb(daily)), '[]'::jsonb) from daily),
    'profiles', (select to_jsonb(profiles_agg) from profiles_agg),
    'listings', (select to_jsonb(listings_agg) from listings_agg),
    'promos', (select to_jsonb(promos_agg) from promos_agg),
    'disputes', (select to_jsonb(disputes_agg) from disputes_agg),
    'applications', (select to_jsonb(applications_agg) from applications_agg),
    'fraud', (select to_jsonb(fraud_agg) from fraud_agg),
    'pending_cancellations', (select count(*) from public.order_cancellation_requests where status = 'pending'),
    'top_sellers', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from (
        select username, total_sales, lifetime_earnings
        from public.profiles
        where role = 'seller'
        order by lifetime_earnings desc nulls last
        limit 5
      ) t
    )
  );
$$;

comment on function public.admin_overview_stats(timestamptz, timestamptz, timestamptz, timestamptz, text[], text[], text[], text[]) is
  'Every headline number for the admin dashboard, analytics, orders and disputes screens in one statement. Service role only; cached 60 s by lib/admin/overview-stats after the caller''s staff check.';

create or replace function public.admin_header_snapshot(p_open_disputes text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then jsonb_build_object(
    'pending_applications', (select count(*) from public.seller_applications where status = 'pending'),
    'open_disputes', (select count(*) from public.disputes where status::text = any (p_open_disputes)),
    'high_fraud', (select count(*) from public.fraud_flags where status = 'open' and severity = 'high'),
    'unread_notifications', (
      select count(*) from public.notifications where user_id = auth.uid() and is_read = false
    ),
    'latest_notifications', (
      select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
      from (
        select *
        from public.notifications
        where user_id = auth.uid() and is_read = false
        order by created_at desc
        limit 5
      ) n
    )
  ) end;
$$;

comment on function public.admin_header_snapshot(text[]) is
  'The admin header in one call: queue badges plus the caller''s unread notifications. NULL for anyone who is not staff with two-factor.';

create or replace function public.admin_application_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where a.status = 'pending'),
    'changes', count(*) filter (where a.status = 'info_requested'),
    'approved', count(*) filter (where a.status = 'approved'),
    'rejected', count(*) filter (where a.status = 'rejected'),
    -- The Restricted tab is the seller's status, not the application's
    -- (getSellerApplications' "restricted" filter).
    'restricted', count(*) filter (where p.seller_status in ('restricted', 'banned'))
  )
  from public.seller_applications a
  join public.profiles p on p.id = a.user_id;
$$;

comment on function public.admin_application_counts() is
  'The applications page''s tab counts in one pass. Service role only, called after the caller''s staff check.';

revoke all on function public.admin_overview_stats(timestamptz, timestamptz, timestamptz, timestamptz, text[], text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.admin_overview_stats(timestamptz, timestamptz, timestamptz, timestamptz, text[], text[], text[], text[]) to service_role;
revoke all on function public.admin_application_counts() from public, anon, authenticated;
grant execute on function public.admin_application_counts() to service_role;
revoke all on function public.admin_header_snapshot(text[]) from public, anon;
grant execute on function public.admin_header_snapshot(text[]) to authenticated;

commit;
