# Supabase usage audit — 2026-10-20

Read-only code audit of `origin/main` @ `d85fddd3` (4 parallel agents: pages/caching/images, browser/middleware, jobs/crons, schema/indexes). No DB, no network. Sizes are estimates from code + in-repo measurements; uncompressed JSON. **Verify table sizes on the live DB before acting on the size numbers.**

Context: Supabase went unhealthy 2026-10-20; org over quota, projects restricted from 2026-10-22 if still over. Oct 9 baseline: egress 6.3/5 GB, logs 4.4/1 GB, ~270k API req/day, 413 MB data dump (whole DB incl. bulk tables, `db-heavy-schedule.test.ts`).

Confirmed outside code: repo variable `MM2_PRICING_ENABLED=true` (since 2026-10-05).

---

## A. Data out (egress, 5 GB/month)

| # | Cause | Where | Fix |
|---|---|---|---|
| A1 | All images served straight from Supabase Storage at full size (`images.unoptimized: true` since 2026-09-28, 5bccdac5) | `next.config.js:79`; listing cards `[categorySlug]/_GenericListingsClient.tsx:204-215` (≤1600px WebP, `src/lib/images/resize-server.ts:27`); `ValueArt.tsx:58-72` (sab-brainrots, values-items 512px originals `scripts/copy-values-images.mjs:29`); footer icons 512px master at 22px `footer-game-links.tsx:119-128` (64px variant exists `src/lib/games/icons.ts:300-301`); blog cards 1440px `BlogCard.tsx:86,129`; store banners `cacheControl:'3600'` `store-banner-service.ts:220` | Pre-sized thumbnails at upload + backfill; static art (heroes, item art, icons) served from Vercel; footer uses `-64.webp` |
| A2 | Root-layout footer caps 2,076 of 2,391 prerendered pages at a **1-hour** refresh (values items declare 604800, categories/hubs 86400) | `footer-game-links.tsx:52-55` → `gameActivityCache.ts:79` calls `getTestSellerIds()` (`src/lib/seo/public-hygiene.ts:31-50`, `revalidate:3600`) outside its cached callback; Next 14 `unstable_cache` lowers page revalidate. Other caps: `seller-presence.ts:288`, `[categorySlug]/page.tsx:343`, `stock-server.ts:168` (1 day) | Resolve test-seller ids inside the cached callback; raise to 86400; confirm via prerender manifest |
| A3 | **Verify:** ISR rebuilds on Vercel may bypass Data Cache + `unstable_cache` (`x-prerender-revalidate` → `isOnDemandRevalidate`), so every rebuild reads live | `next/dist/server/base-server.js:1199-1203`, `patch-fetch.js:497`, `unstable-cache.js:106,169`; noted in `src/lib/revalidation/request-memo.ts:7-11` | Check API logs: `rpc/footer_game_activity` + `trustpilot_settings?select=review_count` should be ~1–2/day. Thousands = bypass |
| A4 | Value item pages (1,229) each read whole catalogues; per-item tags make 500 identical queries 500 cache entries | AM `_adoptMePetData.ts:88-96,182-222` (~1.5–2k rows/render, uncapped history); SAB `values/[itemSlug]/page.tsx:243-260,304-306,397-418,420-444` (history unordered-limit bug returns OLDEST 1000 rows; catalog view twice); MM2 `src/lib/values/data.ts:140-175` (whole catalogue ~2.1k rows/render); tags in header = cache key `src/lib/supabase/anon.ts:63-77`, `read-client.ts:12-14` | Shared per-game catalogue read (one cache entry / one snapshot), date-capped history, fix SAB history order |
| A5 | Whole-site invalidation | Nightly `api/cron/revalidate-listing-pages/route.ts:43-47` revalidates `TEST_SELLERS_TAG` + `GAME_DIRECTORY_TAG` which the footer attaches to every page; admin game edits `revalidateTag('game-directory')` (admin-games.ts ×10, admin-game-wizard.ts ×7, admin-trend-review.ts:40); `admin-sellers.ts:246` | Footer fix (A2) detaches tags; nightly cron only category/hub patterns |
| A6 | SAB snapshot cron re-renders all ~498 SAB item pages daily (undoes changed-only) | `api/cron/snapshot-sab-prices/route.ts:145-171` | Drop the loop; pricing publish already revalidates changed items |
| A7 | `/browse` client query: `listings select('*')` + 3 full joins, no limit (≤1000 rows, full games row incl. `hero_bg_blur`), refetch per keystroke, `ilike` on description (no trigram) | `src/app/browse/_BrowseClient.tsx:53-67,195`; `src/lib/api/listings.ts:14-89` | **Partly fixed on unmerged `feat/info-pages-revamp` (780b1d55):** 24/page, 300 ms debounce. Still: explicit columns |
| A8 | `seo-hourly` loads full sitemap input + all inspections 24×/day; ~17 runs/day have no targets | `.github/workflows/seo-hourly.yml:13,30-36` → `api/cron/seo-gsc/route.ts:51-62`; `src/lib/seo/gsc/store.ts:13-23,67-73`; `check.ts:47-58`; 60 s memo only `sitemap-sections.ts:14-25`; duplicate Vercel 06:20 run | Skip when no targets / every 3 h; drop Vercel duplicate. Sitemap sections (hourly ×10) same full load |
| A9 | SAB reprice egress ~25–30 MB/run | `src/lib/pricing/games/sab.ts:195-250,331-392` | Keyset paging / server-side RPC (see C1) |
| A10 | Weekly backup dumps rebuildable + log tables (~50–150 MB/run) | `.github/workflows/db-backup.yml:30,101-113` | Exclude `sab_price_display`, `sab_price_corrections`, `sab_external_market_observations`, `seo_url_inspections`, `game_metrics`, `sab_import_runs`, `webhook_events` payloads, audit log |
| A11 | Navbar per hard load: whole `category_configs` with config JSON (0.2–1 MB) for icons only; spotlight games always fetched | `navbar-floating.tsx:288,728-748`; narrow pattern exists `use-currency-meta.ts:45-49`; `useSpotlightGames.ts:50-123` (no `enabled`) | `config->>currency_icon_url`; gate spotlight on menu open |
| A12 | `/shop/[slug]` `revalidate=60`, ~10 queries/render | `src/app/shop/[slug]/page.tsx:106-116,195,230-270` | Raise + tag-revalidate |
| A13 | Hourly list pages read full catalogues (SAB values ~8.5k rows, calculator, AM values/calcs, `/adopt-me/blog` uncapped FR history `blog/_hubData.ts:145-180`) | see A2 for cadence | Snapshot reads |
| A14 | Builds: ~35–40k queries / ~3M rows per cold build; no preview guard in `generateStaticParams`; local builds used prod `.env.local` | `next.config.js:59` (180 s timeout) | Builds on local stack only (memory rule saved); check Vercel preview env vars |

