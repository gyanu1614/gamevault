# Values Platform, Step D: One Price Rule, A Page For Every Item, The Google Rule, New Badge — Implementation Plan

> Executed inline. `- [ ]` steps. Change points come from the 2026-10-22 code map (file:line references were checked at that time).

**Goal:** All four values hubs behave the same way.
- Every catalogue item has a page.
- The headline reads On DropMarket → Market Price → Value (Adopt Me trade value) → "No Trades Yet".
- A new item (released or added in the last 30 days) with a How To Get and release info is indexable even before it is priced.
- A New badge shows on cards and heroes.
- Product JSON-LD only states offers we really have: our own DropMarket stock.

## Decisions
- **Adopt Me page gate.** `has_page` (the generated column, description ≥ 200) stops gating pages; `is_active` does. The column stays (no migration, and the catalogue guard pins its value). A pet without a description gets a facts paragraph instead of an empty About box.
- **MM2 page gate.** `valueItemHasPage` = every enabled item. Prerendering stays priced-only (854 more build-time renders per release cost build minutes and production reads); unpriced pages render on the first visit and are cached (`dynamicParams` stays true).
- **New rule.**
  - Badge: `isNewItem` (released within 14 days, else added within 14 days).
  - Index: `isNewIndexable` (30 days) with How To Get + release info. It is checked before the per-game legacy rule, so an unpriced new MM2 item is not noindexed as "legacy". The page verdict and the sitemap verdict share it (index-rule-parity guard).
- **Badge payload.** List rows carry a server-computed `isNew` boolean, not timestamps: it adds about 1 byte per row against about 30. It can be up to 24 h stale (rows.json is a day-long cache), which is fine for a badge.
- **Headline.** `buy-panel.ts` stays the one rule. A new helper `noPriceFallback({ tradeValue, isNew })` is passed by every hero:
  - a trade value → `Value: X`;
  - otherwise `New: No Trades Yet` or `Value: No Trades Yet`.
  - Steal an Egg's hero shows "On DropMarket" first when we have stock (it never did).
- **JSON-LD.** Product + AggregateOffer only when our own stock total > 0 (`buyData.stock`), with prices from our offers. External market prices never become InStock offers. SAB's `active_listing_count` (external, and stale) is no longer used for this.

## Sub-steps (each committed separately, tests first)
- [ ] **D1. Pure helpers + tests.**
  - `isNewIndexable({ releasedAt, addedAt, hasHowToGet, hasReleaseInfo }, now)` and `noPriceFallback`;
  - `ownStockProduct({ name, url, image, stock, offers })` → JSON-LD or null;
  - a `NewTag` in ValueCard.
- [ ] **D2. Adopt Me pages for every active pet.**
  - Change these from `has_page` to `is_active`: the loader, publishable slugs, the similar pool, the list href, the page ItemList/A–Z, sitemap-data, gate refresh, the calculator, catalogs, item-catalog and blog hubData.
  - Make null descriptions safe (`withoutStalePrices`, story slice); the About box gets a facts paragraph.
  - Update the pinning tests (_adoptMeData.test, page-titles guard, sitemap-builder test).
- [ ] **D3. MM2 pages for every enabled item.**
  - `valueItemHasPage` → enabled.
  - Null-price safety in `_itemMetadata.ts` (`price!`) and `ValueListItemBody.tsx` (`a.price!`).
  - The hero footer stops saying "Priced from reputable sellers only" when there is no price.
  - Copy that says "only X items get their own page" is updated.
  - List and rows.json hrefs for all items.
  - Sitemap data stops requiring a price row (the gate decides).
  - Update hub-config.test and sitemap-builder.test.
- [ ] **D4. Google rule.**
  - Add `newIndexable` to `ValuePageIndexInput`, checked before `!legacyIndexable` and before "no evidence".
  - Pass it from each game's metadata. Each game needs these inputs:
    - SAB: `getItemFacts` + `created_at`;
    - AM: the pet row + `released_at`, `created_at`, `how_to_get`;
    - MM2/SaE: `ITEM_COLUMNS` + `created_at`, `how_to_get`, `release_year`.
  - Pass the same value through SitemapInput / sitemap-data.
  - Update indexability.test, the index-rule-parity guard and sitemap-builder.test.
- [ ] **D5. New badge.**
  - List rows: SAB widens its popularity read with `released_at, created_at`; AM selects both; MM2/SaE `ITEM_COLUMNS` + `created_at`, computing `isNew`.
  - Cards (4 lists) and heroes (4).
- [ ] **D6. Headline + JSON-LD.**
  - Every hero passes `noPriceFallback`. The SaE hero gets the On DropMarket headline.
  - AM, MM2, SaE and SAB Product JSON-LD comes from own stock only.
  - Update the buy-panel and ValueBuyPanel tests and the item-hero wiring guard.
- [ ] **D7. Verify.**
  - Type-check, lint, the unit and guard suites.
  - Local stack: an unpriced MM2 item page renders; an Adopt Me pet without a description renders; the New badge shows; the JSON-LD is absent without own stock.
