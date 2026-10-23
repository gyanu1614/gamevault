# Values Platform, Step E: Data-Led Sell Pages — Implementation Plan

> Executed inline. `- [ ]` steps.

**Goal:** `/[game]/sell` becomes one template whose sections render only when their data exists, so the 243 pages stop being the same page with the name swapped.
- Values games show the real items players sell, each as "Bat Dragon · Sells For $X", plus a New badge, New This Week and a price search.
- Listing games show what is selling on DropMarket now.
- Category-only games show live player numbers and what can be sold.
- No fee in the title, description or item rows (owner, 2026-10-22: "showing them fee upfront is the worst way").

**Static-first rules (CLAUDE.md, Step 7a):**
- no cookie client; public reads go through `@/lib/supabase/anon`;
- no `searchParams`;
- every new read is `unstable_cache`d under the tags its data job already revalidates (`valuesTag(game)` / `valueGamePriceTag(game)` for values; the listing tags for offers);
- `revalidate` stays a safety net.

## Sections, by data tier
1. **Values games** (`hasHubPage(game,'values')`):
   - **Top {Noun}s To Sell Now:** 12 cards with art, name, "Sells For $X" and New. The price is our live listing if there is one, else the market price. Each card links to its value page.
   - **New This Week:** up to 8 items where `isNewItem(...)`, same card.
   - **Check Your Price:** a GET form to `/[game]/values` (`q=`). It needs no client JS, does not read `searchParams` on this page, and the values list already reads `q` through `SearchParamsBridge`.
   - **FAQ from data:**
     - "What are the most valuable {Name} {noun}s to sell?" (top 5 with prices);
     - "How much is a {top item} worth?";
     - the forms question per game (Neon/Mega, Chroma, mutations);
     - "How do I sell…", "Is it safe…", "How do I get paid…";
     - "What does it cost to sell?" without a percentage.
2. **Listing games** (any game with active listings): **Selling Now On DropMarket**, one row per category with the live offer count and "From $X". One cached read per game, from listings grouped by `game_category_id`.
3. **Category-only games:**
   - **Players Online Now:** the latest `game_metrics_daily` max/avg for the game's Roblox universe (`game_external_ids`), when there is one;
   - **What You Can Sell:** the enabled categories' names;
   - **No Sellers Yet:** a one-line callout to list first;
   - FAQ per category ("Can I sell {Name} accounts?").
4. **Nothing unique** (no values, no listings, no player stats): the page still renders, for DM links.
   - It becomes noindex only after checking its Bing and Google referrals (memory: check-bing-traffic-before-noindex).
   - If any page in this tier has search referrals, it stays indexed.

## Title and meta (SEO-first, no fee)
- **Title:** `Sell {Name} {Noun}s for Real Money`. Noun: the theme `itemNoun` for hub games ("Pets", "Brainrots", "Items"); the category word otherwise.
- **Description:** numbers first, from real data, e.g. "Sell your Adopt Me pets for real money: 781 pets priced daily, Bat Dragon sells for $X. List free, get paid when it sells."
- **H1** follows the title.

## Tasks
- [ ] **E1.** `src/lib/sell/sell-page-data.ts`:
  - `getSellItems(gameSlug)` → `{ top, fresh }` (cached, values tags);
  - `getSellOffers(gameId)` → per-category offer counts and "From" price (cached, listing tags);
  - `getSellPlayers(gameId)` → `{ playingNow, peak7d } | null` (cached a day).
  - Unit tests on the pure shaping (headline price, sort, New).
- [ ] **E2.** `src/lib/sell/sell-copy.ts`: pure title, description and FAQ builders per tier, with tests (no "%" anywhere; Title Case labels).
- [ ] **E3.** The page: sections behind their data, reusing the values card (`ValueCard`), `FaqCards` and the hub chrome. Mobile first: 2-column cards on a phone.
- [ ] **E4.** Indexability: the referral check (Vercel analytics / GSC) → decide noindex for tier 4. Keep `isGameSellPageIndexable` as the single rule.
- [ ] **E5.** Guards:
  - the public-route-caching guard stays green (no cookies, no searchParams);
  - a sell-copy test that no title or row has a fee;
  - existing sell-page tests are updated.
