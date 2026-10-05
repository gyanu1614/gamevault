# MM2 "How to get" dataset (checked 2026-10-05)

File: `murder-mystery-2.how-to-get.json`, with one object per item (100 items).

## Counts by status

| status | items |
|---|---|
| obtainable | 27 |
| seasonal | 0 |
| unobtainable | 71 |
| unknown | 2 |

Confidence: 98 high, 2 low.

No item is `seasonal`. MM2 event items do not come back in later events: each Halloween/Christmas brings new items, so an older event item stays trade-only.

## What is live in MM2 right now (2026-10-05)

- **No event running.** The last events were Summer 2026 (Jul 23 - Aug 23, 2026) and the Roblox "The Hunt: Roblox 20" tie-in, which started on Sep 17, 2026 and is now over. Halloween 2026 is not out yet and has no confirmed date. Halloween 2025 ran from Oct 18 to Nov 21, so a mid-to-late October start is likely. When it launches, its new items are the only `seasonal`/event candidates; re-check this file then.
- **Shop boxes (permanent):** Mystery Box 1, Mystery Box 2, Knife Box 1-5, Rainbow Box and Gun Box 1-3. Each spin costs 1,000 Coins, 100 Diamonds or 1 Mystery Key. In every box the Godly drops at 0.2% and its Chroma at 0.004%. Mystery Box 2 has two Godlies, Lightbringer and Darkbringer.
- **Crafting Station:** Seer (20 Legendary Shards) and Random Painted Seer (10 Godly Shards + 10 Godly Metals). The painted Seer recipe gives a random colour: Red, Orange, Yellow, Blue, Purple or a rare Chroma Seer.
- **Robux gamepasses on sale (Roblox API):** only Elite, Radio and the "BUNDLE: Beach". Every godly/item-pack gamepass that matches an item in this list is `isForSale: false`.

## Method

1. **Item pick:** We took items with a page (rarity Godly/Ancient/Vintage/Unique/Chroma, `is_priced`, per `valueItemHasPage`) and ranked them by active matched `values_raw_listings` from reputable sellers (`seller_reviews >= 200`). Ties were broken by `values_prices.average_usd`, and we kept the top 100.
2. **Item facts:** We pulled the wikitext for every item page through the MM2 Fandom MediaWiki API (infobox `obtain` and lead), plus every box, event, gamepass and crafting page each item depends on. Odds and costs come from the box and event pages.
3. **Current state:** We checked each wiki flag against:
   - the events' start and end dates on their own wiki pages;
   - the last-edit dates of the Shop, box and Crafting pages (box pages edited 2026-09-01, Crafting 2026-09-28);
   - the official Roblox game-pass API (`apis.roblox.com/game-passes/v1/universes/66654135/game-passes`), which gives the live `isForSale` for every MM2 gamepass;
   - a web search for Halloween 2026 news.
4. The `method` and `note` text is our own wording. Wiki estimates such as "<1%*" are labelled "(wiki estimate)".

### Wiki flags we corrected

- Mystery Box 1/2 items (Gemstone, Lightbringer, Darkbringer and their Chromas): the DB `still_obtainable` was `false`, but the boxes are in the Shop, so these are now `obtainable`.
- Snowcannon, Snow Dagger, Raygun, Heart Wand, Sweet, Treat and Icecream: the DB flag or the wiki lead says "is obtainable", but their events have ended, so they are now `unobtainable`.
- Sunrise: the 2025 Summer Box page still says "currently obtainable", which is out of date. It is now `unobtainable`.
- Flames: the DB `obtain` says Crafting, but its recipe was removed in Season 1 (2019). It is now `unobtainable`.

## Unknown / low-confidence items

- **beachy**, **sands** (`unknown`, low): the sources disagree.
  - The wiki says both were limited-time Summer 2026 passes, and that event ended on Aug 23, 2026.
  - The Roblox API still lists "BUNDLE: Beach" (Beachy + Sands + Ocean effect) as for sale at 3,399 Robux. The single-item Beachy and Sands passes are not listed at all.
  - We could not confirm that buying the bundle now still grants the weapons, so the page should show only the trade/buy line.
  - To settle it: check the in-game Shop, or ask someone who bought the bundle after Aug 23.

## Other notes for the page

- Clockwork: the wiki gives two different past prices (899 vs 1,299 Robux), so we left the cost out.
- Rainbow Gun (Godly) is a different item from the Rare "Rainbow" gun in Mystery Box 1. The note says so.
- The Eternal I-IV and Eternalcane merch codes are historic. MM2 has no working codes for them.
