-- Daily immutable price-history snapshots for SAB items.
--
-- Why this exists: the public price catalog (sab_public_price_catalog /
-- sab_public_price_catalog_rows) is entirely view-computed and always reflects
-- "now". There is no historical record, and price history CANNOT be backfilled.
-- This table captures one immutable row per (brainrot, mutation, day) so we can
-- build trend charts, "updated daily" freshness signals, and X-vs-Y history.
--
-- Source of truth: sab_public_price_catalog_rows() — the exact merged value the
-- public sees (verified trade prices first, marketplace estimates filling gaps).
-- Snapshotting from there guarantees the history line matches the displayed price.

begin;

-- ============================================================
-- Snapshot table (one row per item/mutation/day, immutable)
-- ============================================================

create table if not exists public.sab_price_history (
  id uuid primary key default gen_random_uuid(),

  brainrot_id uuid not null
    references public.sab_brainrots(id)
    on delete cascade,

  mutation_id uuid not null
    references public.sab_mutations(id)
    on delete cascade,

  -- The calendar day this snapshot represents (UTC). One per item/mutation/day.
  history_date date not null,

  -- Displayed value that day. market_value_usd is the merged median estimate;
  -- low/high are the range. Named to match the agreed plan vocabulary
  -- (cheapest_active / median_sale) while sourcing from the public catalog.
  median_usd numeric(12, 2) not null,
  low_usd numeric(12, 2) not null,
  high_usd numeric(12, 2) not null,

  -- Evidence behind the value that day.
  listing_count integer not null default 0,
  source_count integer not null default 0,
  confidence_label text not null default 'low',

  is_trade_ready boolean not null default false,
  is_public_estimate boolean not null default false,

  -- When the underlying observations were last refreshed (from the catalog),
  -- distinct from when we captured the snapshot row.
  price_updated_at timestamptz,
  captured_at timestamptz not null default now(),

  -- Immutability: never two rows for the same variant on the same day.
  unique (brainrot_id, mutation_id, history_date)
);

-- Time-series read pattern: "give me this variant's last N days".
create index if not exists
  sab_price_history_variant_time_idx
on public.sab_price_history (
  brainrot_id,
  mutation_id,
  history_date desc
);

-- "What did the whole catalog look like on day X".
create index if not exists
  sab_price_history_date_idx
on public.sab_price_history (
  history_date desc
);

alter table public.sab_price_history
enable row level security;

-- Public charts read history directly; writes stay locked to service_role
-- via the capture function below. Historical rows are read-only to clients.
revoke all
on public.sab_price_history
from public;

grant select
on public.sab_price_history
to anon, authenticated, service_role;

create policy sab_price_history_public_read
on public.sab_price_history
for select
to anon, authenticated
using (true);

comment on table public.sab_price_history is
  'Immutable daily price history for SAB variants, captured from '
  'sab_public_price_catalog_rows(). One row per (brainrot, mutation, day). '
  'Cannot be backfilled — the daily cron is the only writer.';

-- ============================================================
-- Capture function — idempotent per day, service_role only
-- ============================================================

create or replace function public.sab_capture_price_history(
  p_date date default (now() at time zone 'utc')::date
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  captured_count bigint;
begin
  insert into public.sab_price_history (
    brainrot_id,
    mutation_id,
    history_date,
    median_usd,
    low_usd,
    high_usd,
    listing_count,
    source_count,
    confidence_label,
    is_trade_ready,
    is_public_estimate,
    price_updated_at
  )
  select
    catalog.brainrot_id,
    catalog.mutation_id,
    p_date,
    catalog.market_value_usd,
    catalog.market_low_usd,
    catalog.market_high_usd,
    coalesce(catalog.external_sample_size, 0),
    coalesce(catalog.source_count, 0),
    coalesce(catalog.confidence_label, 'low'),
    coalesce(catalog.is_trade_ready, false),
    coalesce(catalog.is_public_estimate, false),
    catalog.price_updated_at
  from public.sab_public_price_catalog_rows() catalog
  where catalog.market_value_usd >= 1.00

  -- Idempotent: re-running the same day refreshes that day's values but never
  -- creates duplicates. Past days remain whatever they were first captured as
  -- unless the job re-runs on the same calendar day.
  on conflict (brainrot_id, mutation_id, history_date)
  do update set
    median_usd = excluded.median_usd,
    low_usd = excluded.low_usd,
    high_usd = excluded.high_usd,
    listing_count = excluded.listing_count,
    source_count = excluded.source_count,
    confidence_label = excluded.confidence_label,
    is_trade_ready = excluded.is_trade_ready,
    is_public_estimate = excluded.is_public_estimate,
    price_updated_at = excluded.price_updated_at,
    captured_at = now();

  get diagnostics captured_count = row_count;

  return captured_count;
end;
$$;

revoke all
on function public.sab_capture_price_history(date)
from public, anon, authenticated;

grant execute
on function public.sab_capture_price_history(date)
to service_role;

comment on function public.sab_capture_price_history(date) is
  'Captures today''s public catalog into sab_price_history. Idempotent per '
  'calendar day. Called by the daily /api/cron/snapshot-sab-prices job.';

notify pgrst, 'reload schema';

commit;
