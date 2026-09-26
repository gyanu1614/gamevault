# Platform: caching + build weight — 2026-09-22

Branch `perf/cache-and-build`, 7 commits. "Before" figures from
`docs/handoff/build-audit.md`; everything else measured on this branch unless
marked *projected*.

## CPU-driving revalidations

| Trigger | Before | After |
|---|---|---|
| Any login / logout / profile edit / avatar / seller signup | **all ~950 prerendered pages** | 0 |
| 10 admin/moderation actions (test-seller, founding, game popular/spotlight/SEO, category config, listing edit, verdict) | **all ~950** | only the tags/paths of what changed |
| SAB crawl (8×/day → 2×) | **all ~500 item pages, every run** | only items whose price moved |

The 16 whole-site calls refreshed nothing: nav, account menu and founding badge
read `useAuth()` in the browser, and every homepage shelf is a client
react-query hook. Verified across the root layout's whole server import graph.
A guard fails on any `revalidatePath('/')`/`('/', 'layout')` outside an
allow-list, which is empty and asserted empty.

## ISR writes/month (SAB item pages)

Before **~120,000** (8 crawls × ~500 items × 30), regardless of price movement.
After: 2 crawls/day × *changed* items × 30 — *projected* 3,000 (50 changed per
crawl) / 9,000 (150) / **15,000 (250)** / 30,000 (all 500). Even all-change is a
4× cut from cadence alone. The real number is `price_rows_changed` in the import
response — read it after the first crawl and put it here.

## Build + size

| | before | after |
|---|---|---|
| wall / user CPU | 3627 s / 323 s | **792 s** / 310 s |
| `.next/server` | 168 MB | 166 MB |
| **server `.js`** | 22.4 MB | **19.7 MB (−12%)** |
| traced (nft) total | 37.3 MB | 36.7 MB |
| Google font fetches at build | 3 families / 15 woff2 | **0 / 3 local** |
| static pages | 1021 | 1021 |

Wall time is *not* like-for-like: the baseline ran cold against a remote DB with
other load (user CPU barely moved → I/O-bound). Take the real build time from
Vercel; size and font numbers are exact. Externalising `svix`/`resend` raises
traced-file count but lowers bytes; the −2.7 MB of server JS is the win.

## Transformations/month

Width is the only multiplying axis (`formats`/`quality` stay default).
`deviceSizes` 8→5 (3840 dropped — nothing renders above 1120 CSS px),
`imageSizes` 8→7: *projected* **≈40% fewer** per source. Plus two `fill` images
that had no `sizes` and so billed the full ladder (game hero in a 128px box;
`ListingPreviewCard`, 6× per page × 264 landings), and
`/brand/logo-mark-white.avif` marked `unoptimized` at 7 sites — a 2 KB AVIF at
~30px, on every hub and SAB page.

## Before you deploy

1. **`supabase db push`** — migration `20260922172054` adds
   `sab_refresh_price_display_changed()` (one function, no schema change).
   Until applied the RPC 404s and prices never reach the pages.
2. Redeploy the `sab-market-import` edge function (it now sends `changedSlugs`).
   Old function + new route is safe: the route falls back to the whole-game tag.

## Manual checks

1. **Log in** → avatar/account menu/founding badge appear without reload;
   **log out** → they clear. (The one behaviour the audit flagged.)
2. Homepage and a values page: second load is `x-vercel-cache: HIT`, and *stays*
   HIT after a login/logout cycle.
3. After the first 12 h crawl: a brainrot whose price moved shows the new number;
   one that did not is unchanged.
4. `/api/internal/sentry-test` still reports. 5. No FOUT regression.

## Deliberately left

- **Part 3 (top-N `generateStaticParams`) not done — your call.** It reverses
  Step 7b, which prerendered everything 11 days ago *because* ~12 deploys/day
  meant on-demand pages paid a ~7-query render after each deploy. Parts 1+2
  removed the invalidation defeating those prerenders, so they now stay cached.
  Build time and deploy size are therefore ~unchanged, by design.
- **`sharp` kept**, contrary to audit §5 — it is *not* unused:
  `lib/games/icons.ts` calls it via `await import('sharp')` in
  `encodeIconVariants`, reached by `/api/internal/trend-radar/prepare`. A
  static-import grep misses it; removing it breaks the icon pipeline.
  Externalised instead.
- **`expire-pending-payments` stays 30 min** — money path; a daily window would
  strand inventory on unpaid orders for 24 h.
- `/assets/heroes/sell.avif` left optimized (177 KB rendered large; all 7 sites
  auth-gated). `disableLogger` not set — deprecated here in favour of the
  `webpack.treeshake.removeDebugLogging` already configured.

## Test state

`tsc` clean. Unit suite **1145/1145 pass, 131/131 files**. Integration not run
(local Supabase down). One pre-existing flake, also on `origin/main`:
`seller-detail-render.test.ts > renders without throwing` times out at 5 s under
parallel load, passes in isolation.
