# Plan — SAB price pages: correct every time, fast every time

## The problem (root cause, verified live)
Every price-showing page reads `sab_public_price_catalog_corrected`, a **VIEW** that = `sab_public_price_catalog` (a multi-level aggregation over ~64k raw listings, recomputed on every read) LEFT JOIN `sab_price_corrections` (fast table).

- A read of that view takes **1.5–8s**. Even a single-item filtered read (`.eq('brainrot_id',…)`) must compute the *whole* aggregation first, then filter — so one item costs as much as the whole catalog.
- Run as the **anon role** (what the site uses) it intermittently exceeds the statement timeout → `57014` → the query is cancelled → the page gets `error`, returns `null`, and renders **"No data yet"** / blank prices.
- `revalidate = 3600` ISR means a first render that times out **caches the failure for an hour** → prices "sometimes show, sometimes don't."

15 read sites across values, item page, calculator (×3 variants), blog, homepage, price-index, snapshots, and the Discord bot all hit this view.

## STEP 0 — DONE / IN PROGRESS
- ✅ Import-publish timeout (publish once per crawl) — shipped (#53).
- 🔵 **Stopgap (user runs now):** raise anon/authenticated `statement_timeout` to 30s (`20260813120000_raise_role_statement_timeout.sql`). Unblocks the live site today.

## STEP 1 — Materialize the display catalog (the real fix)
Replace recompute-on-read with **compute-once-after-crawl, read-instant**.

**1a. New table `sab_price_display`** (migration): same columns the corrected view exposes, plus indexes:
- PK `(brainrot_id, mutation_slug)`
- index on `brainrot_slug` (item-page lookups)
- index on `(mutation_slug)` partial where `mutation_slug='default'` (values grid + homepage)

**1b. Refresh function** `sab_refresh_price_display()` (SECURITY DEFINER, `statement_timeout='120s'`):
`INSERT INTO sab_price_display SELECT * FROM sab_public_price_catalog_corrected ON CONFLICT … DO UPDATE` + delete rows no longer present. One heavy compute, off the request path.
(Plain table upsert, not MATERIALIZED VIEW: non-blocking reads, no refresh lock, reuses the existing reprice hook.)

**1c. Wire the refresh into the reprice** (`src/lib/pricing/games/sab.ts` `run()`, right after the `sab_price_corrections` upsert at ~L330): call `sab_refresh_price_display()`. This already runs at the end of every crawl (post-crawl `correct-prices?game=sab`) and on the scheduled cron — so the display table is always fresh within a crawl cycle. Also expose it in `/api/cron/correct-prices` so a manual hit refreshes.

Result: page reads become an **indexed point/range lookup on a plain table → ~5ms**, no aggregation, no timeout — ever.

## STEP 2 — Point all reads at the fast table
One shared helper `src/lib/sab/priceDisplay.ts` with typed readers:
- `getDefaultPrices()` — values grid + homepage (mutation_slug='default')
- `getAllPricedMutations()` — values grid switcher
- `getBrainrotPrices(brainrotId)` — item page (all mutations for one brainrot)
- `getPrice(brainrotId, mutationSlug)` — single cell

Swap the ~15 call sites from `.from('sab_public_price_catalog_corrected')` → these helpers reading `sab_price_display`. Same columns, same shape → minimal churn. Keep the corrected VIEW as the *source* for the refresh (and as a fallback), so nothing else breaks.

**Files:** values/page.tsx, values/[brainrotSlug]/page.tsx, calculator/page.tsx, value-calculator/page.tsx, trade-calculator/page.tsx, [gameSlug]/page.tsx, price-index/page.tsx, blog/page.tsx, blog/_hubData.ts, lib/discord/{prices,dailyPost}.ts, api/cron/snapshot-sab-prices/route.ts. (Adopt-Me uses the same pattern → apply there too if it has a mirror view.)

## STEP 3 — Never render blank; make navigation smooth
- **Graceful fallback:** every reader returns `[]`/`null` cleanly on error, and pages render a "prices updating…" state + last-known values, never a hard blank. A single timed-out read can't blank the page.
- **Suspense boundaries:** wrap the price sections so the page shell + images paint immediately and prices stream in — kills the "janky back/forth" feel.
- **Cache tags:** switch price reads to `unstable_cache` keyed by a `price-catalog` tag; the reprice cron calls `revalidateTag('price-catalog')` after a refresh → pages update within a crawl cycle without a 1-hour stale window, and a timed-out render never poisons the cache.

## STEP 4 — Verify
- Re-run the anon-key timing harness on `sab_price_display`: expect **<20ms** (vs 1.5–8s).
- Load values, item page (Skibidi + Dragon Cannelloni), calculator, blog with the anon key — confirm prices present, no `57014`, no "No data yet".
- `tsc` clean + existing SAB tests pass.
- Trigger a crawl → confirm the display table refreshes and pages reflect new prices.

## Rollout order (safe, incremental)
1. Migration: table + indexes + refresh fn (no reads switched yet — additive, zero risk).
2. Wire refresh into reprice; run it once to populate the table.
3. Switch call sites to the fast table (behind the shared helper).
4. Add Suspense + cache tags.
5. Verify, commit per milestone, PR, deploy. User applies migration (`supabase db push`) — same as before.

## Deferred / not doing now
- Full `MATERIALIZED VIEW CONCURRENTLY` refactor of the whole chain (bigger; the table approach gets 99% of the win).
- Rewriting the base aggregation views for speed (they only run once per crawl now, so their cost stops mattering).
