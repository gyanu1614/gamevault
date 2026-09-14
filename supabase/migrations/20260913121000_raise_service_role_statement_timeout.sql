-- Raise the per-statement timeout for the service role.
--
-- Same problem, same shape as 20260813120000, which raised anon/authenticated to
-- 30s: the SAB correction pipeline reads layered views
-- (sab_public_price_catalog → sab_market_variant_price_estimates →
-- sab_market_source_variant_estimates → sab_market_clean_listing_evidence →
-- sab_market_listing_candidates) that recompute aggregations over every raw
-- listing on each read. That earlier migration fixed the READ path; the
-- correction path runs as `service_role` and was never covered.
--
-- As of 2026-09-13 it has crossed the ceiling. /api/cron/correct-prices?game=sab
-- fails with "canceling statement due to statement timeout", naming a different
-- view on each attempt, and sab_price_corrections.computed_at has not moved
-- since 2026-09-01 — mutation-level prices are 12 days stale.
--
-- Measured on a shadow seeded to match production (113,758 rows / 36,751
-- active+matched / 76,953 ended): the candidates predicate retains 113,704 of
-- 113,758 rows — 99.95% — because the 30d-active/180d-completed windows exclude
-- almost nothing. A Seq Scan over the whole table is therefore the CORRECT plan,
-- and an index cannot help (verified: a purpose-built partial covering index was
-- never chosen by the planner, idx_scan = 0, and was slower when forced).
--
-- 120s matches the ceiling sab_publish_market_estimates and
-- sab_refresh_price_display already set on themselves, so the pipeline's
-- statement budget is consistent end to end.
--
-- This buys headroom; it is not the fix. At ~3k rows/day the views reach
-- ~1.2-2.5s locally by month 6 and keep climbing linearly, so the correction
-- inputs are being materialized separately (sab_market_evidence_display). This
-- migration is the stop-the-bleeding half of that pair, and stays useful
-- afterwards as the backstop for any remaining heavy service-role read.
--
-- Changes no data and no logic: it only stops Postgres killing a slow-but-valid
-- query. service_role is server-side only (never the browser), so a longer
-- ceiling is not user-facing exposure.

alter role service_role set statement_timeout = '120s';

-- Ask PostgREST to reload so the new setting applies to the live pool at once.
notify pgrst, 'reload config';
