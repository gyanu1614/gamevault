-- ROUTE-014 follow-up: sab_refresh_evidence_display() regressed to 30s+ on prod.
--
-- MEASURED (prod, 2026-09-14, 125,255 raw rows / 26,352 evidence rows):
--   phase            run 1      run 2
--   DELETE            359 ms      92 ms
--   SELECT (view)   13,833 ms  13,299 ms   <- the whole cost
--   INSERT + idx     2,411 ms   2,419 ms
--   TOTAL           16,603 ms  15,810 ms
-- Warm and cold runs are within 5% of each other, so this is not cache.
--
-- WHY THE FUNCTION IS SLOWER THAN A BARE EXPLAIN (6.7s):
-- the same SELECT measured 6.7s standalone WITH a parallel worker. Inside the
-- function the SELECT feeds an INSERT, and a plan that writes cannot use
-- parallel workers -- the whole statement is parallel-unsafe. So the function
-- pays the SERIAL cost of the same plan. Parallelism cannot be re-enabled here;
-- the serial path has to get cheaper instead.
--
-- ROOT CAUSE: sab_market_clean_listing_evidence references
-- sab_market_listing_candidates TWICE -- once for the rows, once for the
-- `bounds` CTE that computes the per-variant quartiles. PG14+ inlines the
-- candidates view into both arms, so sab_market_raw_listings is sequentially
-- scanned twice with a byte-identical filter. The prod plan shows both scans:
-- rows=16174/loop, Rows Removed by Filter: 46454, at 2.09s and 4.38s.
--
-- FIX: evaluate the candidate set ONCE into a CTE marked MATERIALIZED, then
-- feed both the bounds aggregation and the outer join from that single result.
-- This is the same query, same output -- only the number of raw scans changes.
--
-- NOT DONE, deliberately:
--   * No new index. The candidates predicate retains ~99.95% of matched rows,
--     so Seq Scan remains the correct plan; 20260913130000 measured a
--     purpose-built partial index at idx_scan = 0 and slower when forced.
--   * No TRUNCATE / staging-table swap. DELETE is 92-359ms of a 16s run --
--     not the problem -- and TRUNCATE takes an AccessExclusiveLock, which is
--     exactly what 20260913130000 rejected REFRESH MATERIALIZED VIEW for.
--     Delete-then-insert in one transaction keeps the invariant that readers
--     see the old snapshot or the new one, never a partial one, and that a
--     FAILED refresh leaves the previous snapshot intact.

-- work_mem: the prod plan sorts 1594kB against a 2184kB work_mem -- it fits,
-- but only just. Crossing that line turns the sort into an external merge and
-- costs a step change in runtime (the 20260913130000 notes recorded exactly
-- that: external merge 12568kB + 7456kB + 2960kB). The GroupAggregate feeding
-- percentile_cont also holds its tuplesorts in memory. Give this one function
-- room rather than raising work_mem globally, where it is multiplied by every
-- concurrent connection.
create or replace function public.sab_refresh_evidence_display()
returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '180s'
set work_mem = '64MB'
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
  -- Inlined from sab_market_clean_listing_evidence, with the candidate set
  -- hoisted into a MATERIALIZED CTE so the raw table is scanned ONCE. The
  -- projection, join keys and IQR-fence predicate below are otherwise
  -- byte-identical to the view; the view itself is left in place for ad-hoc
  -- reads and is still the contract this table's columns follow.
  with candidates as materialized (
    select
      id, source_id, source_slug, source_name, source_weight,
      external_listing_id, listing_type, listing_status,
      brainrot_id, mutation_id, unit_price_usd, observed_at, fetched_at,
      minimum_cash_value_usd, market_tier, market_tier_rank
    from public.sab_market_listing_candidates
  ),
  bounds as (
    select
      candidates.source_id,
      candidates.brainrot_id,
      candidates.mutation_id,
      candidates.listing_type,
      count(*) as evidence_count,
      percentile_cont(0.25::double precision) within group (order by (candidates.unit_price_usd)::double precision) as q1_usd,
      percentile_cont(0.50::double precision) within group (order by (candidates.unit_price_usd)::double precision) as median_usd,
      percentile_cont(0.75::double precision) within group (order by (candidates.unit_price_usd)::double precision) as q3_usd
    from candidates
    group by candidates.source_id, candidates.brainrot_id, candidates.mutation_id, candidates.listing_type
  )
  select
    candidate.id,
    candidate.source_id,
    candidate.source_slug,
    candidate.source_name,
    candidate.source_weight,
    candidate.external_listing_id,
    candidate.listing_type,
    candidate.listing_status,
    candidate.brainrot_id,
    candidate.mutation_id,
    candidate.unit_price_usd,
    candidate.observed_at,
    candidate.fetched_at,
    candidate.minimum_cash_value_usd,
    bounds.evidence_count,
    bounds.q1_usd,
    bounds.median_usd,
    bounds.q3_usd,
    candidate.market_tier,
    candidate.market_tier_rank,
    (bounds.q3_usd - bounds.q1_usd) / nullif(bounds.median_usd, (0)::double precision) as relative_iqr,
    now()
  from candidates candidate
  join bounds
    on bounds.source_id = candidate.source_id
   and bounds.brainrot_id = candidate.brainrot_id
   and bounds.mutation_id = candidate.mutation_id
   and bounds.listing_type = candidate.listing_type
  where bounds.evidence_count < 4
     or (
          (candidate.unit_price_usd)::double precision
            >= greatest(
                 (0.01)::double precision,
                 bounds.q1_usd - ((1.5)::double precision * greatest(bounds.q3_usd - bounds.q1_usd, bounds.median_usd * (0.15)::double precision))
               )
          and (candidate.unit_price_usd)::double precision
            <= bounds.q3_usd + ((1.5)::double precision * greatest(bounds.q3_usd - bounds.q1_usd, bounds.median_usd * (0.15)::double precision))
        );

  get diagnostics row_count = row_count;
  return row_count;
end;
$$;

-- Signature is unchanged, but CREATE OR REPLACE FUNCTION does not reset ACLs
-- while a DROP would. State the posture explicitly anyway, per CLAUDE.md /
-- 20260913100000: new and replaced functions in `public` are service-role-only.
revoke all on function public.sab_refresh_evidence_display() from public, anon, authenticated;
grant execute on function public.sab_refresh_evidence_display() to service_role;

comment on function public.sab_refresh_evidence_display() is
  'Rebuilds sab_market_evidence_display in one transaction. Scans '
  'sab_market_raw_listings once via a MATERIALIZED candidates CTE; the plan is '
  'serial because INSERT..SELECT is parallel-unsafe. Returns rows written.';
