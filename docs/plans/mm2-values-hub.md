# MM2 values hub — plan (2026-10-05)

Positioning: **"MM2 values in real money."** Every competitor (mm2values, supremevalues/cosmicvalues, mm2.rocks, mm2values.app, bloxultra) lists community points ("seers"/MM2V). Nobody shows live USD + price history + "listed now" supply + a buy/sell link per item. Eldorado has one static USD blog table (Jul 27).

## Data (verified 2026-10-05)
- Eldorado gameId 204: 14,604 offers, structured `Item type` / `Rarity` / `Item name` (+ year), chroma in `attributes[mm2-properties]`, stable `standardizedProductKey`. 888 items, ~942 item×chroma groups; **876 launchable** (≥3 offers from 200+-review sellers); **216 high-tier** (Godly/Ancient/Vintage/Unique/Chroma). No sales velocity → demand from our daily snapshots (offers, sellers, stock drops).
- Taxonomy/images: MM2 Fandom wiki API (821/888 names match; aliases table for the rest). Images copied to our bucket; CC-BY-SA attribution. Wiki `value=` field and competitor values are NOT used (no permission).
- Chroma items = own rows linked to base (`chroma-fang` → `fang`). Sets = bundle rows (phase 2, title-matched).
- Prices are low: half under $0.50; 75 ≥ $5; 26 ≥ $50 (Chroma Traveler's Gun ~$4,050).

## Pages (launch)
| URL | What |
|---|---|
| /murder-mystery-2/values | Value list on ValueCard: tabs Godly · Ancient · Vintage · Chroma · Unique · Pets (+ All); USD floor + market, "N listed now", 7-day trend; sort by price/movers/listed |
| /values/[item] | **216 high-tier item pages** (commons stay list rows, no page): USD hero, Chroma ↔ base switch, 7D/30D/90D/All chart, listed-now + Available Now carousel, origin/year (wiki), siblings rail, FAQ + Product schema |
| /values/halloween-2026 | Event hub (Halloween ~mid-Oct): past Halloween sets with USD, launch-price → week-4 tracker, pass/candy explainer |
| /calculator | **Trade Checker** (USD gap + fairness %, listed-now/demand per side, verdict) + **Inventory Worth** tab (pick items → total USD → "List them on DropMarket") |
| /price-index | Weekly movers (risers/fallers), most expensive, most listed |
| /values/methodology | How our USD values + tiers + demand are derived |

## Why people come (hooks)
1. Real-money values on every item (unique).
2. **Inventory Worth → sell CTA** — doubles as seller acquisition (we have 0 MM2 listings).
3. Halloween 2026 hub at peak season.
4. Weekly "Value Changes" (shareable OG card) + Discord `/price mm2 <item>`.
5. Listed-now supply + one-click buy.
6. Phase 2: price-drop alerts (email/Discord), set completion cost, "buy vs trade" cheapest path.

## Blog (first wave)
MM2 Value List explained (points vs USD) · Halloween 2026 guide · Halloween items value list 2015–2025 · MM2 codes (honest: none active, how to earn) · Most expensive MM2 items (real prices) · Rarest items · Chroma guide + values · Sets value guide · Godly tier list · How to trade safely · What WFL means + reading a trade · How MM2 values work · Harvester / Gingerscope / Traveler's Gun value · Christmas 2026 guide (late Nov).

## Engineering
- Generic `values_*` pipeline (Steal an Egg already on it) + ONE migration: values_items item_type, base_item_id, release_year, origin, wiki_title, kind 'bundle'; values_raw_listings seller_ref, source_item_key, source_variant.
- Reusable **eldorado-structured normaliser** (config in values_games.sources) → Blox Fruits next is config + seed.
- MM2 job in values-pricing-daily.yml (~293 pages, 8–25 min); changed-only publish.
- Theme entry; generic hub sections by item type/rarity; marketplace template `select-item` field for clean listing matching.

## Build order
1. Data + pipeline (migration, normaliser, wiki import + images, first crawl, dry-run review).
2. Value list + item pages + methodology.
3. Calculator: Trade Checker + Inventory Worth.
4. Halloween hub + price index + first 5 posts (target ~Oct 12–14).
5. Discord command, alerts, sets.

## Risks
Cheap bot-farmed commons (pages only for high-tier) · single source (G2G 403) · seller concentration · name aliases · licensing attribution · 0 sellers (outreach in parallel).
