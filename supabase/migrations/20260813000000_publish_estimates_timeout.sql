-- Give sab_publish_market_estimates() room to run.
--
-- The function re-aggregates over the whole listings dataset (via the
-- sab_market_variant_price_estimates view chain) and upserts the result. As
-- listing volume grew, a single call started intermittently exceeding the
-- default per-statement timeout (57014 → 500), which failed the crawl's import
-- step. The importer now calls this ONCE per crawl instead of once per 500-row
-- batch (see sab-market-import edge function's `publish` flag), which removes
-- most of the repeated work; this raises the ceiling so the one remaining call
-- has headroom.
--
-- SET on the function applies only while THIS function runs (it's SECURITY
-- DEFINER), so it does not relax the timeout for anything else. 120s is well
-- under the GitHub Actions job budget and the edge function's own limit.

alter function public.sab_publish_market_estimates()
  set statement_timeout = '120s';
