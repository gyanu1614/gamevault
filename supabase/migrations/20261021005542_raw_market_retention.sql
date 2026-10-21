-- Raw market tables stay bounded (2026-10-20 usage audit, B2/B4/C4).
--
-- Live DB 793 MB on a 500 MB plan:
--   * values_raw_listings (MM2 + Steal An Egg) 188 MB. Every crawl inserts a
--     full copy; the pipeline reads only is_active rows from the last crawl
--     window (src/lib/pricing/games/values-pipeline.ts), and nothing deleted
--     the rest.
--   * adopt_me_market_raw_listings 79 MB. Its unique key includes the price, so
--     every price change ends a row and starts a new one; the reprice reads only
--     'active' rows (src/lib/pricing/games/adopt-me.ts), and ended rows were kept.
--   * sab_roll_up_raw_listings filtered on
--     `(observed_at at time zone 'utc')::date < cutoff`, which the observed_at
--     index cannot serve: every night two full scans of the 300 MB table.
--
-- Now:
--   1. sab_roll_up_raw_listings compares observed_at to the cutoff instant
--      (midnight UTC of the cutoff day). Same rows, same per-day grouping.
--   2. raw_market_prune(values_inactive_days, adopt_me_ended_days) deletes
--      inactive values rows older than 3 days and Adopt Me rows that ended
--      more than 7 days ago. Called nightly by scripts/roll-up-raw-listings.mjs.

-- ── 1. SAB rollup, sargable ─────────────────────────────────────────────────
create or replace function public.sab_roll_up_raw_listings(retain_days integer default 30)
returns table (days_rolled integer, rows_pruned bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff date;
  -- Midnight UTC of the cutoff day: observed_at < v_cutoff_at is exactly
  -- (observed_at at time zone 'utc')::date < cutoff, and can use the index.
  v_cutoff_at timestamptz;
  pruned bigint;
  rolled integer;
begin
  if retain_days is null or retain_days < 1 then
    raise exception 'retain_days must be >= 1, got %', retain_days;
  end if;

  cutoff := (now() at time zone 'utc')::date - retain_days;
  v_cutoff_at := cutoff::timestamp at time zone 'utc';

  with rolled_up as (
    insert into public.sab_raw_listing_daily as target (
      summary_date, brainrot_id, mutation_id,
      listing_count, active_count,
      min_unit_price_usd, max_unit_price_usd,
      avg_unit_price_usd, median_unit_price_usd
    )
    select
      (observed_at at time zone 'utc')::date,
      brainrot_id,
      mutation_id,
      count(*),
      count(*) filter (where listing_status = 'active'),
      min(unit_price_usd),
      max(unit_price_usd),
      round(avg(unit_price_usd), 2),
      round(
        percentile_cont(0.5) within group (order by unit_price_usd)::numeric,
        2
      )
    from public.sab_market_raw_listings
    where observed_at < v_cutoff_at
    group by 1, 2, 3
    on conflict (
      summary_date,
      coalesce(brainrot_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(mutation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) do update
      set listing_count         = excluded.listing_count,
          active_count          = excluded.active_count,
          min_unit_price_usd    = excluded.min_unit_price_usd,
          max_unit_price_usd    = excluded.max_unit_price_usd,
          avg_unit_price_usd    = excluded.avg_unit_price_usd,
          median_unit_price_usd = excluded.median_unit_price_usd
    returning summary_date
  )
  select count(distinct summary_date) into rolled from rolled_up;

  -- Only delete what is now summarised: the rollup above covers EVERY row in
  -- the window, matched or not (`observed_at < x` also excludes NULLs, as the
  -- old `observed_at is not null` did).
  delete from public.sab_market_raw_listings
  where observed_at < v_cutoff_at;

  get diagnostics pruned = row_count;

  return query select coalesce(rolled, 0), coalesce(pruned, 0);
end;
$$;

revoke all on function public.sab_roll_up_raw_listings(integer) from public, anon, authenticated;
grant execute on function public.sab_roll_up_raw_listings(integer) to service_role;

-- ── 2. Values + Adopt Me raw history ────────────────────────────────────────
create or replace function public.raw_market_prune(
  values_inactive_days integer default 3,
  adopt_me_ended_days integer default 7
)
returns table (values_rows_pruned bigint, adopt_me_rows_pruned bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_values bigint;
  v_adopt_me bigint;
begin
  if values_inactive_days is null or values_inactive_days < 1
     or adopt_me_ended_days is null or adopt_me_ended_days < 1 then
    raise exception 'raw_market_prune: windows must be >= 1 day (got %, %)',
      values_inactive_days, adopt_me_ended_days;
  end if;

  -- Active rows are never touched: they are the current market.
  delete from public.values_raw_listings
  where is_active = false
    and observed_at < now() - make_interval(days => values_inactive_days);
  get diagnostics v_values = row_count;

  delete from public.adopt_me_market_raw_listings
  where listing_status = 'ended'
    and coalesce(ended_at, collected_at) < now() - make_interval(days => adopt_me_ended_days);
  get diagnostics v_adopt_me = row_count;

  return query select v_values, v_adopt_me;
end;
$$;

comment on function public.raw_market_prune(integer, integer) is
  'Deletes values_raw_listings rows inactive for N days (default 3) and adopt_me_market_raw_listings rows ended N days ago (default 7). Pricing reads only active rows.';

revoke all on function public.raw_market_prune(integer, integer) from public, anon, authenticated;
grant execute on function public.raw_market_prune(integer, integer) to service_role;
