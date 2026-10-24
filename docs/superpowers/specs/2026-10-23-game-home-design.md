# Game Home (`/[gameSlug]`) — Design

Status: approved in chat by the owner, 2026-10-23 (mockup v2 at
https://claude.ai/artifact/DPADxn6y8P7VBEGPggib8R plus the v2 feedback below).

## Goal

Make every game's marketplace landing (`/adopt-me`, `/steal-a-brainrot`, `/fortnite`, …) one premium,
commercial-first page:
- built from **one section system**;
- adding a game's values data, a new calculator, or guides makes the matching section appear with **no page code
  change**;
- fast (static, small client JS);
- written for buyers first and search engines second.

SEO and AEO use the same rules: Google treats AEO as SEO, and ChatGPT and Copilot search sit on Bing's index,
which is our main search source.

## Scope

- **Every game, Steal a Brainrot included.**
  - `SabLanding` and its loaders retire; SAB's value content stays on `/steal-a-brainrot/values`.
  - Category pages and listing pages are unchanged, except for the sub-nav tab below.
- **Out of scope** (later PRs):
  - the Eldorado popularity feed;
  - the "Sold On DropMarket" summary;
  - turning `/[game]/blog` into the values + guides home.

## Owner decisions (2026-10-23)

| Topic | Decision |
|---|---|
| Navbar | Marketplace chrome: global navbar plus `GameSubNav` |
| Values & Guides tab | One tab after the category tabs, behind a grey divider, labelled **Values & Guides**. It links to `/[game]/blog`, or to `/[game]/values` when the game has no blog hub. It replaces today's Values + Calculator tabs. Guides-only games get **Guides**; games with neither get no tab. The footer directory keeps linking the value list. |
| Hero | Logo, H1, and one line of plain facts as visible text. No stat boxes, no buttons, no hidden text. |
| Row names | **Top Selling {Game} {Items}** (our offers) and **Hot New {Game} {Items}** (new items). |
| Steps | 4 big silver-glass 3D icons, centred text below, a connector line that draws on scroll, staggered reveal. No cards. |
| Start Selling | Redesigned band, premium rather than a flat banner. |
| Guides | Embla carousel, one guide per swipe. |
| Tools | 1 row; drag, scroll or arrows for more (Embla). |
| Trust | 3 floating icons with glow. No cards. The SafeDrop shield keeps its blue (brand art); the others are silver-glass. |
| FAQ | Centred accordion. |
| About | Alternating left / right / centre rows with real per-game facts. No placeholders. |
| 3D icons | Silver-glass (`SilverIcon`) |
| Mockup | Build straight in code. The owner reviews on this worktree's localhost against the local stack. |
| Popularity | Page first; the popularity feed comes in the next PR. |
| Quality bar | Richer and more detailed than the info pages (`/sell/fees`, `/safedrop`), which the owner calls "bland". Use real-site references. |

## Section order and visibility rules

Each section's model returns `null` when its data is missing, and a `null` section renders nothing.

| # | Section | Shows when | Source |
|---|---|---|---|
| 1 | Hero: game art backdrop (`GameHeroBackdrop`), logo, H1 `{Game} Marketplace`, facts line | always | game row + stats |
| 2 | Currency: `CurrencyBuyCard` (reused) | game has a currency category | `getHubCurrency` + stats |
| 3 | Top Selling {Game} {Items}: `OfferRail` (reused), items then accounts | the kind has offers | `getHubOffers` → `pickTopSelling` |
| 4 | How Buying {Game} {Items} Works | always | static copy |
| 5 | Hot New {Game} {Items} | values game with ≥1 new item | values feed |
| 6 | Start Selling | always (the "Opening Soon" variant when there are no offers) | our top offer prices |
| 7 | Biggest {Game} Price Moves This Week (3 rising, 3 falling) | values game with trends | values feed |
| 8 | Free {Game} Trading Tools | game has ≥1 tool page | tools registry over `HubPageSet` |
| 9 | {Game} Guides | game has published posts | `getBlogRail` |
| 10 | Why Players Buy {Game} {Items} On DropMarket | always | static copy |
| 11 | {Game} Marketplace FAQ | always | `buildHubFaq` (existing; searched questions) |
| 12 | About {Game} | always | per-game template over real facts |
| — | Payments strip + trademark line (existing `PaymentsMarquee`) | always | existing |

- **The facts line**, when every part is known: "{N} {Game} offers from {$low}, delivered in about {avg}." Parts we
  don't know are dropped, never invented.
- **Hot New ranking:**
  1. items released in the last 14 days, by the existing new-item rule (`lib/values/new-item.ts`);
  2. ordered by our live offers for the item, then release date (newest first);
  3. ties broken by a day-seeded shuffle, so the order is stable within a UTC day and changes daily;
  4. with fewer than 4 items, fill from the last 60 days;
  5. maximum 8;
  6. an item with no offer gets the CTA **Sell Yours First** (to `/[game]/sell`), and its secondary link goes to the
     item's value page.
- **Price Moves:** 7-day % from the existing trends (`lib/values/trends.ts`, 0.05% floor). Top 3 up and top 3 down,
  plus a real "Prices updated {date}" line from `getValuesFreshness`. Hidden when fewer than 2 items moved.

## Code structure

```
src/features/game-home/
  types.ts                 section models + loader output (one source of truth)
  model/                   pure, unit-tested, no server/client imports
    item-noun.ts           {Items} word per game (value hub config, default "Items")
    hero.ts                facts line
    hot-new.ts             ranking + day-seeded shuffle
    movers.ts              rising / falling pick
    tools.ts               tools registry → visible tools for a game
    about.ts               About rows from facts
    build.ts               buildGameHome(data) → GameHomeModel (each section nullable)
  load/                    server-only, cookie-free (anon / tagged read clients)
    load-game-home.ts      one parallel fan-out; THROWS on a DB error (never notFound on error)
    values-feed/           adapters: index.ts (registry), sab.ts, adopt-me.ts, generic.ts
  sections/                one file per section, server components unless motion needs the client
    Hero.tsx  HowBuying.tsx  HotNew.tsx  StartSelling.tsx  PriceMoves.tsx  Tools.tsx (+ ToolsRail.client.tsx)
    Guides.tsx (+ GuidesCarousel.client.tsx)  Trust.tsx  About.tsx  SectionHeading.tsx
  GameHome.tsx             composes sections in order from GameHomeModel
```

- **Values feed adapter contract:** `getValuesFeed(gameSlug) → { items: FeedItem[], updatedAt } | null`.
  - `FeedItem = { slug, name, imageUrl, href, releaseDate|null, releaseYear|null, addedAt|null, trendPct|null, offers }`.
  - Registry: SAB → `sab.ts`; Adopt Me → `adopt-me.ts`; any other game in `VALUE_LIST_HUB_GAMES` → `generic.ts`.
  - A new values game is picked up automatically through the value hub config.
- **Tools registry:** one entry per tool (key, page flag or route check, href, question title, CTA, accent, icon).
  - Visible tools come from the game's `HubPageSet` (plus routes that exist per game, such as `neon-calculator`).
  - Adding a calculator page to a game's theme makes its tile appear.
- **`page.tsx`:**
  - keeps metadata (titles and H1 from the tuned `resolveGameSeo`, unchanged);
  - its body becomes `loadGameHome` → `buildGameHome` → `<GameHome>`;
  - the SAB branch and its loaders are deleted.
- **Sub-nav:** `hubNavExtras` becomes the single Values & Guides / Guides tab and is used by the landing and the
  category pages. The SAB swoosh stays on the SAB tab.

## Motion and visuals

- **Entrance and scroll motion are CSS-first:**
  - scroll-driven animations (`animation-timeline: view()`) inside `@supports` and
    `prefers-reduced-motion: no-preference`;
  - content is visible without JavaScript, and browsers without support simply show it.
  - The connector line is an SVG stroke-dashoffset tied to the same view timeline.
- **Client JS only where interaction needs it:** the Embla rails (tools, guides). framer-motion only if CSS can't
  express it.
- **Icons:** `SilverIcon` over the house set (`public/icons/set/*.svg`) at large sizes. New semantic icons are
  authored in the same SVG style when the set lacks one.
- **Surfaces and rules:** existing tokens (`#16171B` ground, `#1D1E23` raised, card gradient), `max-w-7xl` gutters,
  Title Case, Inter. No card-in-card, no decorative chips, no filler subtitles.

## SEO / AEO

- **Server HTML:** everything is in the server-rendered HTML, carousel slides included.
- **JSON-LD:**
  - `breadcrumbList` (existing);
  - `faqPage` (existing);
  - `productAggregate` for the game's live offers (lowPrice, highPrice, offerCount), describing content shown on the
    page.
- **Visible facts:** the facts line, real dates ("Prices updated …"), and About copy built from real numbers. FAQ
  answers are 2–3 plain sentences.
- **Unchanged:** canonical, robots (`isGameHubIndexable`) and titles.
- **IndexNow:** listing events already ping game URLs; confirm `/[game]` is included.

## Performance and caching

- **Rendering:** ISR stays (`revalidate = 86400` safety net).
  - The page binds every category's listings tag (existing).
  - The values reads use the value list read clients, so a pricing run's revalidation refreshes the page.
  - No cookie client anywhere in the import graph (the guard enforces this).
- **Bounded reads, all in one parallel fan-out:** 60 offers per kind (as today), ≤12 new items, trends for one game,
  ≤8 guides.
- **Images:** the hero image loads eagerly; images below the fold load lazily with fixed dimensions. Rails reserve
  their height, so there is no layout shift.

## Error handling

- Loaders throw on database errors, so ISR keeps the last good page instead of caching a 404 or an empty page.
- A values-feed failure for one game hides only that game's values sections and is logged. It does not take the
  page down.

## Testing

- **Unit:** every `model/*` function, covering show/hide rules, ranking, the day-seeded shuffle (stable within a
  day, changes across days), the facts line with missing parts, tools visibility, and About rows.
- **Guards that must stay green:**
  - `public-route-caching`;
  - `listing-mutations-revalidate`;
  - `GAME_HUB_SEGMENTS`;
  - the hub-links tests, updated for the single tab.
- **Local check:** on the worktree stack with local demo data, covering Adopt Me, SAB, MM2, a no-values game and an
  empty game, on desktop and phone. The demo data is local only and the seed refuses non-local URLs.
