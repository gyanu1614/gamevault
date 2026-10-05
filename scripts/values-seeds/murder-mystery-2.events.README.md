# MM2 events archive dataset (checked 2026-10-05)

File: `murder-mystery-2.events.json`. It is an array with one object per Murder Mystery 2 event, newest first: **39 events**, from Halloween 2015 (MM2's first event) to the upcoming Halloween 2026.

- Every `summary` and `how_items_were_obtained` line is our own wording. Each event has at least one source. Confidence is stated honestly.
- Item `slug`s are our `values_items` slugs (prod catalogue, anon read-only, 1,067 MM2 items). A slug does not mean the item has a page. Only Godly/Ancient/Vintage/Unique/Chroma items with a price have pages. The 213 slugs in `murder-mystery-2.how-to-get.json` are that set.
- The `how` on an item comes from one of three places:
  - the verified `method` in `murder-mystery-2.how-to-get.json` (for items with a page);
  - otherwise, the catalogue's `obtain` entry (pass tier / box / gamepass / event task);
  - otherwise, an event-specific note we wrote from the event page.

## State on 2026-10-05

- No MM2 event is live.
- The last events were:
  - Summer 2026 (Jul 23 - Aug 23, 2026);
  - The Hunt: Roblox 20 tie-in (Sep 17 - Sep 28, 2026).
- Halloween 2026 is the only `upcoming` entry. It has no date (`starts_on: null`), `format: null` and `items: []`. Its summary says the date is not announced and that Halloween 2025 started Oct 18, 2025.
- Event items do not return. Every `ended` event's items are trade-only now.

## Counts by season and year

| year | halloween | christmas | easter | valentines | summer | other | collab | total |
|---|---|---|---|---|---|---|---|---|
| 2015 | 1 | 1 |  |  |  |  |  | 2 |
| 2016 | 1 | 1 | 1 | 1 |  |  |  | 4 |
| 2017 | 1 | 1 |  |  |  |  |  | 2 |
| 2018 | 1 | 1 |  |  |  |  |  | 2 |
| 2019 | 1 | 1 |  |  |  |  | 1 | 3 |
| 2020 | 1 | 1 |  |  |  |  | 1 | 3 |
| 2021 | 1 | 1 |  |  |  |  |  | 2 |
| 2022 | 1 | 1 |  |  |  |  |  | 2 |
| 2023 | 1 | 1 | 1 | 1 | 1 | 1 |  | 6 |
| 2024 | 1 | 1 | 1 |  | 1 |  |  | 4 |
| 2025 | 1 | 1 | 1 |  | 1 | 1 |  | 5 |
| 2026 | 1 (upcoming) |  |  | 1 | 1 |  | 1 | 4 |
| **total** | 12 | 11 | 4 | 3 | 4 | 2 | 3 | **39** |

- `other` = Thanksgiving 2023 and Thanksgiving 2025.
- `collab` = RB Battles Season 1 (2019), RB Battles Season 2 (2020) and The Hunt: Roblox 20 (2026).
- Confidence: 32 high, 7 medium, 0 low.

## Items

- **768 item rows**, of which **763 match a catalogue slug (99.3%)** and **132 have a value page**. That covers 132 of our 213 paged items. The other 81 paged items are not event items: permanent boxes, 2016 item packs, standalone gamepasses, crafting, codes and Murder Mystery 1 vintages.
- Each event lists the tradeable weapons and pets in our catalogue that the wiki and catalogue tie to it. That includes the event pass, the event box, event gamepasses/bundles, task and leaderboard rewards.
  - Effects, radios, toys/emotes and perks are not listed (they are not in our catalogue). The event's `how_items_were_obtained` line mentions them where they matter.
- Only two high-tier event items have no page: `chroma-ornament` (Christmas 2025) and `ghosty-pet` (Halloween 2019).

### Events with the most items on our value pages

| event | paged items |
|---|---|
| Christmas 2025 | 9: Snowcannon, Snow Dagger, Blizzard, Snowstorm, Ornament, Chroma Snowcannon/Snow Dagger/Blizzard/Snowstorm |
| Christmas 2024 | 7: Celestial, Bauble, Constellation, Australis, Borealis, Chroma Bauble/Constellation |
| Christmas 2015 | 7: Xmas, Candy, Sugar, Chill, Handsaw, Red Luger, Green Luger |
| Summer 2026, Valentine's 2026, Halloween 2025, Halloween 2022, Christmas 2021, Christmas 2019 | 6 each |
| Halloween 2024, Christmas 2023, Halloween 2023 | 5 each |

These events have no paged items: Halloween 2026 (no items yet), The Hunt: Roblox 20, Thanksgiving 2025, both RB Battles, Easter 2016 and Valentine's 2016. All of their items are Common to Legendary, or they have none.

### Items that matched no slug (`slug: null`)

- **The Hunt: Roblox 20, Retro Bundle:** Laser (Knife), Phaser (Knife), Prince (Gun), Ghost Gun (Uncommon). These are new Rare/Uncommon MM1-style skins, not the Vintage items with the same names, and they are not in our catalogue yet.
  - The other three bundle items do match: `golden-knife`, `shadow-gun` and `cowboy-knife`. Our DB `origin` says "Shop" for them; the wiki event page says they came in the Retro Bundle.
- **Thanksgiving 2025:** Stickers (Thanksgiving 2025), a Common knife (1,000 Coins / 100 Diamonds). It is not in our catalogue.

### Items we deliberately left out

- **Unreleased:** Frozen Gun (2022), Frozen Knife (2022) and Wrapped Knife (2022) are in our catalogue under Christmas 2022. Their wiki pages say they were designed for that event but never released.
- **Linked from an event page but not part of it:**
  - Luger (Christmas 2018), Icewing (Halloween 2019/2022) and Heartblade (Christmas 2020);
  - Evergun/Evergreen and their Chromas (Summer 2025);
  - Deathshard, Classic Knife and Classic Gun. On The Hunt page these are hidden quest objects, not rewards;
  - SharkSeeker/Dartbringer, which are Hasbro promos named in trivia;
  - the Elite Gamepass items, except Green Elite, which was the Christmas 2015 limited Elite offer;
  - Deathspeaker/Nobledragon from the Pet Box, and Vampire's Edge uniques mentioned on the Halloween 2021 page.
- **Flames:** it appears in the Christmas 2016 event recipe list, but it was a general crafting recipe before 2019, so it is not counted as an event item.
- **Not events, so not listed:**
  - 2016 item packs (Clockwork, 8-Bit, Futuristic, American, Shadow);
  - standalone godly gamepasses (Prismatic 2020, Heartblade/Eggblade/Nebula 2021, Plasma 2022);
  - the Season 1 and March/May 2020 updates;
  - merch knives (Eternal series);
  - promos (Hasbro Nerf, No Man's Sky, Prime Gaming, Xbox).
- **Vampire Hunt** has its own wiki page, but it is a game mode inside Halloween 2024, not a separate event.

## Medium-confidence entries (no entry is low)

| event | why |
|---|---|
| `valentines-2016` | No end date on record: the wiki says only "later in the month", so `ends_on` is null. The start date comes from Nikilis's tweet. |
| `easter-2016` | Start date (Mar 25, 2016) comes from the Timeline and a Nikilis tweet. No end date on record. |
| `halloween-2016` | The event page says it started Oct 26, 2016, but the tweet it cites was posted Oct 28, 2016, and the Timeline says Oct 28. We used **Oct 28**. |
| `halloween-2021` | The event page says Oct 23, 2021. The Timeline and Nikilis's "out now" tweet say Oct 24 (tweet time 23:59 UTC Oct 24). We used **Oct 24**. |
| `easter-2023` | The event page says Apr 1, 2023 and the wiki Timeline says Apr 2. We could not settle it, so `starts_on` is **null** and the summary says "early April 2023". |
| `rb-battles-season-1` | Roblox's event (Sep 9 - 28, 2019) featured MM2 in a YouTuber tournament. The MM2 wiki says MM2 took part, but we found no record of MM2 in-game rewards, so `items: []`. |
| `rb-battles-season-2` | The MM2 wiki page has no dates. We used the Roblox event window (Nov 16 - Dec 14, 2020) from the Roblox wiki. MM2's own challenge (the RB Knife) ran inside it. |

Other date notes (high confidence kept):

- **Christmas 2015:** a pre-release lobby went up Dec 14 and the full event opened Dec 19. We used Dec 19, which both wiki pages and the cited tweet support.
- **Christmas 2020:** the pre-release date is Dec 13 on the event page and Dec 14 on the Timeline. We used the full release, Dec 23, which both agree on and a tweet confirms.
- **Halloween 2018 / 2019:** the cited tweets are timestamped early on the next UTC day. That matches US-evening releases on the dates we used.

## Method

1. **Event list:** we listed every non-redirect page on the MM2 Fandom wiki through its MediaWiki API (1,789 pages). We took every `<Season> Event <Year>` page (35) plus "RB Battles Season 2" and "The Hunt: Roblox 20 Event", and cross-checked them against the wiki Timeline page. The wiki has no "Events" list page (it returns missing). The Timeline was the master list.
2. **Dates:**
   - We read each event page's lead and compared it with the Timeline.
   - Where a page cites a Nikilis tweet, we decoded the tweet's timestamp from its ID (Twitter snowflake) and used it to settle conflicts.
   - Tweet URLs cited in a page's lead are added to that event's `sources`.
3. **Items:** each event's items are:
   - catalogue items whose `obtain`/`origin` names the event page;
   - plus that year's event box;
   - plus the boxes, packs, bundles and gamepasses the event page links to.
   - Generic containers were removed (Elite Gamepass, Pet Box, Common Egg, Mystery Boxes).
   - Then we checked by hand every Godly/Ancient/Chroma item the event page links to (see the left-out list above).
4. **External checks (web search):**
   - Roblox wiki: RB Battles Season 1 and 2 dates; MM2 listed as a game in both.
   - MM2 sat out The Hunt: First Edition (Mar 2024) and The Hunt: Mega Edition (Mar 2025), so neither is an MM2 event. It was in the trailer for First Edition but not in the event.

## Sources blocked

- None. The MM2 Fandom wiki answered normally through its MediaWiki API (`murder-mystery-2.fandom.com/api.php`, via curl), and so did the Roblox Fandom API. No 402 or blocked responses, so no mirrors (mm2wiki.org etc.) were needed.
- Twitter/X was not fetched directly. Tweet dates come from decoding the tweet IDs the wiki cites.

## Re-check when

Halloween 2026 is announced. At that point, fill in `starts_on`, set `status: live`, and add its items.