## B. Database size (500 MB)

| # | Table | Growth | Where | Fix |
|---|---|---|---|---|
| B1 | `sab_market_raw_listings` ~200–300 MB (204 MB heap @126k rows measured `20260915110000:7`); full `raw_payload` stored + rewritten each crawl, reprice reads 4 fields; VACUUM never shrinks file | rewrite churn | baseline `:2813-3183` (`:3050,:3091`); reprice reads `sab.ts:384-387`; collector `collect-eldorado-sab-api-v6.mjs:1641-1657` | Slim payload to the 4 fields as columns; skip unchanged rows; drop unused indexes (`pending_idx` :11146, `source_idx` :11150, `valid_price_idx` :11154 — verify idx_scan); then `pg_repack`/`VACUUM FULL` once |
| B2 | `values_raw_listings` (MM2 + Steal an Egg) insert-only, full copy per crawl, 6 indexes, no retention | MM2 ~14k rows/day + SAE ~2k → ~6–10 MB/day since 2026-10-05 | `20260918225751_values_generic_pipeline.sql:156`; writers `scripts/lib/sae-write.mjs:166`, `scripts/lib/values-import.mjs:165` | Keep 7 days, roll up the rest |
| B3 | SAE retire **bug**: rewrites whole history daily (no `.eq('is_active', true)`) | doubles table with dead rows | `scripts/lib/sae-write.mjs:173-177` (MM2 path correct `values-import.mjs:172`) | One-line fix |
| B4 | `adopt_me_market_raw_listings`: unique key includes `price_usd` → every price change = new row, ended rows kept forever; all 51k rows rewritten daily (`collected_at`) | +1–2 MB/day | `scripts/import-adoptme-cash.mjs:208-243`; key baseline `:9540` | Delete ended >30 d; skip unchanged |
| B5 | Price history (`sab_price_history` written twice/day, `adopt_me_price_history`, `sab_raw_listing_daily`) | ~2 MB/day | `sab.ts:647-671`, `snapshot-sab-prices/route.ts:96-104`, `adopt-me.ts:170-190` | Fine for now; drop duplicate indexes (`sab_price_history_variant_time_idx` :11202, `adopt_me pet_variant_date_idx` :10238) |
| B6 | No retention: `value_funnel_events`, `seo_url_events`, `seo_alerts`, `webhook_events`, `notifications`, `shop_visits`, `sab_import_runs`; `audit_logs` comment claims 90-day delete but nothing does it | small | `20261002005822…`, baseline `:6513`, `:7856` | 90-day prune job |
| B7 | Legacy tables still read/stored: `sab_price_snapshots` (no writer, scanned by every catalogue read via `sab_latest_price_snapshots` window, baseline `:7526-7564`), `sab_market_observations`, `archive.*_dummy` | ? | baseline `:7498,:8042`; `20260904000000…:127-145` | Verify size; drop/replace |
| B8 | Duplicate indexes: `listings` (`idx_listings_category_id`=`listings_category_id_idx`, `idx_listings_slug` dup of unique), evidence `variant_idx` prefix of `group_idx`, plus ~10 small-table dups | | baseline `:10570/:11014`, `:10622/:9780`; `20260913130000:70,72` | Drop |

