# MM2 "How to get" dataset (checked 2026-10-05)

File: `murder-mystery-2.how-to-get.json`, with one object per item (213 items). That is every MM2 item with a value page (`valueItemHasPage`).

- **Pass 1** (the first 100 entries): the 100 most-listed items.
- **Pass 2** (the last 113 entries, same day): every other item with a page, researched from the highest price down.

## Counts by status

| status | items |
|---|---|
| obtainable | 45 |
| seasonal | 0 |
| unobtainable | 164 |
| unknown | 4 |

Confidence: 208 high, 1 medium, 4 low.

No item is `seasonal`. MM2 event items do not come back in later events: each Halloween/Christmas brings new items, so an older event item stays trade-only.

## What is live in MM2 right now (2026-10-05)

- **No event running.** The last events were Summer 2026 (Jul 23 - Aug 23, 2026) and the Roblox "The Hunt: Roblox 20" tie-in, which started on Sep 17, 2026 and is now over. Halloween 2026 is not out yet and has no confirmed date. Halloween 2025 ran from Oct 18 to Nov 21, so a mid-to-late October start is likely. When it launches, its new items are the only `seasonal`/event candidates; re-check this file then.
- **Shop boxes (permanent):** Mystery Box 1, Mystery Box 2, Knife Box 1-5, Rainbow Box and Gun Box 1-3. Each spin costs 1,000 Coins, 100 Diamonds or 1 Mystery Key. In every box the Godly drops at 0.2% and its Chroma at 0.004%. Mystery Box 2 has two Godlies, Lightbringer and Darkbringer.
- **Common Egg (Shop, permanent):** 1,000 Coins or 100 Diamonds per hatch (no Mystery Key). Each of the 7 Fire pets hatches at 0.2%, and each Chroma Fire pet at 0.004%. The old Pet Box (Deathspeaker) is gone: the Common Egg replaced it in Season 1.
- **Crafting Station:** Seer (20 Legendary Shards) and Random Painted Seer (10 Godly Shards + 10 Godly Metals). The painted Seer recipe gives a random colour: Red, Orange, Yellow, Blue, Purple or a rare Chroma Seer.
- **Robux gamepasses on sale (Roblox API):** only Elite, Radio and the "BUNDLE: Beach". Every godly/item-pack gamepass that matches an item in this list is `isForSale: false`.

## Method

1. **Item pick (pass 1):** We took items with a page (rarity Godly/Ancient/Vintage/Unique/Chroma, `is_priced`, per `valueItemHasPage`) and ranked them by active matched `values_raw_listings` from reputable sellers (`seller_reviews >= 200`). Ties were broken by `values_prices.average_usd`, and we kept the top 100.
   **Item pick (pass 2):** Every remaining item with a page whose `values_items.how_to_get` was null (113), ordered by `values_prices.average_usd`, highest first.
2. **Item facts:** We pulled the wikitext for every item page through the MM2 Fandom MediaWiki API (infobox `obtain` and lead), plus every box, event, gamepass and crafting page each item depends on. Odds and costs come from the box and event pages.
3. **Current state:** We checked each wiki flag against:
   - the events' start and end dates on their own wiki pages;
   - the last-edit dates of the Shop, box and Crafting pages (box pages edited 2026-09-01, Crafting 2026-09-28);
   - the official Roblox game-pass API (`apis.roblox.com/game-passes/v1/universes/66654135/game-passes`), which gives the live `isForSale` for every MM2 gamepass;
   - a web search for Halloween 2026 news.
4. The `method` and `note` text is our own wording. Wiki estimates such as "<1%*" are labelled "(wiki estimate)".

### Wiki flags we corrected (pass 1)

- Mystery Box 1/2 items (Gemstone, Lightbringer, Darkbringer and their Chromas): the DB `still_obtainable` was `false`, but the boxes are in the Shop, so these are now `obtainable`.
- Snowcannon, Snow Dagger, Raygun, Heart Wand, Sweet, Treat and Icecream: the DB flag or the wiki lead says "is obtainable", but their events have ended, so they are now `unobtainable`.
- Sunrise: the 2025 Summer Box page still says "currently obtainable", which is out of date. It is now `unobtainable`.
- Flames: the DB `obtain` says Crafting, but its recipe was removed in Season 1 (2019). It is now `unobtainable`.

### Wiki flags we corrected (pass 2)

