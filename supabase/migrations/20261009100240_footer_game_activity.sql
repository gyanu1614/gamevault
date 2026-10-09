-- Footer directory signals as ONE aggregate (2026-10-09, Supabase usage cut).
--
-- The footer renders on every page; src/lib/marketplace/gameActivityCache.ts
-- paged up to 30k order + listing rows over PostgREST on every cache miss just
-- to count them per game. This returns one row per game instead.
--
-- Service-role only: no GRANT (new public functions are revoked from anon /
-- authenticated by default — migration 20260913100000), SECURITY INVOKER (the
-- service role reads orders through its own rights), stable, search_path pinned.
create or replace function public.footer_game_activity(
  p_since timestamptz,
  p_statuses text[],
  p_exclude_sellers uuid[] default '{}'
)
returns table (game_id uuid, orders_30d bigint, active_listings bigint)
language sql
stable
set search_path = public
as $$
  with o as (
    select l.game_id, count(*) as n
    from public.orders ord
    join public.listings l on l.id = ord.listing_id
    where ord.status = any (p_statuses)
      and ord.created_at >= p_since
      and l.game_id is not null
      and not (ord.seller_id = any (coalesce(p_exclude_sellers, '{}')))
    group by l.game_id
  ),
  a as (
    select l.game_id, count(*) as n
    from public.listings l
    where l.status = 'active'
      and l.game_id is not null
      and not (l.seller_id = any (coalesce(p_exclude_sellers, '{}')))
    group by l.game_id
  )
  select coalesce(o.game_id, a.game_id), coalesce(o.n, 0), coalesce(a.n, 0)
  from o
  full join a on a.game_id = o.game_id;
$$;

revoke all on function public.footer_game_activity(timestamptz, text[], uuid[]) from public, anon, authenticated;
