-- ROUTE-014: materialize the correction pipeline's evidence input.
--
-- WHY: 959bc23 materialized the PAGE reads into sab_price_display (27s → 100ms)
-- but runSabCorrection was never migrated — it still reads the live recompute
-- views. Those have now outgrown the statement timeout: correct-prices?game=sab
-- fails with 57014 naming a different view each attempt, and
-- sab_price_corrections.computed_at has not moved since 2026-09-01.
--
-- sab_market_clean_listing_evidence is the shared bottleneck. Measured on a
-- shadow matching production (113,758 raw rows):
--   * Parallel Seq Scan over the whole base table, TWICE — once for the rows and
--     once for the `bounds` CTE that computes the per-variant quartiles.
--   * Nested WindowAgg/GroupAggregate layers spilling to disk
--     (external merge 12568kB + 7456kB + 2960kB).
-- At the projected 6-month size (653,758 rows) the two reads take 1.19s and
-- 2.05s and climb linearly.
--
-- An index does NOT fix this and was deliberately not shipped: the candidates
-- predicate retains 113,704 of 113,758 rows (99.95%), so a Seq Scan is the
-- correct plan. A purpose-built partial covering index was measured with
-- idx_scan = 0 and was slower when forced.
--
-- Archiving ended rows does not fix it either: it deletes completed-sale rows,
-- which are legitimate pricing evidence (33% of candidates), and at 6-month size
-- the catalog got WORSE (2.05s → 2.52s) because cost tracks the surviving ACTIVE
-- rows.
--
-- SHAPE: a plain table + refresh function, matching sab_price_display rather
-- than a MATERIALIZED VIEW. REFRESH MATERIALIZED VIEW (non-concurrent) takes an
-- AccessExclusiveLock that would block readers mid-crawl; CONCURRENTLY needs a
-- unique index and is slower. Delete-then-insert inside one function runs in a
-- single transaction, so readers see either the old snapshot or the new one and
-- never a partial state — and a failed refresh leaves the previous snapshot
-- intact rather than emptying the table.
--
-- SIZE: this tracks the candidates set, which PLATEAUS at ~577k rows because of
-- the 30d-active/180d-completed windows (~220 MB + ~40 MB indexes). Unlike the
-- raw table it does not grow without bound.

create table if not exists public.sab_market_evidence_display (
  id uuid primary key,
  source_id uuid not null,
  source_slug text,
  source_name text,
  source_weight numeric(5,2),
  external_listing_id text,
  listing_type text,
  listing_status text,
  brainrot_id uuid not null,
  mutation_id uuid not null,
  unit_price_usd numeric(12,2),
  observed_at timestamptz,
  fetched_at timestamptz,
  minimum_cash_value_usd numeric,
  evidence_count bigint,
  q1_usd double precision,
  median_usd double precision,
  q3_usd double precision,
  market_tier text,
  market_tier_rank integer,
  relative_iqr double precision,
  -- ROUTE-014: when this snapshot was built. The freshness guard reads
  -- max(refreshed_at); a stale value means a refresh has been failing.
  refreshed_at timestamptz not null default now()
);

-- The correction reads the whole table, and source_variant_estimates groups by
-- (brainrot_id, mutation_id, source_id, listing_type) — index the group keys so
-- the downstream views aggregate without re-sorting from scratch.
create index if not exists sab_market_evidence_display_variant_idx
  on public.sab_market_evidence_display (brainrot_id, mutation_id);
create index if not exists sab_market_evidence_display_group_idx
  on public.sab_market_evidence_display (brainrot_id, mutation_id, source_id, listing_type);
create index if not exists sab_market_evidence_display_refreshed_idx
  on public.sab_market_evidence_display (refreshed_at desc);

alter table public.sab_market_evidence_display enable row level security;

-- Read-only to signed-in clients; only the service role writes it (via the
-- refresh function). Mirrors sab_price_display's posture.
drop policy if exists sab_market_evidence_display_read on public.sab_market_evidence_display;
create policy sab_market_evidence_display_read
  on public.sab_market_evidence_display
  for select to authenticated, service_role using (true);

-- Rebuild the snapshot from the live view. Returns the row count written.
--
-- ROUTE-013 lesson: the DELETE carries a predicate. This project's roles run
-- with safe-update mode, which rejects an unqualified DELETE with SQLSTATE 21000
-- even inside a plpgsql SECURITY DEFINER body — that is exactly what froze
-- sab_price_display for a month. `brainrot_id is not null` is true for every row
-- (the column is NOT NULL), so this still clears the table.
create or replace function public.sab_refresh_evidence_display()
returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '180s'
as $$
declare
  row_count bigint;
begin
  delete from public.sab_market_evidence_display
  where brainrot_id is not null;

  insert into public.sab_market_evidence_display (
    id, source_id, source_slug, source_name, source_weight,
    external_listing_id, listing_type, listing_status,
    brainrot_id, mutation_id, unit_price_usd, observed_at, fetched_at,
    minimum_cash_value_usd, evidence_count, q1_usd, median_usd, q3_usd,
    market_tier, market_tier_rank, relative_iqr, refreshed_at
  )
  select
    id, source_id, source_slug, source_name, source_weight,
    external_listing_id, listing_type, listing_status,
    brainrot_id, mutation_id, unit_price_usd, observed_at, fetched_at,
    minimum_cash_value_usd, evidence_count, q1_usd, median_usd, q3_usd,
    market_tier, market_tier_rank, relative_iqr, now()
  from public.sab_market_clean_listing_evidence;

  get diagnostics row_count = row_count;
  return row_count;
