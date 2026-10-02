# Bundle 2 plan: value page → listing (awaiting owner "yes")

Worktree `../gamevault-value-cta`, branch `feat/value-to-listing`, base ff057c87.

## Findings (read-only)
- "$X" on the SAB "Buy from $X" button = external market data (`sab_price_display.cheapest_usd`, Eldorado crawl), not DropMarket stock. Adopt Me / generic heroes show market data too; their buttons have no price.
- Listings have no link to value items. Identity: SAB `template_data['select-brainrot']` (mutation only in the title); Adopt Me only the title ("NFR Parrot"); steal-an-egg title. `_offerMatching.ts` already normalises titles.
- `/adopt-me/buy-items?pet=` is never read — lands on the full list. SAB `?search=Name%20Diamond` is a raw substring → usually 0 results.
- Server HTML of filtered and unfiltered buy URLs is byte-identical (verified, same md5). Filtering is client-only (static-first rule forbids `searchParams`). Canonical already = unfiltered.
- No clean item-level buy pages exist (`/{game}/{seo-slug}` 301s to ONE listing; `/{game}/buy-items/{x}` is a single listing slug).
- No `DESIGN.md` in the repo → use card surface system + tokens from memory/design skills.
- Analytics: Vercel Analytics only (one `track()` call); no events table; no consent banner exists (Cookie Policy promises one — flag only).
- Crons are daily only. Notifications: `notify_once` RPC (dedupe key). Email: `sendTransactionalEmail` + `emailShell`; no unsubscribe mechanism anywhere; `email_preferences` table exists.
- G: not rounding. `_CalculatorClient.tsx:868` drops any price with `isTradeReady=false` from the total; tiles/picker show it anyway. Live data: 3,204 / 3,652 prices are not trade-ready (any size; $0.62 rows have sample size 1). Also point value can sit below the range (point $0.62, low $15). Only the SAB WFL tab is affected; Adopt Me WFL, neon, Discord /wfl, value-page "worth" are not.
- F: `ValueItemPage.tsx:135` unescaped `'` (react/no-unescaped-entities).

## Shared core (new, pure, unit-tested)
- `src/lib/value-listings/match.ts`: `matchListingToValueItem(game, listing, catalog) → {itemSlug, variant} | null` per game (SAB: select-brainrot slug or title vs catalogue + mutation token in title/template; AM: variant prefix N/F/R/FR/NEON/NFR/MEGA/MFR + pet name; generic: title vs `values_items`).
- `src/lib/value-listings/stock.ts`: one `unstable_cache`d read per game of active listings in the items category (anon client, excludes test + paused sellers, same as buy page), tagged `categoryListingsTag(itemsCategoryId)` → already invalidated by every listing mutation via `revalidateListingSurfaces`. Returns per item: `{byVariant: {variant: {count, minPrice}}, total, minPrice, top4}`.
- `resolveBuyState(stock, item, variant) → in_stock | other_variants | none`.

## A. Button (SAB hero, AM hero, generic module, SAB calculator result, AM calculators)
- State 1 in stock → "Buy From $X" (DropMarket min unit price, same number the listing card shows) → `/{game}/buy-items/item/{item}/{variant}`.
- State 2 variant out, others in → "See N Other Listings From $Y" + sub-line "{Variant} not listed right now" → `/{game}/buy-items/item/{item}`.
- State 3 none → primary "Tell Me When One Is Listed" (bell), secondary link "Browse Similar Items" (→ item buy page fallback), "Sell Yours For Cash" unchanged.
- Hero price label "Cheapest price" → "Market Price" (it is market data).
- Mobile: buttons full width stacked, ≥44px; desktop: inline row as today.

## B. Item buy page (new route, server-filtered, ISR)
- `src/app/(marketplace)/[gameSlug]/[categorySlug]/item/[itemSlug]/page.tsx` + `[variant]/page.tsx`, shared component. `revalidate=86400`, `dynamicParams` open, prerender none (not in sitemap — Bundle 1), canonical → `/{game}/buy-items`. 404 before any listing read when the item isn't in the catalogue.
- Results → grid of existing `ItemCard`. Nothing for the variant → one line + (1) Other Variants grid (2) Similar Items with stock (same game/category, nearest rarity then market value) (3) alert + sell actions.
- Unfiltered `/buy-items?search=` stays client-filtered (static-first rule); its empty state gets the same one line + fallbacks computed from the offers already on the page.
- All value-page/calculator links switch to the item path. `?pet=` links removed. No middleware change.

## C. "Available Now" block on value item pages
- Up to 4 `ItemCard`s for the item (selected variant first), "View All N" → item buy page. None → state-3 actions.

## D. Alerts (see data model; owner decides in or out of this PR)
## E. Measurement: first-party `value_funnel_events` (see data model)
## G. Shared `src/lib/calculator/trade-sum.ts`: integer cents, "has estimate" = value != null && > 0, low = min(point, low), high = max(point, high); verdict pauses only on truly missing. SAB WFL uses it; AM WFL/neon migrated to it too (same behaviour, one code path). Side totals show cents (formatCash).
## F. Escape the apostrophe.

## Data model
D (3 migrations, local only):
1. `listing_alerts` (id, user_id → auth.users cascade, game_id → games, item_slug, variant null, item_name, status `active|fired|removed` CHECK, created_at, fired_at, fired_listing_id). Unique active per (user, game, item, coalesce(variant,'')). RLS: own SELECT/DELETE; INSERT via column-limited policy `user_id = auth.uid()`; BEFORE INSERT cap 50 active. `email_preferences.listing_alerts boolean default true`.
2. `listing_alert_outbox` (listing_id PK, enqueued_at, claimed_at, processed_at, attempts) + AFTER INSERT/UPDATE OF status trigger on `listings` enqueuing on transition into `active` (catches every publish path incl. direct PostgREST + restock trigger). RLS on, no policies.
3. Service-role RPCs: `listing_alert_outbox_claim(limit)` (lease), `listing_alert_fire(alert_id, listing_id) → bool` (atomic active→fired), `listing_alert_outbox_done(listing_id)`. REVOKE public/anon/authenticated; added to the grants guard as service-only.
- Worker `src/lib/alerts/drain.ts`: claim → match → fire → `sendListingAlertEmail` + `notify_once('listing_alert:<alert>:<listing>')`. Kicked by `waitUntil` from `revalidateListingSurfaces` + daily cron `/api/cron/listing-alerts` backstop.
- Unsubscribe: HMAC token per alert (new env `ALERTS_TOKEN_SECRET`); page `/alerts/unsubscribe/[token]` (confirm button, POST) + `List-Unsubscribe` / one-click headers; "Stop All Listing Alerts" flips the preference. Account page `/account/alerts` (list + remove).
- Rate limits: `listingAlertCreate` 20/hour/user; one-shot alerts (fire once, user can re-arm).
E (1 migration): `value_funnel_events` (id, event CHECK, game_slug, item_slug, variant, state, surface, listing_id null, created_at). No user id, IP, cookie or storage. Insert via `/api/events/value` (sendBeacon, IP rate-limited, IP not stored). View `value_funnel_daily` joins orders (paid) on listing_id within 24h of `listing_opened`. Read: `pnpm funnel:value --days 30`.

## Recommendation on D
Split: PR A (A,B,C,E,F,G) now; PR D stacked right after in this worktree. Until D lands, state 3 shows "Browse Similar Items" + "Sell Yours For Cash" only.
