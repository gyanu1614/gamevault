# Game Hub Homes: plan (awaiting owner decisions)

Readable version: https://claude.ai/artifact/7VN7syJcT3TRHBMrmJaDPJ (private).

**Goal:** one home page per game (Steal a Brainrot, Adopt Me, MM2 first; Steal an Egg later), built as one template, so a future values game gets it automatically:
- hot items and real prices;
- guides, tools and shop.

## Evidence (2026-10-23)

**Search referrers** (Vercel Web Analytics, 2026-07-23..10-22):
- Bing 1,518 visitors;
- DuckDuckGo / Yahoo / Ecosia ~370 (all use Bing's results);
- ChatGPT 99;
- Google 58.

So Bing sends ~25× Google.

**Top Bing landing pages:**
- /adopt-me/values 150
- / 101
- /steal-a-brainrot/values 87
- an Adopt Me sell guide 82
- /adopt-me/sell 60
- /adopt-me 23

**Google Search Console:**
- Item-level queries only.
- /[game]/blog index pages get ~0 visitors from both engines.
- Guide articles do get Bing visitors.

**Keyword tools:** Ahrefs = insufficient plan; Semrush = no API units.

**Competitors** (elvebredd, adoptmetradingvalues, adoptmevalues.app/.gg, supremevalues, mm2values, mm2.rocks, game.guide, rblxguide, stealarot, SAB Helper, Rolimons):
- Usual home sections, in order: freshness stamp → calculator → Trending/Hot → value changes → Rising & Falling → Most Valuable by type → browse by rarity → New → list → FAQ.
- Gaps nobody fills:
  - value vs the cheapest live listing (deals);
  - most selling from real sales;
  - 7-day % on cards;
  - live supply per item;
  - early prices for new items;
  - one home that combines values, prices, guides and tools.

## Recommendation

**Address**
- `/[game]` becomes the hub home for games with a values hub. Shop sections stay; "Marketplace" stays in the title.
- `/[game]/values` is unchanged (Bing #1).
- `/[game]/blog` stays the guides list, and article URLs stay.
- The other ~239 games are unchanged.
- Fallback: use `/[game]/blog` as the home instead.

**Sections** (each shows only when its data exists):
1. Hero: freshness, items priced, offers live, players online; CTAs Value List / Calculator / Shop.
2. Hot Right Now: top-50 popular AND up over 7 days.
3. Most Popular: Eldorado activity rank.
4. Below Market Deals: our listing ≥ 5% under market.
5. Rising & Falling: 7-day %.
6. New In {Game}.
7. Most Valuable: tabs by type.
8. Latest Price Changes.
9. Browse by rarity, then tools.
10. Guides.
11. Shop (today's category cards).
12. FAQ / About.

**Layout:** 6-card rows on desktop; Embla rails on phones.

## Data readiness

- Ready for all three games: Deals, Rising & Falling (#230), New (#230), Most Valuable, Latest Price Changes, hero numbers, guides, tools, shop.
- Most Popular / Hot:
  - SAB is ready;
  - **Adopt Me's demand_rank has been frozen since the adoptmevalues scraper was removed (values-platform step B)**;
  - MM2 has no popularity signal.
- Sold On DropMarket needs a nightly sales summary.

## Build order (one PR each)

1. **Popularity.** Eldorado popular-items feed for Adopt Me + MM2 in the daily price job (generalise scripts/collect-eldorado-popularity.mjs). Migration: values_items.popularity_rank. This unfreezes Adopt Me's Popular order.
2. **Hub home template** at `/[game]`:
   - sections and a matching loading skeleton;
   - SEO title/H1/description and JSON-LD;
   - game switcher → `/[game]`;
   - static-first, reusing the value list's cached reads;
   - guard tests;
   - checked on desktop + phone.

   No migration.
3. **Sold On DropMarket.** A nightly sales summary, shown once there are enough sales. One migration.

## Owner decisions

1. Address: `/[game]` (recommended) or `/[game]/blog`?
2. Section names: owner copy.
3. Feature Below Market Deals on the home page?