## C. Disk IO / CPU (why it went unhealthy)

| # | Cause | Where | Fix |
|---|---|---|---|
| C1 | SAB reprice OFFSET paging over the big raw table (same shape measured 1,677 s in expire job, which moved to keyset) — 7 paged reads in parallel; catalogue view over non-inlinable SECURITY DEFINER fn recomputed per page | `sab.ts:195-250` (`.range()` :211), `:331`, `:334-339`, `:366-392`; keyset reference `src/lib/sab/expire-listings.ts:128-153`; fn baseline `:3595` | Keyset paging; partial index `(id) WHERE listing_status='active'`; read catalogue from `sab_price_display` |
| C2 | Heavy SAB chain runs twice/day: G2G import publishes (no `--no-publish`), reprice repeats 1–2 h later; `work_mem 64MB` | `scripts/collect-g2g-sab.mjs:646`; edge fn `supabase/functions/sab-market-import/index.ts:352-434`; `20260915100000:53` | Add `--no-publish` at G2G:646 |
| C3 | Every crawl rewrites every row (non-HOT: `observed_at`/`fetched_at` indexed, 7 indexes); parse trigger `UPDATE OF title` fires every upsert (title always assigned) with ~5 LIKE alias scans; per-row EXCEPTION block = ~500 subtransactions/call | baseline `:3001-3113`, `:3085-3091`, trigger `:11326`, parse `:3258-3478` | Skip unchanged; don't assign title on conflict (or `WHEN` clause); set-based import |
| C4 | Nightly retention predicate not sargable → 2 full seq scans of ~200 MB | `20260918235539_sab_raw_listing_retention.sql:105-108,127-129` (index at :53) | `observed_at < cutoff::timestamptz` |
| C5 | Adopt Me reprice OFFSET paging over growing table | `src/lib/pricing/games/adopt-me.ts:58-67,85-96` | Keyset |
| C6 | `seo_value_series` (array_agg over full history, non-inlinable) paged with `.range()` → full re-run per page; called 2–3×/day/game | `20261009210010_seo_pipeline.sql:200-231`; `src/lib/seo/gate/refresh.ts:129-136`; `values-revalidate/route.ts:98` | One call (no range) or date-windowed |
| C7 | Listing view = non-HOT full-row update of `listings` (~24–30 indexes incl. GIN, `view_count` indexed twice, 4 BEFORE triggers) + `rate_limits` row | `src/lib/actions/listing-views.ts:25-55`; `20261001181007_listing_view_tracking.sql:23-25`; baseline `:10598,:10630` | Separate counter table or hourly batch; drop the view_count indexes |
| C8 | Value-page beacons: `rate_limit_hit` + insert per view/CTA | `src/app/api/events/value/route.ts:18-35`; `TrackOnMount.tsx` | PostHog already tracks — consider dropping or batching |
| C9 | `sab_publish_market_estimates` UPDATE without `is_active` filter; `sab_recompute_tradeable` updates every brainrot | baseline `:3727-3746`, `:3874-3884` | Add filters |
| C10 | Statement timeouts raised (anon/auth 30 s, service 120 s) let heavy queries pile up | `20260813120000…:19-20`, `20260913121000…:37` | Lower toward defaults after C1–C6 |
| C11 | Realtime: 5 tables `REPLICA IDENTITY FULL` (orders, profiles, messages, notifications, seller_applications) | baseline `:1267,:5992,:7128,:7200,:8791,:13467-13483` | Check `pg_replication_slots` lag |