- **Event ended, but the DB flag or the wiki lead still says obtainable.** These are now `unobtainable`:
  - Chroma Alienbeam, Chroma Raygun, Chroma Sunrise, Chroma Sunset and Sunset;
  - Chroma Snowcannon, Chroma Snow Dagger and Ornament (Christmas 2025, ended Jan 19, 2026);
  - Chroma Heart Wand, Chroma Treat and Chroma Sweet (Valentine's 2026, ended Apr 13, 2026);
  - Chroma Icecream (Summer 2026);
  - Frostbird (Christmas 2018).
- **Robux gamepass, DB flag says obtainable.** Roblox's API lists all of these passes and their bundles as `isForSale: false`, so they are now `unobtainable`: Soul, Spirit, Xenoshot, Xenoknife, Flora, Bloom, Australis, Borealis, Pearl, Pearlshine, Darkshot, Darksword, Blizzard, Snowstorm, Chroma Blizzard and Chroma Snowstorm.
- **Box in the Shop, DB flag says not obtainable.** Chroma Gemstone is in Mystery Box 1, which is in the Shop, so it is now `obtainable`.
- **Snowstorm Bundle:** Chroma Blizzard and Chroma Snowstorm wiki pages mention a "Blizzard/Snowstorm Gamepass". The event and bundle pages say no single passes were sold, so the method names the bundle only.
- **Chroma odds left out:** for Chroma Evergreen, Chroma Watergun and Chroma Sunrise, the wiki box table gives the Chroma the same 0.2% as the Godly. We could not confirm that, so we show no rate. A "<0.2%" or "<0.1%" figure is shown as a "wiki estimate". Where the wiki gives "about 1 in 50" (Chroma Bauble, Chroma Raygun) or 2% (Chroma Sunset), we show it and label it.
- **Prices with two values:** Steambird is in the same case as Clockwork (899 vs 1,299 Robux), so it has no cost. The Xenoknife page gives 3,499 Robux for the Xenotech Bundle, but the bundle and event pages give 3,399, so we used 3,399.

### Corrections to the first 100

- **old-glory, virtual, blaster, clockwork:** `released` said 2017. The item-pack wiki pages give these 2016 launch dates:
  - American Item Pack: Jul 2, 2016
  - Futuristic Item Pack: Mar 22, 2016
  - Clockwork Item Pack: Feb 9, 2016

  We changed `released` to the 2016 month and added the pack page as a source. No status changed.

## Unknown / low-confidence items

- **beachy**, **sands**, **chroma-beachy**, **chroma-sands** (`unknown`, low): the sources disagree.
  - The wiki says both were limited-time Summer 2026 passes, and that event ended on Aug 23, 2026.
  - The Roblox API still lists "BUNDLE: Beach" (Beachy + Sands + Ocean effect) as for sale at 3,399 Robux. The single-item Beachy and Sands passes are not listed at all.
  - We could not confirm that buying the bundle now still grants the weapons, so the page should show only the trade/buy line.
  - We also could not confirm whether a purchase now can still roll the Chroma.
  - To settle it: check the in-game Shop, or ask someone who bought the bundle after Aug 23.
- **deathspeaker** (`unobtainable`, medium): Deathspeaker came from the Pet Box.
  - The Shop page, the Deathspeaker page and most of the Pet Box page agree that the box was removed in Season 1 and replaced by the Common Egg.
  - One sentence on the Pet Box page says it is "currently purchasable" for 1,000 Coins. That contradicts the rest of the page, so confidence is medium.

## Other notes for the page

- Clockwork: the wiki gives two different past prices (899 vs 1,299 Robux), so we left the cost out.
- Rainbow Gun (Godly) is a different item from the Rare "Rainbow" gun in Mystery Box 1. The note says so.
- The Eternal I-IV and Eternalcane merch codes are historic. MM2 has no working codes for them.
- Laser (Vintage) is a different item from the Godly Laser in Gun Box 3. Its MM1 price is shown in Points only, because the wiki gives two Cash prices (15 and 20).
- The Vintage weapons (Laser, Phaser, Ghost, Blood, Shadow, Cowboy, Golden, Splitter, Prince, America) came from the Murder Mystery 1 shop. MM1 was replaced by MM2 on Dec 25, 2014.
- Fire pets and Chroma Fire pets are Godly **pets**, not weapons. The note says so.

## Correction 2026-10-05 (from the box research)
- Common Egg Fire pets: the in-game "Chances Per Item" screen (screenshot: https://x.com/Colbemo/status/2094849366645203424) splits the 0.2% Godly tier across 7 pets → about 0.029% each; one Chroma line at 0.004% is shared by the 7 Chroma Fire pets → about 0.00057% each. The wiki's 0.2% per pet was wrong.
- Mystery Box 2 (Lightbringer, Darkbringer, their Chromas): the wiki says 0.2% each, but under the in-game split rule it could be 0.1% each; no screenshot of this box, so no rate is quoted (odds removed).
