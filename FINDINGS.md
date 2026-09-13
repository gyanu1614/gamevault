# FINDINGS

Route/pipeline audit findings. One entry per finding, newest last.

---

## ROUTE-010 — Passing SAB crawls never reached the values pages

**Severity:** high (public prices silently 4 weeks stale)
**Files:** `supabase/functions/sab-market-import/index.ts`, `src/lib/pricing/games/sab.ts`

### Symptom

`dropmarket.gg/steal-a-brainrot/values/*` showed "Updated Aug 13, 16:04 UTC"
while scheduled crawls kept passing.

### Evidence

This was **not** a caching problem — the database itself was stale. Measured
against production on 2026-09-12:

| Stage | Freshest record | State |
| --- | --- | --- |
| `sab_market_raw_listings` | Sep 12, 22:54 | working — crawls landing fine |
| `sab_price_corrections` | Sep 1 | 11 days stale |
| `sab_price_display` | **Aug 14, 01:18** | **29 days stale** |

The page reads `price_updated_at` from `sab_price_display`
(`[gameSlug]/values/[brainrotSlug]/page.tsx`). Live HTML confirmed the stale
value: `"UpdatedAt":"2026-08-13T16:04:39.841+00:00"`.

### Root cause

`sab_price_display` had exactly **one** writer — `sab_refresh_price_display()`,
called from a single line in `runSabCorrection` (`src/lib/pricing/games/sab.ts`).
The crawl's own publish step (`sab_publish_market_estimates`) never called it.

So a crawl could import listings and publish estimates perfectly and **still**
never reach the page; only the daily 10:00 UTC `correct-prices` cron
materialized the display table — and that cron was itself failing (ROUTE-011).
`sab_price_display` was introduced by `9211942` (2026-08-13 17:33), which is
exactly where the timestamp froze.

A second, independent defect hid this: `SAB_MARKET_REVALIDATE_URL` pointed at a
**deleted Vercel deployment**, returning `410 GONE — The deployment has been
removed`. Revalidation had been dead for weeks but was logged at `console.warn`
and never failed the run.

### Fix

- The crawl now calls `sab_refresh_price_display()` immediately after publishing,
  so a successful crawl is visible without waiting for the cron.
- A failed revalidation is now a hard failure (HTTP 502) instead of a warning —
  fresh prices in the DB behind stale cached pages is silent staleness, the exact
  failure mode that hid the dead deployment URL.
- Missing revalidation config no longer reports `ok: true`/skipped.

### Operator action required

Set in Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets):

```
SAB_MARKET_REVALIDATE_URL=https://dropmarket.gg/api/internal/sab-market-revalidate
```

Use the **stable production domain**, never a deployment-specific URL
(`*-<hash>-<scope>.vercel.app`) — those are immutable and are removed when the
deployment is pruned, which is how this broke.

### Not the cause

`ROUTE-004` (deletion of the `correct-sab-prices` cron) was **ruled out**: it
landed 2026-09-12, a month *after* staleness began on Aug 14. It removed a
37-line wrapper around the same `runSabCorrection`, was not in `vercel.json`,
and added a schedule-parity test.

---

## ROUTE-011 — SAB pipeline aborted on transient statement timeouts

**Severity:** high (≈16% of scheduled runs failed; correction cron never completed)
**Files:** `src/lib/pricing/games/sab.ts`, `scripts/import-sab-market-json.mjs`

### Symptom

"SAB Eldorado Daily Market Collection" failed intermittently — 4 of the last 25
scheduled runs. Three died identically:

```
Bulk import failed: eldorado import failed: canceling statement due to statement timeout
Eldorado collection failed: Bulk importer exited with code 1
```

The crawl itself always succeeded; the run died at the final publish.

### Root cause

`runSabCorrection` read **all ~110,527 rows** of `sab_market_raw_listings`
*including the whole `raw_payload` JSONB document*, while using only four
sub-fields from it. Measured on production, same page, 5 trials each:

| Query | Result |
| --- | --- |
| **with** `raw_payload` | `500` 8.5s, `500` 8.5s, `200` 3.4s, `200` 0.7s, `200` 0.8s → **40% fail** |
| **without** `raw_payload` | `200` × 5, all ≤ 0.5s → **0% fail** |

The 500s are Postgres `57014 canceling statement due to statement timeout`.
Failure is cache-warmth dependent, hence intermittent.

Two aggravating factors, both single points of failure:

1. `selectAll` had **no retry** — it threw on the first failing page. At ~111
   pages with a ~40% per-page failure rate, completion was effectively
   impossible, so the correction cron never refreshed `sab_price_display`.
2. The importer's final `publish:true` call had **no retry** either. It triggers
   a full-dataset re-aggregation, runs once per crawl, and discarding it throws
   away a crawl that already succeeded.

Notably the crawl's *read* path already had 4-attempt backoff
(`supabasePage` in `scripts/collect-eldorado-sab-api-v6.mjs`); the correction
read path and the import write path never got the same treatment.

### Fix

- Select only the four fields actually used, extracted **server-side** via JSONB
  paths (`raw_payload->>title`, `->>seller_sales_count`,
  `->>is_canonical_band`, `->income_band->>upper`) instead of shipping the blob.
- Added 4-attempt linear backoff to `selectAll`, mirroring the collector.
- Added 4-attempt backoff to the batch send, covering the final publish.
- Both retry only transient classes (57014 / 5xx / 408 / 429 / network). Schema,
  permission, auth and validation errors still fail fast.

### Correctness note

`->>` returns **text**, so `is_canonical_band` arrives as the string `'false'`,
not a boolean. The comparison was updated from `=== false` to `=== 'false'`;
an identity check against `false` would have silently stopped excluding
out-of-tier listings and changed published prices.

Equivalence was verified against production: **16,000 derived values across
4,000 rows** spanning the whole table (8 offsets, 0 → 105,000), comparing the
old blob path and the new extraction path at all four consumption sites —
**0 mismatches**.

### Tests

- `src/lib/pricing/games/sab-retry.test.ts` — read-path retry classification
- `src/test/routes/sab-import-retry.test.ts` — import-path retry classification
