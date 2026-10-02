# GSC reports

Read-only Google Search Console reports for `sc-domain:dropmarket.gg`. Nothing here submits a sitemap, deletes anything or requests indexing — `src/test/gsc/client.test.ts` fails if a mutating call or a write scope appears.

## Run

```bash
pnpm gsc:index-report                       # URL Inspection for every sitemap URL (~1,025)
pnpm gsc:index-report --extra-urls urls.txt # + your own URLs (one per line, `#` comments, /paths ok)
pnpm gsc:index-report --limit 25            # smoke run: inspect 25 not-yet-saved URLs
pnpm gsc:search-report                      # last 28 + 90 days of Search Analytics, sitemap status
```

Other flags: `--date YYYY-MM-DD`, `--out-dir <dir>`, `--concurrency <n>` (index only). pnpm forwards flags directly — no `--` separator.

## Output

`docs/audit/gsc/` — **gitignored, never commit it.**

| File | From |
|---|---|
| `index-report-YYYY-MM-DD.csv` | one row per URL: `url, page_type, verdict, coverageState, indexingState, robotsTxtState, pageFetchState, lastCrawlTime, googleCanonical, userCanonical, crawledAs, referringUrlCount` |
| `index-summary-YYYY-MM-DD.md` | counts by coverageState, `page_type × coverageState`, canonical mismatches, never-crawled, fetch errors, redirects, not-inspected (≤10 examples each) |
| `search-{28d,90d}-{totals,queries,pages,countries,devices,queries-pos-4-20}-YYYY-MM-DD.csv` | Search Analytics |
| `sitemaps-YYYY-MM-DD.csv`, `search-summary-YYYY-MM-DD.md` | sitemap status; short summary of both windows |

## Resuming

The day's CSV is the only state. A rerun on the same day skips every URL already in it, so a quota stop, a crash or Ctrl-C loses nothing. A URL whose inspection failed is **not** saved — the next run retries it. If the CSV header ever differs from the current columns the run refuses to append; move the file aside.

Exit code `2` means some URLs are still uninspected (quota, repeated failures, or `--limit`); `0` means complete.

## The key

A Google service-account key at `~/.config/gsc/key.json` (outside the repo), or the path in `GOOGLE_APPLICATION_CREDENTIALS`. Scope: `https://www.googleapis.com/auth/webmasters.readonly` only. The account's `client_email` must be added as a user on the Search Console property (Settings → Users and permissions). The tooling signs its JWT with `node:crypto` and never prints, logs or writes the key or any token; errors name a field or an HTTP status, never a value.

A `403` from the API almost always means the service account has not been added to the property.

## Quotas and pacing

URL Inspection: **2,000/day and 600/min per property**. The tool paces one request per 250 ms (4/s = 240/min, shared by all workers) and retries 429/5xx with exponential backoff and `Retry-After`. A *per-day* 429 is not retried: the run stops cleanly and finishes on the next day's rerun. Ten failures in a row abort the run, so a bad credential cannot burn the quota. One full sitemap pass (~1,025 URLs) takes ~4½ minutes and uses about half the daily quota.

Search Analytics windows end two days before the run (Search Console data lags) and cover 28 / 90 days inclusive.

## `page_type`

Derived from the route patterns in `scripts/lib/gsc/page-type.ts`. It reuses `RESERVED_GAME_SLUGS` (`src/lib/games/validate-game.ts`) and `LEGAL_DOCS` rather than keeping its own lists; the only list it owns is `GAME_HUB_SEGMENTS` (the static folders under `/[gameSlug]`). `src/test/gsc/page-type.test.ts` fails — with the fix in the message — if a new top-level route or `/[gameSlug]/…` folder appears that the classifier does not know.

## Code map

`scripts/gsc-index-report.ts`, `scripts/gsc-search-report.ts` (thin entrypoints) → `scripts/lib/gsc/*` (auth, client, throttle, sitemap, csv, page-type, index-report, search-report) → tests in `src/test/gsc/`. Google is only reached through an injected `fetch`; no test calls Google.
