-- SAB raw-listing retention: roll old rows into a daily summary, then prune.
--
-- WHY. sab_market_raw_listings grew from ~90k rows (2026-09-14) to ~137k in
-- five days. That growth is what pushed the repricing read past the Vercel
-- function budget and froze prices behind a green workflow. Repricing has since
-- moved to the runner and now reads only active+matched rows, but the table
-- keeps growing forever, and every read over it — the correction, the expiry
-- scan, the freshness probe — gets slower with it.
--
-- Nothing reads a 30-day-old raw listing row by row. What IS worth keeping is
-- the shape of that history: per item, per mutation, per day, what the market
-- looked like. So we roll it up and drop the detail.
--
-- The rollup is idempotent and the prune only ever touches rows already
-- summarised, so a re-run is safe and a half-finished run self-heals.

create table if not exists public.sab_raw_listing_daily (
  summary_date       date        not null,
  -- Nullable on purpose: the parse trigger sets brainrot_id to NULL when a
  -- listing title matches no brainrot. Those rows are still real market
  -- volume, and pruning them without a summary would be silent data loss.
  brainrot_id        uuid,
  mutation_id        uuid,
  listing_count      integer     not null,
  active_count       integer     not null,
  min_unit_price_usd numeric(12, 2),
  max_unit_price_usd numeric(12, 2),
  avg_unit_price_usd numeric(12, 2),
  -- The median is what the pricing model actually cares about; keeping it means
  -- a future backfill can rebuild a price history without the raw rows.
  median_unit_price_usd numeric(12, 2),
  created_at         timestamptz not null default now()
);

comment on table public.sab_raw_listing_daily is
  'Daily rollup of sab_market_raw_listings, kept after the raw rows are pruned at 30 days.';

-- NULL never equals NULL, so a plain unique constraint over nullable columns
-- would allow unlimited duplicates and break idempotency. Index the
-- coalesced tuple instead, so every (day, item, mutation) — matched or not —
-- has exactly one row and ON CONFLICT can find it.
create unique index if not exists sab_raw_listing_daily_key
  on public.sab_raw_listing_daily (
    summary_date,
    coalesce(brainrot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(mutation_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists sab_raw_listing_daily_brainrot_idx
  on public.sab_raw_listing_daily (brainrot_id, summary_date desc);

-- Supports the prune's range delete and the rollup's window scan.
create index if not exists sab_market_raw_listings_observed_at_idx
  on public.sab_market_raw_listings (observed_at);

alter table public.sab_raw_listing_daily enable row level security;

-- Service-role only: this is an internal analytics rollup, not public data.
-- No policy is created, so RLS denies every anon/authenticated read while the
-- service role bypasses it (migration 20260913100000's posture).

/**
 * Roll every day older than `retain_days` into the summary, then delete the
 * raw rows for those days.
 *
 * Returns one row: how many days were summarised and how many raw rows went.
 */
create or replace function public.sab_roll_up_raw_listings(retain_days integer default 30)
returns table (days_rolled integer, rows_pruned bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff date;
  pruned bigint;
  rolled integer;
begin
  if retain_days is null or retain_days < 1 then
    raise exception 'retain_days must be >= 1, got %', retain_days;
  end if;

  cutoff := (now() at time zone 'utc')::date - retain_days;

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
    where observed_at is not null
      and (observed_at at time zone 'utc')::date < cutoff
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

  -- Only delete what is now summarised. The rollup above covers EVERY row in
  -- the window, including unmatched ones (brainrot_id IS NULL), so this cannot
  -- drop a row whose volume was never recorded.
  delete from public.sab_market_raw_listings
  where observed_at is not null
    and (observed_at at time zone 'utc')::date < cutoff;

  get diagnostics pruned = row_count;

  return query select coalesce(rolled, 0), coalesce(pruned, 0);
end;
$$;

comment on function public.sab_roll_up_raw_listings(integer) is
  'Rolls sab_market_raw_listings older than retain_days into sab_raw_listing_daily, then prunes them.';

-- Service-role only (migration 20260913100000 revoked the default grant, but be
-- explicit: this function deletes rows and must never be callable from a
-- browser session).
revoke all on function public.sab_roll_up_raw_listings(integer) from public, anon, authenticated;
