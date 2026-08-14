-- Materialized display catalog for SAB prices.
--
-- WHY: every price page reads sab_public_price_catalog_corrected, a VIEW that
-- recomputes a multi-level aggregation over ~64k raw listings on every read
-- (measured 2–27s as the anon role). Even a single-item filtered read must
-- compute the whole aggregation first, then filter. Under the statement timeout
-- this was cancelled (57014) → pages rendered "No data yet"; when it did return
-- it was far too slow. The data changes only once per crawl, so recomputing it
-- per request is pure waste.
--
-- FIX: materialize the corrected catalog into a plain TABLE, refreshed once at
-- the end of each crawl (by the reprice step). Page reads become an indexed
-- point/range lookup (~5ms) with no aggregation and no timeout risk.
--
-- A plain table refreshed by a function (not a MATERIALIZED VIEW) is chosen so
-- reads never block on REFRESH and we reuse the existing post-crawl reprice hook.

begin;

create table if not exists public.sab_price_display (
  brainrot_id uuid not null,
  brainrot_name text,
  brainrot_slug text,
  rarity text,
  image_url text,

  mutation_id uuid not null,
  mutation_name text,
  mutation_slug text,

  market_value_usd numeric(12, 2),
  market_low_usd numeric(12, 2),
  market_high_usd numeric(12, 2),

  confidence_label text,
  external_sample_size integer,
  source_count integer,

  price_updated_at timestamptz,

  is_trade_ready boolean,
  is_public_estimate boolean,

  is_anchored boolean,
  correction_reason text,
  anchor_usd numeric(12, 2),
  cohort_size integer,

  cheapest_usd numeric(12, 2),
  average_usd numeric(12, 2),

  -- When this row was last materialized (for staleness display / debugging).
  refreshed_at timestamptz not null default now(),

  primary key (brainrot_id, mutation_slug)
);

-- Item page: look up one brainrot's rows by slug.
create index if not exists sab_price_display_brainrot_slug_idx
  on public.sab_price_display (brainrot_slug);

-- Values grid + homepage: the default-mutation rows only.
create index if not exists sab_price_display_default_idx
  on public.sab_price_display (mutation_slug)
  where mutation_slug = 'default';

-- Values switcher: rows that actually have a cheapest price.
create index if not exists sab_price_display_priced_idx
  on public.sab_price_display (brainrot_id)
  where cheapest_usd is not null;

-- Same read audience as the source view.
alter table public.sab_price_display enable row level security;

drop policy if exists sab_price_display_read on public.sab_price_display;
create policy sab_price_display_read
  on public.sab_price_display
  for select
  to anon, authenticated, service_role
  using (true);

-- ── Refresh function ─────────────────────────────────────────────────────────
-- Recompute the whole display set from the corrected view and swap it in. Runs
-- once per crawl (post-reprice), NOT on the request path, so its cost is paid
-- off the hot path. SECURITY DEFINER + raised statement_timeout so the single
-- heavy compute has headroom; the delete+insert runs in one implicit function
-- transaction so readers never see a half-populated table.
create or replace function public.sab_refresh_price_display()
returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare
  row_count bigint;
begin
  -- Full refresh: the corrected view is the source of truth and the row set is
  -- small (~3k). Delete-all + insert inside the function's transaction is atomic
  -- to readers (no partial state) and avoids per-row conflict handling.
  delete from public.sab_price_display;

  insert into public.sab_price_display (
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, refreshed_at
  )
  select
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, now()
  from public.sab_public_price_catalog_corrected;

  get diagnostics row_count = row_count;
  return row_count;
end;
$$;

revoke all on function public.sab_refresh_price_display() from public, anon, authenticated;
grant execute on function public.sab_refresh_price_display() to service_role;

comment on table public.sab_price_display is
  'Materialized snapshot of sab_public_price_catalog_corrected. Refreshed once '
  'per crawl by sab_refresh_price_display(); read by all price pages for O(index) '
  'lookups instead of recomputing the aggregation per request.';

-- Populate immediately so reads have data the moment this migration lands.
select public.sab_refresh_price_display();

commit;
