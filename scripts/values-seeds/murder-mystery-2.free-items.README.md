# MM2 free items: data notes (checked 2026-10-05)

Data for the "Free MM2 Items" guide: `murder-mystery-2.free-items.json`. Research only; no app code.

## Summary
- **10 ways** are listed. Seven really give items for free: coins and boxes, salvage and craft, event pass, event quests, live events and hunts, Christmas gifts, trading up. One more (event leaderboards) is free but unrealistic for most players. Two are honest "nothing here" entries: leveling and prestige give no items, and there is no daily or login reward outside events.
- **Best free routes:**
  - **Seer:** guaranteed by crafting (20 Legendary shards = 10 Legendaries salvaged). By our math that is about 135 box spins (~135k Coins) if you salvage everything.
  - **Godly from boxes:** a 0.2% roll, about 500 spins (500k Coins) on average.
- **Codes:** none work.
  - The last free in-game code was **COMB4T2 (Combat II), about May 2, 2020**. The common claim "no codes since 2017" is wrong: HW2017 was Oct 2017, but COMB4T2 came later.
  - Every other code and merch promo is dead. The last merch code was Eternal IV (May 20, 2020). shopmm2.com has no A record today.
  - The NERF codes (SharkSeeker 2021, Dartbringer 2022) need a bought blaster and give untradeable guns, so they are listed as not free.
  - Guides say an "Enter Code" box is still in the Inventory, but nothing redeems.
- **Event state:** consistent with `murder-mystery-2.events.json`. No event is live, and Halloween 2026 has no date (Halloween 2025 started Oct 18, 2025). Event items do not return.

## Method
- **MM2 Fandom wiki, MediaWiki API** (`action=query&prop=revisions`): Codes, Promos, Merchandise, every code item page, Timeline, Coins, Boxes, Mystery Box 1, Knife Box 1, Shop, Crafting, Shards, Metals, Seer, XP, Prestige, Badges, Trading, Duping, Elite Gamepass, Diamonds, Mystery Key, Evo Weapons, Gifts, and the Halloween 2025, Christmas 2025, Valentine's 2026 and Summer 2026 event pages.
- **Code dates:**
  - Taken from the wiki text plus the cited Nikilis tweet IDs, decoded to UTC with the snowflake formula.
  - The COMB4T2 date is the creation time of the wiki's Combat II page (2020-05-02) and the May 2020 Update page.
- **Roblox public APIs:**
  - Game record: universe 66654135, last updated 2026-09-24.
  - Game passes: 72 listed.
  - Nikilis's groups: "Murder Mystery" 1030692.
  - Virtual events: empty.
- **Discord invite API:** `pnpbbtZ` is official. It was created by the `nikilisrbx` account and the server has ~606k members.
- **Third-party code sites, checked for consensus only:** Pocket Tactics (Oct 2, 2026), The Spike (Sept 6, 2026), plus search results.
- **Roblox Help articles** on free-Robux generators, used for the scam section.
- **Our own math:** the odds and cost figures in `ways` come from the wiki's box odds and recipes and are labelled "our math". They are averages; real results vary.

## Uncertain points
1. **Is the code box live?** Sites agree there is an "Enter Code" box in the Inventory, but some say Redeem does nothing. We could not check in-game, so `redemption_available: true` describes the UI only.
2. **Code spellings conflict on the wiki:** F1RSTC0D3/F1RSTCOD3, N3ON/N30N, D3NIS/D3N1S, B4CK2SK00L/SK00L, COMB4T2/C0MB4T2, and N3XTL3V3L (other sites: TH3N3XTL3V3L). We used the Codes-page spelling and noted the variants. All are expired, so this does not affect players.
3. **Missing dates:** no release dates are recorded for Skool, TNL, Prism, the five Pals knives (Alex, Corl, Denis, Sketchy, Sub), the Rainbow merch promo and JD. All predate 2019.
4. **NERF codes:** whether an unused code from old stock still redeems is unknown. They are not free either way.
5. **Box odds:** the wiki's rarity odds add up to 100.2%. Treat them as rounded. The Sept 1, 2026 update added an in-game "chance per item" view, which would be the exact source if someone checks in-game.
6. **No daily or login reward outside events:** based on wiki searches, not an in-game check. Confidence is medium.
7. **Virtual-events API:** it returned nothing, even for 2026. It may only list upcoming or active events. Useful as a "something got scheduled" signal, but not proven.
8. **X (@NikilisRBX):** there is no free API, so the weekly job has to use the wiki, Roblox game, game-pass and group signals as proxies.