## D. Logged-in browser load (small today, grows with users)

- AuthProvider re-reads full `profiles select('*')` + `seller_applications` on every auth event incl. each tab focus (auth-js `_onVisibilityChanged` → SIGNED_IN): `src/hooks/use-auth.tsx:105-109,174-298,310-426`; `seller-app` realtime channel open for every buyer `:566-600`.
- Navbar polling: unread messages 2 req/60 s (`use-unread-messages.ts:18-48`; `conversations` has no buyer_id/seller_id index), notifications, active orders, uncached `admin_roles`: `navbar-floating.tsx:471-652`.
- Order chat full-thread reread every 20 s + focus + visibility: `src/hooks/use-chat-thread.ts:144-155,212-215,282`.
- Post-payment `router.refresh()` every 4 s for 120 s (~500 DB/Auth calls): `_PaymentReturnHandler.tsx:35,101`; pay page poll without visibility check `_PayClient.tsx:551-580`; orders realtime → `router.refresh()` `_OrderClient.tsx:198-216`.
- Seller messages 1+N+1 queries/min + unfiltered `messages` INSERT channel: `src/hooks/use-seller-messages.ts:26-92`; `src/lib/api/seller-compatible.ts:1026-1098`.
- Seller presence heartbeat on every visibility change: `src/hooks/use-seller-presence.ts:36-85`.
- `/account/orders` loads buyer + seller full history (seller ungated): `account/orders/page.tsx:187-240`.
- Hover prefetch = FULL render in Next 14.2.35 (`IntentPrefetch.tsx:14`), e.g. `/founding` force-dynamic from footer; raw `next/link` viewport prefetch on listing cards and item cards.
- Navbar typeahead `attribute_options ilike` service-role, no trigram: `src/lib/actions/search.ts:64-124`.
- Middleware `getUser()` on every protected request incl. server-action POSTs: `src/middleware.ts:80,127-133`.

## E. Jobs — schedule and verdict

| Job | Where / cadence | Load | Better way |
|---|---|---|---|
| values-pricing-daily | GH 1/day | 🔴 | C1, C2, C3, C5; SAE + MM2 jobs have no `needs:` and overlap G2G chain (`values-pricing-daily.yml:307-310,357-364`) |
| sab-retention-nightly | GH 1/day | 🟠 | C4 |
| seo-hourly | GH 24/day | 🟠 egress | A8 |
| db-backup | GH weekly | 🟡 | A10 |
| adopt-me-weekly-catalog | GH weekly | 🟢 | — |
| trend-radar | GH 2/day | 🟢 | — (90-day prune exists) |
| reconcile-payments (+ not-delivered step) | GH /15 min | 🟢 | Not-delivered route only on main → 404 on prod until release (no DB impact) |
| expire-pending-payments | GH /30 min | 🟢 | — |
| auto-complete-orders | GH hourly | 🟢 | — |
| db-backup-watchdog, mm2-watch | GH | none | — |
| Vercel: revalidate-listing-pages 04:35 | daily | 🟡 | A5 |
| Vercel: value-listing-refs 04:50 | daily | 🟡 | 2×5,000 listing reads |
| Vercel: snapshot-sab-prices 18:30 | daily | 🟡 | A6 + writes history twice |
| Vercel: seo-evidence 05:10, seo-gsc 06:20 | daily | 🟡 | C6; seo-gsc duplicates GH hourly |
| Vercel: check-sab-freshness 06:40 | daily | 🟢 | Runs before GH pricing usually finishes → likely reports stale daily |
| Vercel: others (expire-pending, auto-release, mark-inactive + rate_limits cleanup, tiers, trustpilot, discord) | daily | 🟢 | — |

`pg_cron` installed but no `cron.schedule` in repo — check live `cron.job`. No pg_net, no materialized views.

## Already fine

Anonymous middleware does no Supabase work; OG images force-static; hero images content-hashed AVIF ≤100 KB 1-year cache; footer activity single RPC; expire-listings keyset; rate_limits nightly cleanup; game_metrics 90-day; Eldorado import `--no-publish`; values_prices changed-only; pricing revalidation changed-only; payment/order sweeps indexed and bounded.

## To verify on the live DB (owner OK needed)

1. Table + index sizes (`pg_total_relation_size` per table) — catalog read only.
2. `idx_scan` for the suspected unused indexes.
3. `cron.job`, `pg_replication_slots`.
4. API logs: count of `rpc/footer_game_activity` per day (A3).
5. `pg_stat_statements` by `shared_blks_read` (expect `sab.ts` OFFSET pages on top).
