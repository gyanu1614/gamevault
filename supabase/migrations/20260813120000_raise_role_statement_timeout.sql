-- Raise the per-statement timeout for the public read roles.
--
-- The SAB display data is served from layered views
-- (sab_public_price_catalog_corrected → sab_public_price_catalog →
-- sab_market_variant_price_estimates → …) that recompute aggregations over the
-- raw listings on every read. As listing volume grew, the site's own read of
-- sab_public_price_catalog_corrected (run as the `anon` role by the Next.js
-- server components) started intermittently exceeding the role's default
-- statement timeout (57014 → the query is cancelled), so the page received an
-- error and rendered NO prices — even though the underlying data was fresh and
-- complete. The same class of timeout also hit the post-crawl reprice.
--
-- Raising the ceiling to 30s lets these legitimately-heavy reads finish. It
-- does not change any data or logic; it only stops Postgres killing a slow-but-
-- valid query. 30s is well within a serverless request budget and safe for a
-- public role. (A proper longer-term fix is to materialize these views, but
-- this unblocks the live site immediately.)

alter role anon set statement_timeout = '30s';
alter role authenticated set statement_timeout = '30s';

-- Ask PostgREST to reload so the new setting applies to the live pool at once.
notify pgrst, 'reload config';