end;
$$;

-- Per CLAUDE.md / migration 20260913100000: new functions in `public` are
-- service-role-only. State it explicitly rather than relying on the default.
revoke all on function public.sab_refresh_evidence_display() from public, anon, authenticated;
grant execute on function public.sab_refresh_evidence_display() to service_role;

comment on table public.sab_market_evidence_display is
  'Materialized snapshot of sab_market_clean_listing_evidence. Refreshed once '
  'per crawl by sab_refresh_evidence_display() (and by correct-prices as a '
  'backstop); read by runSabCorrection and by sab_market_source_variant_estimates '
  'instead of recomputing the aggregation over every raw listing per read.';

-- Repoint the one SQL dependent at the snapshot. Definition is otherwise
-- byte-identical to the live one (captured with pg_get_viewdef); only the FROM
-- target changes, so the estimates chain and sab_public_price_catalog above it
-- now read an indexed table instead of recomputing the view.
create or replace view public.sab_market_source_variant_estimates
with (security_invoker = true) as
WITH ranked AS (
         SELECT evidence.id,
            evidence.source_id,
            evidence.source_slug,
            evidence.source_name,
            evidence.source_weight,
            evidence.external_listing_id,
            evidence.listing_type,
            evidence.listing_status,
            evidence.brainrot_id,
            evidence.mutation_id,
            evidence.unit_price_usd,
            evidence.observed_at,
            evidence.fetched_at,
            evidence.minimum_cash_value_usd,
            evidence.evidence_count,
            evidence.q1_usd,
            evidence.median_usd,
            evidence.q3_usd,
            evidence.market_tier,
            evidence.market_tier_rank,
            evidence.relative_iqr,
                CASE evidence.listing_type
                    WHEN 'completed_sale'::text THEN 1
                    WHEN 'active_listing'::text THEN 2
                    ELSE 9
                END AS evidence_rank,
            min(
                CASE evidence.listing_type
                    WHEN 'completed_sale'::text THEN 1
                    WHEN 'active_listing'::text THEN 2
                    ELSE 9
                END) OVER (PARTITION BY evidence.source_id, evidence.brainrot_id, evidence.mutation_id) AS best_evidence_rank
           FROM sab_market_evidence_display evidence
        ), best_evidence AS (
         SELECT ranked.id,
            ranked.source_id,
            ranked.source_slug,
            ranked.source_name,
            ranked.source_weight,
            ranked.external_listing_id,
            ranked.listing_type,
            ranked.listing_status,
            ranked.brainrot_id,
            ranked.mutation_id,
            ranked.unit_price_usd,
            ranked.observed_at,
            ranked.fetched_at,
            ranked.minimum_cash_value_usd,
            ranked.evidence_count,
            ranked.q1_usd,
            ranked.median_usd,
            ranked.q3_usd,
            ranked.market_tier,
            ranked.market_tier_rank,
            ranked.relative_iqr,
            ranked.evidence_rank,
            ranked.best_evidence_rank
           FROM ranked
          WHERE ranked.evidence_rank = ranked.best_evidence_rank
        ), aggregated AS (
         SELECT best_evidence.source_id,
            best_evidence.source_slug,
            best_evidence.source_name,
            best_evidence.source_weight,
            best_evidence.brainrot_id,
            best_evidence.mutation_id,
                CASE min(best_evidence.evidence_rank)
                    WHEN 1 THEN 'completed_sale'::text
                    WHEN 2 THEN 'active_listing'::text
                    ELSE 'unknown'::text
                END AS evidence_type,
            percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY (best_evidence.unit_price_usd::double precision))::numeric(12,2) AS median_usd,
            percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (best_evidence.unit_price_usd::double precision))::numeric(12,2) AS low_usd,
            percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (best_evidence.unit_price_usd::double precision))::numeric(12,2) AS high_usd,
            count(*)::integer AS sample_count,
            max(best_evidence.observed_at) AS latest_observed_at,
            best_evidence.market_tier,
            best_evidence.market_tier_rank
           FROM best_evidence
          GROUP BY best_evidence.source_id, best_evidence.source_slug, best_evidence.source_name, best_evidence.source_weight, best_evidence.brainrot_id, best_evidence.mutation_id, best_evidence.market_tier, best_evidence.market_tier_rank
        )
 SELECT source_id,
    source_slug,
    source_name,
    source_weight,
    brainrot_id,
    mutation_id,
    evidence_type,
    median_usd,
    low_usd,
    high_usd,
    sample_count,
    latest_observed_at,
    market_tier,
    market_tier_rank,
    (high_usd - low_usd) / NULLIF(median_usd, 0::numeric) AS cluster_spread_ratio,
    evidence_type = 'active_listing'::text AND sample_count >= 10 AND ((high_usd - low_usd) / NULLIF(median_usd, 0::numeric)) <= 0.35 AS is_strong_active_cluster
   FROM aggregated;
