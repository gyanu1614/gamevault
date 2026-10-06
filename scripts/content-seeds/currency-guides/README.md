# Currency guide fact sheets (wave 1)

Data for the per-game "<Currency> Guide" section on currency pages (design: memory `SESSION-values-revamp-2026-10-04.md`, "CURRENCY GUIDE SECTION"). One JSON per game slug. Checked 2026-10-05.

## Method
- **Our delivery reality:** read prod `category_configs` (category_type=currency) and active currency `listings` read-only with the anon key. **No currency config has a `delivery_methods` field** (that key exists only on account configs: `manual|instant`). Every listing has `delivery_method = 'manual'`. So delivery steps come from `seller_instructions_placeholder` plus the live listing descriptions. Where those say nothing, the method is marked `unclear_see_notes` or worded to defer to the seller's note.
- **Official prices:** read from first-party pages where reachable: roblox.com/upgrades/robux (embedded JSON), store.ubisoft.com, store.playstation.com, Steam, Riot/Activision/Epic help. Otherwise from dated third-party summaries, named in each file's `notes`.
- **Game facts for Roblox experiences:** community fandom wikis (MediaWiki API) and fan guides. Developers rarely publish docs, so these files are lower confidence.
- **Copy:** our own wording, question headings, answer first. Competitor pages were used for facts only.

## Schema additions
- `official_prices.packages[].app_amount` (Roblox): Robux the same price buys in the mobile/console app.
- `official_prices.packages[].robux` with `usd: null`: games that sell their currency for Robux only (Grow a Garden, GaG2, 99 Nights). The renderer needs a "Robux" column for these.
- `packages: []` with a `note` (Blade Ball): the rate is known but pack sizes aren't.
- `delivery.method` values used: `game_pass`, `gifting`, `in_game_trade`, `code`, `account_topup`, `code_or_account_topup`, `unclear_see_notes`.
- `delivery.typical_time: null` when no live seller quotes a time.

## Config gaps (fix before the guide renders)
1. **Config FAQ is wrong for most non-Roblox games.** The shared FAQ answer "Never [share your password]. Delivery happens via the game's own trade/gift system — only your username/handle is required" is false for **V-Bucks, Valorant Points, R6 Credits, COD Points, Minecoins, GTA$ and FC Coins**. None of these can be traded or gifted from a balance. Our live **R6 sellers ask for the linked Xbox account login**, so the FAQ contradicts how they actually deliver.
2. **No `delivery_methods` on any currency config.** The guide needs a per-game method field, or the guide JSON becomes the source of truth.
3. **Unclear delivery:** fortnite, valorant, gta-v, fc25, minecraft, call-of-duty (no seller notes or no listings). Also grow-a-garden-2, anime-dice, tap-simulator and blade-ball (sellers only say "add you / send user").
4. **Currency mismatches:**
   - **grow-a-garden** config `unit_label = "Token"`, but the brief says Sheckles. The guide covers Trade Tokens and explains Sheckles.
   - **grow-a-garden-2** `unit_label = "Tokens"`, but the GaG2 wiki has only Sheckles, Leaves and unbuyable Guild Tokens. The guide is written for Sheckles.
   - **fc25** `unit_label = "units"`, and the listing says "800 FC Coins", which may really be FC Points.
   - **minecraft** `unit_label = "units"`.
5. **Stale game: fc25.** FC 26 and FC 27 (released 2026-09-25) are out, and FC 25 coins only work in FC 25.
6. **99 Nights** bundles: five of six have `amount: 0`. The tagline says "Gems" while unit_label says "Diamonds".
7. **grow-a-garden-2** FAQ has a test row ("Can you see this Question? | Yes").
8. **call-of-duty** platforms list both "Battlenet" and "Battle.net", plus "PC". Bundles 4,800 / 9,600 / 12,000 / 21,600 / 26,400 CP aren't official pack sizes.
9. **r6-siege** bundles 30,000 / 45,000 aren't official packs. **valorant** bundle "475 Points" has amount 75.

## Uncertain facts (by game)
- **roblox (high):** Roblox publishes no fixed pending period for pass sales. "5 to 7 days" comes from our seller and community reports, "up to 30 days" from Roblox. The age rule for direct Robux transfers differs between two Roblox articles (16+ vs 18+). Roblox Premium is replaced by **Roblox Plus** (2026-04-30, $4.99/mo, no stipend; Plus 500/1000/2000 at $8.99/$12.99/$21.99). Direct Robux transfers now exist (500/day, 1,000/month; 5,000/10,000 with 2SV). Regional pricing has been on by default for passes since 2026-03-30.
- **fortnite (medium):** prices come via Engadget (fortnite.com blocks bots). The date the Crew stipend dropped to 800 is uncertain.
- **valorant (medium):** US prices are third-party. Riot says 10 gifts/day, while older guides say 5.
- **r6-siege (medium):** I couldn't confirm whether R6 Credits are shared across platforms, so it's left out. The account-linking steps weren't read from a Ubisoft page.
- **gta-v (low):** Megalodon is 10M on PS5, but older and PC sources say 8M. GTA+ price is third-party. Delivery breaks Rockstar's terms: owner decision needed.
- **fc25 (low):** see the stale-game note. The FC Points carry-over rule is third-party.
- **grow-a-garden (medium) / grow-a-garden-2 (low) / 99 Nights (medium):** all from fandom wikis. The 99 Nights price table looked vandalised, so I kept only 3 rows. GaG's trading account-age limit is 7 or 10 days, written as "about a week".
- **blade-ball, tap-simulator, anime-dice (low):** from fan/third-party guides only. Anime Dice Gems may be account-bound (no trading, no Robux purchase), so confirm with sellers how they deliver.
- **escape-from-tarkov (low):** Flea Market gates are approximate. The meaning of the config's "Season" vs "Zone" regions wasn't verified. Buying Roubles is RMT under BSG rules, with a ban risk.
- **minecraft (medium):** prices and the Switch exception are third-party (help.minecraft.net timed out).
- **call-of-duty (medium):** the platform-lock rule is from the BO6 support article, assumed unchanged for BO7. Prices are third-party.

## Safety-copy flags for the parent's "Is It Safe" section
Account access is needed for **R6** (confirmed from our listings) and likely for **V-Bucks / VP / COD / FC / GTA** top-ups, so those pages shouldn't say "no password needed". RMT is against the rules in **Tarkov** and **GTA Online** (ban risk).
