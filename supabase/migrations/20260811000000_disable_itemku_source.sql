-- Disable the Itemku market source.
--
-- Itemku added anti-scraping (HTTP 403 to the headless collector) in Aug 2026,
-- so its daily crawl can no longer run. Itemku was only a low-trust supplementary
-- source (no seller-review signals) that could validate/tighten but never set the
-- headline price below Eldorado's verified reputable-seller cheapest. Prices are
-- unaffected: Eldorado remains the authoritative source, with G2G as the
-- independent cross-check.
--
-- This marks the source 'disabled' for hygiene/record-keeping. No runtime code
-- reads sab_market_sources.status to gate collection (the collectors run from
-- their GitHub Actions workflows), so this is metadata only. The Itemku collector
-- script and workflow were removed in the same change. Any remaining Itemku
-- listings age out naturally via the expire-sab-listings cron.

update public.sab_market_sources
set status = 'disabled'
where slug = 'itemku';
