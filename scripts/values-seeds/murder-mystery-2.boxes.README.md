# MM2 boxes and odds: data notes (checked 2026-10-05)

Data for the "MM2 Box Odds" explorer: `murder-mystery-2.boxes.json`. Research only; no app code.

## Summary
- **44 boxes**: 12 in the Shop now (11 weapon boxes + the Common Egg) and 32 retired (26 event boxes, the Pet Box and 5 removed pre-Season 1 boxes).
- **639 box items**, 637 matched to a `values_items` slug (99.7%). Two unmatched, both from the 2026 Summer Box: **Floral (2026)** (uncommon gun) and **Sunset (2026)** (rare gun). Our catalogue has no rows for them. `floral-gun` is the 2024 Floral and `sunset` is the 2025 Godly, so neither is a match.
- **In-game evidence:** on Sep 1, 2026 MM2 added a "Chances Per Item" screen to the Shop. @Colbemo posted two screenshots of it the same day (https://x.com/Colbemo/status/2094849366645203424): one of Summer Box '26 and one of the Common Egg. These are the only first-hand odds we found. Everything else comes from the MM2 Fandom wiki.

## Odds structure
- **Per tier, split evenly.** The game shows each tier's chance, and each item gets that chance divided by the number of items in the tier. For example, on Summer Box '26 the screen shows "Tourist - 70%/4 = 17.50%". `odds_by_rarity` holds the tier figures. `pct_per_item` is filled in only for the two boxes in the screenshots.
- **Chroma is its own line** ("Chroma - 0.004%"), listed under Godly. The game does not say whether it comes out of the 0.2% Godly chance or is added on top.
- **Permanent weapon boxes** (all 11): Common 70%, Uncommon 15%, Rare 10%, Legendary 5%, Godly 0.2%, Chroma 0.004%. Each box holds 4 Commons, 3 Uncommons, 2 Rares, 1 Legendary, 1 Godly and its Chroma. Mystery Box 2 is the exception, with 2 Godlies and 2 Chromas.
- **Common Egg** (from the in-game screenshot):
  - Common 70%: Cat, Dog and Bunny at 23.33% each.
  - Uncommon 15%: Pig and Fox at 7.5% each.
  - Rare 10%: Bear.
  - Legendary 5%: Bat.
  - Godly 0.2%: 7 Fire pets at 0.029% each.
  - Chroma 0.004%: one line for all Chroma Fire pets.
- **Valentine's and Summer 2026 boxes:** Common 70%, Uncommon 18%, Rare 8%, Legendary 4%, Godly 0.2%.
- **The 100.2% total is real.** The tiers add up to 100.2%, plus 0.004% for Chroma. The in-game screen itself shows these numbers, so this is not a wiki typo. They are the game's rounded display figures, and the true weights are not published.
- **Price (permanent boxes):** 1,000 Coins, 100 Diamonds or 1 Mystery Key per spin.
  - The Common Egg costs 1,000 Coins or 100 Diamonds and cannot be opened with a key.
  - A Mystery Key costs 125 Diamonds in the Shop (wiki), so buying a key with Diamonds is worse than spending 100 Diamonds directly.

## Per-box summary

| Box | In Shop | Godly (Chroma) | Odds source | Confidence |
|---|---|---|---|---|
| Mystery Box 2 | yes | Lightbringer, Darkbringer (+ Chromas) | wiki, 0.2% / 0.004% | high |
| Mystery Box 1 | yes | Gemstone | wiki | high |
| Knife Box 1-5 | yes | Deathshard, Fang, Saw, Slasher, Tides | wiki | high |
| Rainbow Box | yes | Heat | wiki | high |
| Gun Box 1-3 | yes | Luger, Shark, Laser | wiki | high |
| Common Egg | yes | 7 Fire pets (+ 7 Chroma Fire) | in-game screenshot | high |
| 2026 Summer Box | no (see below) | Icecream | in-game screenshot = wiki | high |
| 2026 Valentine's Box | no | Heart Wand | wiki; Chroma "<0.1%" | medium |
| 2023 Halloween - 2025 Christmas (8 boxes) | no | Traveler's Gun ... Snow Dagger | wiki; Godly 0.2%, Chroma unknown | medium |
| 2015 - 2022 event boxes (16) | no | Candy, Sugar ... Cookiecane | wiki; Godly "<1%" estimate | low |
| Pet Box | no | Deathspeaker | wiki; Godly "<1%" estimate | medium |
| Legendary / MLG / Chroma / Rare / Uncommon / Common Box | no | various / none | wiki; pre-2019, unreliable | low |

## Method
1. **Box list:** the wiki `Boxes` and `Shop` pages (edited 2026-09-04 and 2026-08-15), plus `Category:Boxes` and `Category:Crates` from the MediaWiki API.
2. **Contents and odds:** the wikitext of every box page, parsed from its rewards table. Rarity comes from the table, or for the old boxes from their tier sub-tables. Item types come from our catalogue when matched, because the wiki's Type column is wrong on several rows of the 2023 Christmas Box.
3. **Odds history:** the Sep 1, 2026 diffs of Knife Box 1, Mystery Box 2 and Common Egg. The same editor changed every permanent box's Godly/Chroma entry from "unknown" to 0.2% / 0.004% on the day the in-game screen launched.
4. **In-game check:** @Colbemo's screenshots, fetched through the public fxtwitter API and read by eye. They match the wiki for Summer Box '26 and contradict the wiki for the Common Egg (see below).
5. **Slug matching:** each item's own wiki page title, after resolving wiki redirects (for example, "Pumpkin Patch" goes to "Pumpkin Knife (2019)"), slugified and looked up in the prod `values_items` table for murder-mystery-2 (1,067 rows, anon key). There is no fuzzy fallback. A name-only fallback gave wrong matches in testing (Candy Corn 2019 mapped to the 2025 knife), so it was dropped. All matched items' catalogue rarity agrees with their box tier.
6. **Dates:** event boxes use the event start and end dates from `murder-mystery-2.events.json`. Permanent boxes use dates from their wiki pages. Season 1 was May 25, 2019, and the March 2020 Update was Mar 5, 2020.

## Uncertain points
1. **Mystery Box 2 Godlies.** The wiki shows 0.2% next to Lightbringer and 0.2% next to Darkbringer. By the in-game rule (tier ÷ items) that would be 0.1% each, but no screenshot of this box was found. We store the tier as Godly 0.2% and flag the split in `notes`. The same question applies to its two Chromas at 0.004%.
2. **Common Egg: the wiki is wrong.** The wiki shows Common 60%, Pig "Uncommon 60%", Fox 25%, and 0.2% for each Fire pet. The in-game screen shows 70/15/10/5 and 0.029% per Fire pet. We used the in-game figures. The per-pet Chroma chance is not shown, so it is null.
3. **Summer Box '26 status.** The event ended Aug 23, 2026, but the Sep 1 screenshot shows the box in the Shop with a 60-Diamond button. We could not confirm whether it can be opened now. `in_shop: false` matches the events and how-to-get files. An in-game check settles it.
4. **Chroma rate on event boxes before Summer '26.** The wiki gives 0.2% (2023 Christmas, 2024 Summer, 2025 Summer; the same as the Godly, which is unlikely), "<0.2%", "<0.1%" or "???". We kept the text in `pct_text` and set `pct` to null.
5. **Pre-2023 event boxes:** the Godly chance was never shown. The wiki's "<1%*" and "1%*" (2019 Halloween) are estimates.
6. **Pre-Season 1 boxes:** the wiki figures do not add up. The Uncommon Box totals 128%, and the Legendary Box shows "100%" per Legendary and "~40%*" per Godly. Use them for item lists only.
7. **The 0.2% overrun** is in the game's own display. We publish the numbers as shown and do not normalise them.
8. **Third-party articles:**
   - mmoexp.com: one article says "Taurus 17.5%" (the screenshot says Tourist), another says a Godly is "around 2%".
   - mm2.rocks gives Chroma Icecream as "<0.1%".

   These conflict with the screenshots and were not used as sources.
9. **The Chroma Box knives** (Clay, OJ, Plum, ...) no longer exist in-game according to the wiki, but our catalogue still has rows for them. They are matched, and the box is marked retired.

## Unmatched items
- `2026 Summer Box`: **Floral** (wiki page "Floral (2026)", Uncommon gun), **Sunset** (wiki page "Sunset (2026)", Rare gun). Add catalogue rows (for example `floral-2026`, `sunset-2026`) if the explorer should link them.
