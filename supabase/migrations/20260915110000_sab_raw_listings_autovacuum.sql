-- ROUTE-014 follow-up 2: stop sab_market_raw_listings from re-bloating.
--
-- MEASURED ON PROD 2026-09-15, before any vacuum:
--   select count(*)            9,436 ms
--   Heap Fetches              80,640   (on an INDEX ONLY scan of 125,745 rows)
--   Buffers                   81,208
--   pg_table_size                204 MB
--   pages_per_row              0.2073  (~20x what this row shape needs)
--   n_dead_tup                18,160 / 126,132 live = 14%
--   last_vacuum                 null,  autovacuum_count = 196
--
-- AFTER a plain VACUUM (ANALYZE):
--   select count(*)              685 ms   (13.8x)
--   Heap Fetches                   0
--   Buffers                      633      (128x fewer pages read)
--   n_dead_tup                     0
--
-- WHY IT GOT THIS BAD: autovacuum had run 196 times and never fixed it. The
-- default autovacuum_vacuum_scale_factor of 0.2 means a vacuum is only
-- triggered at ~20% dead tuples; this table sat at 14% -- permanently under
-- the threshold -- while the crawl's continuous insert/update churn kept
-- dirtying the visibility map. The VM never got re-marked all-visible, so
-- every index-only scan degraded into a heap-fetching scan and every seq scan
-- read ~26k mostly-empty pages. That is the real cost behind the slow refresh;
-- 20260915100000 (the MATERIALIZED CTE fold) halved the number of scans, but
-- each scan was reading 128x more pages than the data warranted.
--
-- THE FIX: trigger vacuum at 2% dead instead of 20%, analyze at 1%, and let
-- the worker run with a smaller cost delay so it finishes promptly. At ~126k
-- rows that means a vacuum every ~2,500 dead tuples rather than ~25,000.
--
-- These are per-table reloptions, so they do not touch the cluster-wide
-- autovacuum settings that every other table relies on.
--
-- NOTE: this migration sets the policy going forward. It deliberately does NOT
-- run VACUUM -- VACUUM cannot run inside a transaction block, and migrations
-- are applied in one. The one-off cleanup was run by hand against prod on
-- 2026-09-15; any environment restored from a dump before that date should be
-- vacuumed once manually:
--     VACUUM (ANALYZE) public.sab_market_raw_listings;
alter table public.sab_market_raw_listings set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 2
);

comment on table public.sab_market_raw_listings is
  'Raw crawled marketplace listings. Autovacuum is tuned per-table '
  '(scale_factor 0.02) because the crawl churn keeps the visibility map dirty '
  'at a dead-tuple ratio below the 0.2 default threshold, which let the table '
  'bloat to 20x its working size and made every scan read 128x the pages. '
  'See migration 20260915110000.';
