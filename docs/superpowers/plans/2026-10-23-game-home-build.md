# Game Home Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every game's `/[gameSlug]` landing with one registry-driven section system. Adding values data, a
tool page or guides shows the matching section with no page code.

**Architecture:**
- `src/features/game-home/` holds four layers:
  - pure `model/` (unit-tested);
  - a server `load/` fan-out (cookie-free, tagged reads that throw on DB errors);
  - `sections/` (server components; client only for the Embla rails);
  - one `GameHome.tsx` composer.
- `page.tsx` keeps metadata and becomes load → build → render.
- The Steal a Brainrot branch and `SabLanding` retire.

**Tech Stack:**
- Next.js 14 App Router (ISR), Supabase anon/tagged read clients;
- Tailwind, framer-motion 11 (only if CSS can't do it), embla-carousel-react 8;
- vitest; pnpm.

**Spec:** `docs/superpowers/specs/2026-10-23-game-home-design.md`

## Global Constraints

**Process**
- pnpm only; work in `.claude/worktrees/game-home` (branch `feat/game-home`).
- One dev server at a time (`lsof -iTCP -sTCP:LISTEN -P | grep node` first). It runs against the worktree's local
  stack, never the prod `.env.local`.

**Caching and data**
- No cookie client in the page's import graph: use `@/lib/supabase/anon` or the tagged read clients. No
  `searchParams`.
- Loaders throw on DB errors. Only a missing game → `notFound()`.

**Layout**
- Page container: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`.
- Surfaces: ground `#16171B`, raised `#1D1E23`, card gradient `#212228 → #1A1B1F`. No card-in-card.
- Files stay around 400 lines; split past ~500.

**Copy**
- Title Case UI labels; Inter only.
- No "verify"/KYC wording in seller copy. "SafeDrop Protection"; no escrow language.

**Icons and motion**
- Decorative 3D icons go through `SilverIcon` (`src/components/ui/silver-icon.tsx`). The SafeDrop emblem keeps its
  colour.
- Motion is CSS-first with `@supports (animation-timeline: view())`. It is off under `prefers-reduced-motion`, and
  content stays visible without JS.

**Verification**
- Per task: `pnpm vitest run src/features/game-home`, `pnpm exec tsc --noEmit`, eslint on the changed files.
- Each task ends with a localhost check (owner).

---

## File Map

| File | Responsibility |
|---|---|
| `src/features/game-home/types.ts` | All section models + `GameHomeData` (loader output) |
| `src/features/game-home/model/item-noun.ts` | `{Items}` word per game |
| `src/features/game-home/model/hero.ts` | Facts line |
| `src/features/game-home/model/hot-new.ts` | Day-seeded Hot New ranking |
| `src/features/game-home/model/movers.ts` | Rising/falling pick |
| `src/features/game-home/model/tools.ts` | Tools registry → tiles for a game |
| `src/features/game-home/model/about.ts` | About rows from facts |
| `src/features/game-home/model/build.ts` | `buildGameHome(data, now)` → `GameHomeModel` |
| `src/features/game-home/load/game.ts` | `getGameData` (moved from page.tsx, `cache()`d) |
| `src/features/game-home/load/values-feed/{index,adopt-me,sab,generic}.ts` | Values feed adapters |
| `src/features/game-home/load/load-game-home.ts` | One parallel fan-out |
| `src/features/game-home/sections/*.tsx` | One section per file |
| `src/features/game-home/GameHome.tsx` | Composer |
| `src/features/game-home/game-home.css` | Scroll-driven motion keyframes (global, imported once) |
| `src/app/(marketplace)/[gameSlug]/page.tsx` | Metadata + load/build/render |
| `src/app/(marketplace)/[gameSlug]/values/_HubNavExtras.tsx` | Single Values & Guides tab |
| `scripts/dev/seed-game-home-demo.mjs` | Local-only demo data for the localhost review |

---

### Task 1: Foundation — types, hero, data load, page switch, local demo data

**Files:**
- Create:
  - `src/features/game-home/{types.ts,model/item-noun.ts,model/hero.ts,model/build.ts}`
  - `src/features/game-home/load/{game.ts,load-game-home.ts}`
  - `src/features/game-home/{GameHome.tsx,sections/Hero.tsx,sections/SectionHeading.tsx}`
  - `scripts/dev/seed-game-home-demo.mjs`
- Modify: `src/app/(marketplace)/[gameSlug]/page.tsx`
- Delete: `src/app/(marketplace)/[gameSlug]/values/_SabLanding.tsx`, after checking that nothing else imports it.
- Test: `src/features/game-home/model/hero.test.ts`, `src/features/game-home/model/item-noun.test.ts`

**Interfaces:**
- Produces:
  - `itemNoun(gameSlug: string): string`
  - `heroFacts(i: { gameName: string; offerCount: number; lowPrice: number | null; avgDelivery: string | null }): string | null`
  - `loadGameHome(gameSlug: string): Promise<GameHomeData | null>`
  - `buildGameHome(data: GameHomeData, now: number): GameHomeModel`
  - `<GameHome model={GameHomeModel} />`

- [ ] **Step 1: Write failing tests**

```ts
// src/features/game-home/model/hero.test.ts
import { describe, it, expect } from 'vitest'
import { heroFacts } from './hero'

describe('heroFacts', () => {
  it('states offers, price and delivery when all are known', () => {
    expect(heroFacts({ gameName: 'Adopt Me', offerCount: 83, lowPrice: 4.99, avgDelivery: '1 hour' }))
      .toBe('83 Adopt Me offers from $4.99, delivered in about 1 hour.')
  })
  it('drops unknown parts instead of inventing them', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 2, lowPrice: null, avgDelivery: null })).toBe('2 Rust offers live now.')
  })
  it('uses the singular for one offer', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 1, lowPrice: 3, avgDelivery: null })).toBe('1 Rust offer from $3.00.')
  })
  it('returns null with no offers', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 0, lowPrice: null, avgDelivery: null })).toBeNull()
  })
})
```

```ts
// src/features/game-home/model/item-noun.test.ts
import { describe, it, expect } from 'vitest'
import { itemNoun } from './item-noun'

describe('itemNoun', () => {
  it('names each values game its items', () => {
    expect(itemNoun('adopt-me')).toBe('Pets')
    expect(itemNoun('steal-a-brainrot')).toBe('Brainrots')
  })
  it('defaults to Items', () => expect(itemNoun('fortnite')).toBe('Items'))
})
```

- [ ] **Step 2: Run** `pnpm vitest run src/features/game-home`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/features/game-home/model/item-noun.ts
/** The word a game's items go by in section titles ("Top Selling Adopt Me Pets"). Default "Items". */
const ITEM_NOUNS: Readonly<Record<string, string>> = {
  'adopt-me': 'Pets',
  'steal-a-brainrot': 'Brainrots',
  'steal-an-egg': 'Pets',
}
export function itemNoun(gameSlug: string): string {
  return ITEM_NOUNS[gameSlug] ?? 'Items'
}
```

```ts
// src/features/game-home/model/hero.ts
import { formatStatPrice } from '@/lib/seo/page-stats'

/** The hero's one line of plain facts (owner, 2026-10-23): visible text, unknown parts dropped. */
export function heroFacts(i: { gameName: string; offerCount: number; lowPrice: number | null; avgDelivery: string | null }): string | null {
  if (i.offerCount <= 0) return null
  const offers = `${i.offerCount.toLocaleString('en-US')} ${i.gameName} ${i.offerCount === 1 ? 'offer' : 'offers'}`
  const price = i.lowPrice != null && i.lowPrice > 0 ? ` from $${formatStatPrice(i.lowPrice)}` : ''
  const delivery = i.avgDelivery ? `, delivered in about ${i.avgDelivery}` : ''
  return price || delivery ? `${offers}${price}${delivery}.` : `${offers} live now.`
}
```

Check `formatStatPrice(3)` returns `"3.00"`. If it returns `"3"`, change the singular test to the real format: the test asserts the shared formatter, not a new one.

- **`load/game.ts`:** move `getGameData` (the `cache()`d read) from `page.tsx` unchanged. `generateMetadataRaw` imports it from here.
- **`load/load-game-home.ts`:** move the hub fan-out from page.tsx lines 364–407:
  - `getHubCategoryStats`, `getHubCurrency`, `getHubOffers`, `bindCategoryListingsTag`;
  - `buildHubCards` / `splitCards`, `getImageAccent`, `buildHubFaq`.
  - Return `GameHomeData` = `{ game, categories, cards, spotlight, grid, currency, currencyAccent, offers: { items, accounts }, faq, trademark, fromPrice }`.
  - Values feed, tools and guides join in later tasks as optional fields that default to `null` / `[]`.
- **`model/build.ts`:**
  - `buildGameHome` returns `GameHomeModel` with `hero`, `currency | null`, `topSelling: { items, accounts }`, `faq`, `payments`;
  - later tasks add fields.
- **`sections/Hero.tsx`** (server):
  - centred inside `GameHeroBackdrop` (`size="market"`);
  - logo 84px (radius 18px, deep shadow);
  - H1 `{Game} Marketplace` at `--fs-page-title`;
  - one line from `game.description` / `hubPitch` in `text-text-secondary`;
  - the facts line as plain text below it;
  - no buttons, no stat boxes.
- **`sections/SectionHeading.tsx`:** `{ title, sub?, action?: { href, label }, align?: 'left' | 'center' }`, one heading recipe for every section (24px→30px, weight 800, `-0.025em`).
- **`GameHome.tsx`**, in order:
  1. Hero;
  2. `CurrencyBuyCard`, if spotlight;
  3. `OfferRail` "Top Selling {Game} {Items}" for items, then "Top Selling {Game} Accounts" for accounts;
  4. "Opening Soon" when there are no categories;
  5. `FaqSection`;
  6. `PaymentsMarquee`.
- **`page.tsx`:**
  - the body becomes `const data = await loadGameHome(gameSlug); if (!data) notFound(); const model = buildGameHome(data, Date.now())`;
  - render JSON-LD (breadcrumb, faq), `GameSubNav`, `<GameHome model={model} />` inside `GameHeroBackdrop`;
  - delete the SAB branch, `getSabTopValues`, `getSabLandingOffers` and the `SabTopValue` type.
  - grep `SabTopValue|SabLanding|_SabSellerCta` across `src`; delete the files once nothing imports them.
- **`scripts/dev/seed-game-home-demo.mjs`:**
  - Refuse unless `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` host is `127.0.0.1` or `localhost`.
  - Insert one demo seller profile (`is_test=false`, verified) and ~16 active Adopt Me listings (`value_item_slug` set,
    prices $4.99–$649.99).
  - Insert a few SAB and MM2 listings, one blog post per values game, and two days of price history for ~12 items, so
    trends exist.
  - Mark 4 Adopt Me pets released in the last 14 days.
  - Idempotent (`on conflict do nothing`); deletes its own rows with `--purge`.
  - Before writing it, read what `pnpm test:reset` already seeds (`scripts/local-stack.mjs`,
    `supabase/seeds/*.local.sql`, `scripts/values-seeds/`) and only add what's missing.

- [ ] **Step 4: Run** `pnpm vitest run src/features/game-home`. Expected: PASS. Then run `pnpm exec tsc --noEmit`.
- [ ] **Step 5: Guards**

  Run `pnpm vitest run src/test/guards/public-route-caching.guard.test.ts src/test/guards/listing-mutations-revalidate.guard.test.ts`.
  Expected: PASS.
- [ ] **Step 6: Localhost**

  `pnpm db:up && pnpm test:reset && node scripts/dev/seed-game-home-demo.mjs`, then start the dev server on the
  worktree stack. The owner checks `/adopt-me`, `/steal-a-brainrot` and `/fortnite`.
- [ ] **Step 7: Commit** `feat(game-home): section system foundation, hero, SAB joins the template`

---

### Task 2: Sub-nav — one Values & Guides tab

**Files:**
- Modify: `src/app/(marketplace)/[gameSlug]/values/_HubNavExtras.tsx`, `src/lib/content/hub-links.ts`
- Test: `src/lib/content/hub-links.test.ts`, `src/components/marketplace/GameSubNav.links.test.ts`

**Interfaces:**
- Produces: `hubNavTab(gameSlug: string): { href: string; label: 'Values & Guides' | 'Guides' } | null`, exported
  from `hub-links.ts`.

- [ ] **Step 1: Failing test** in `hub-links.test.ts`

```ts
import { hubNavTab } from './hub-links'
it('one Values & Guides tab to the blog hub for a values game', () => {
  expect(hubNavTab('adopt-me')).toEqual({ href: '/adopt-me/blog', label: 'Values & Guides' })
})
it('no tab for a game with no hub pages', () => expect(hubNavTab('fortnite')).toBeNull())
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
export function hubNavTab(gameSlug: string): { href: string; label: 'Values & Guides' | 'Guides' } | null {
  if (!hasGameContentTheme(gameSlug)) return null
  const { pages } = getGameContentTheme(gameSlug)
  if (pages.values) return { href: `/${gameSlug}/${pages.blog ? 'blog' : 'values'}`, label: 'Values & Guides' }
  if (pages.blog) return { href: `/${gameSlug}/blog`, label: 'Guides' }
  return null
}
```

- `hubNavExtras` renders that one tab (SAB through `SwooshLink`, others through `Link`), with the same `TAB` classes.
- `hubToolLinks` stays for the footer.
- Update `GameSubNav.links.test.ts` and `content-hub-config.guard.test.ts` expectations where they assert the old two
  tabs.

- [ ] **Step 4: Run** the three tests and tsc. Expected: PASS.
- [ ] **Step 5: Commit** `feat(game-home): one Values & Guides tab after the categories`

---

### Task 3: How Buying Works — big silver 3D icons, connector line, scroll reveal

**Files:**
- Create: `src/features/game-home/sections/HowBuying.tsx`, `src/features/game-home/game-home.css`
- Modify: `GameHome.tsx`

**Interfaces:**
- Consumes: `itemNoun`, `SilverIcon`.
- Produces: `<HowBuying gameName itemNoun />`, a server component with no props from data.

- [ ] **Step 1: Steps copy**

  | Step | Title | Line | Icon |
  |---|---|---|---|
  | 1 | Pick Your {Item} | Compare offers by price, delivery time and seller rating. | `/icons/set/search.svg` |
  | 2 | Pay Securely | Card, crypto or local methods. SafeDrop Protection starts at checkout. | `/icons/set/card.svg` |
  | 3 | Get It In-Game | Your seller trades it to you in {Game}, usually within an hour. | `/icons/set/gift.svg` |
  | 4 | Confirm And Done | Got it? Confirm. Never arrived? You get a full refund. | `/icons/set/shield-check.svg` |

  `{Item}` is the singular of `itemNoun`; add `itemNounSingular()` beside it with a test.

- [ ] **Step 2: Markup**
  - 4 columns `lg`, 2 `sm`, 1 on phones; each column centred.
  - Icon: `SilverIcon` 104px over a soft radial glow (`radial-gradient(circle, rgba(255,255,255,0.10), transparent 65%)`, 160px).
  - Step number: small mono numeral `01`–`04` in `text-white/35` above the title.
  - Title 18px/700; line 14.5px in `text-text-secondary`, max 26ch, centred.
  - Connector: one absolutely-positioned inline SVG path across the icon row (`lg` only), drawn as a dashed base line
    (`stroke-white/10`) plus a solid highlight path animated on view.
- [ ] **Step 3: Motion** in `game-home.css`

```css
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .gh-reveal { animation: gh-rise linear both; animation-timeline: view(); animation-range: entry 10% cover 30%; }
    .gh-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: gh-draw linear both; animation-timeline: view(); animation-range: entry 20% cover 45%; }
  }
}
@keyframes gh-rise { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes gh-draw { to { stroke-dashoffset: 0; } }
```

  The path uses `pathLength="1"`. The stagger comes from per-step `animation-range` offsets (`entry 10%`, `14%`,
  `18%`, `22%`) set inline. Import the CSS once in `GameHome.tsx`.

- [ ] **Step 4: Verify** tsc and eslint; owner checks motion on localhost (scroll down `/adopt-me`; reduced motion
  shows everything static).
- [ ] **Step 5: Commit** `feat(game-home): How Buying Works with silver 3D steps and scroll motion`

---

### Task 4: Values feed + Hot New {Game} {Items}

**Files:**
- Create:
  - `src/features/game-home/load/values-feed/{index.ts,adopt-me.ts,sab.ts,generic.ts}`
  - `src/features/game-home/model/hot-new.ts`, `src/features/game-home/sections/HotNew.tsx`
- Modify: `types.ts`, `load-game-home.ts`, `build.ts`, `GameHome.tsx`
- Test: `src/features/game-home/model/hot-new.test.ts`, `src/features/game-home/load/values-feed/adapters.test.ts`

**Interfaces:**
- Produces:
  - `FeedItem = { slug: string; name: string; imageUrl: string | null; href: string | null; isNew: boolean; trendPct: number | null; trendLabel: string | null; valueUsd: number | null }`
  - `ValuesFeed = { items: FeedItem[]; stock: Record<string, number>; buyHref: (slug: string) => string | null; updatedAt: string | null }`
  - `getValuesFeed(gameSlug: string): Promise<ValuesFeed | null>`
  - the pure mappers `fromAdoptMe(rows)`, `fromSab(rows)`, `fromGeneric(rows)`
  - `pickHotNew(items: FeedItem[], stock: Record<string, number>, now: number, limit = 8): HotNewCard[]`
  - `HotNewCard = { slug; name; imageUrl; valueHref: string | null; offers: number }`

- [ ] **Step 1: Failing tests**

```ts
// hot-new.test.ts
import { describe, it, expect } from 'vitest'
import { pickHotNew } from './hot-new'
const item = (slug: string, isNew = true) => ({ slug, name: slug, imageUrl: null, href: `/x/${slug}`, isNew, trendPct: null, trendLabel: null, valueUsd: 10 })
const DAY = 86_400_000
const now = Date.UTC(2026, 9, 23, 12)

describe('pickHotNew', () => {
  it('keeps only new items, ranked by our offers', () => {
    const r = pickHotNew([item('a'), item('b'), item('old', false)], { a: 1, b: 5, old: 9 }, now)
    expect(r.map((c) => c.slug)).toEqual(['b', 'a'])
  })
  it('breaks ties in the same order all day', () => {
    const items = ['p', 'q', 'r', 's', 't'].map((s) => item(s))
    expect(pickHotNew(items, {}, now).map((c) => c.slug)).toEqual(pickHotNew(items, {}, now + 6 * 3_600_000).map((c) => c.slug))
  })
  it('reshuffles ties on another day', () => {
    const items = 'abcdefghij'.split('').map((s) => item(s))
    const days = [0, 1, 2, 3].map((d) => pickHotNew(items, {}, now + d * DAY).map((c) => c.slug).join(''))
    expect(new Set(days).size).toBeGreaterThan(1)
  })
  it('caps at the limit', () => expect(pickHotNew('abcdefghij'.split('').map((s) => item(s)), {}, now, 8)).toHaveLength(8))
})
```

  `adapters.test.ts` maps one fixture row per kind:
  - an AM pet with `values.FR.trendPct = 6.8` → `trendPct: 6.8`, `trendLabel: 'FR'`, `href: '/adopt-me/values/<slug>'` only when `hasPage`;
  - a SAB brainrot → `href` `/steal-a-brainrot/values/<slug>`;
  - a generic row → passes `href` and `trendPct` through.

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// hot-new.ts
import type { FeedItem, HotNewCard } from '../types'
const DAY = 86_400_000
/** FNV-1a over the slug, seeded by the UTC day: a stable tiebreak all day that changes daily. */
function dayKey(slug: string, day: number): number {
  let h = (0x811c9dc5 ^ day) >>> 0
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 0x01000193) >>> 0
  return h
}
export function pickHotNew(items: readonly FeedItem[], stock: Readonly<Record<string, number>>, now: number, limit = 8): HotNewCard[] {
  const day = Math.floor(now / DAY)
  return items
    .filter((i) => i.isNew)
    .map((i) => ({ i, offers: stock[i.slug] ?? 0, k: dayKey(i.slug, day) }))
    .sort((a, b) => b.offers - a.offers || a.k - b.k)
    .slice(0, limit)
    .map(({ i, offers }) => ({ slug: i.slug, name: i.name, imageUrl: i.imageUrl, valueHref: i.href, offers }))
}
```

- **Adapters** read `loadValueListRows(gameSlug)` (`values/_listRows.ts`, cached under the list tags, the same rows as
  `/values`) and `getValueStock(gameSlug)` (`lib/value-listings/stock-server.ts`, our own stock, listing-tagged).
  - `stock[slug] = byItem[slug].total`.
  - `buyHref(slug)` = `/${gameSlug}/${pair.categorySlug}/item/${slug}` when `stock[slug] > 0`, else `null`. Confirm
    the `ItemsPair` field name in `stock-server.ts`.
  - The AM trend uses `cardVariant(values, 'FR')` from `_adoptMeListModel.ts`, and `trendLabel` is that variant.
  - `valueUsd` per kind: AM `values[v].cashUsd`; SAB `average_usd ?? display_price_usd`; generic `marketUsd ?? cheapestUsd`.
  - `updatedAt`: generic → `getValuesFreshness(gameSlug).lastChangedAt`; AM and SAB → `null`. Section copy then says
    "Updated daily" without a date.
  - `getValuesFeed` catches and logs per game and returns `null`, so the values sections hide and the page still
    renders.
- **`HotNew.tsx`:**
  - grid of ≤8 (4 per row `lg`, 2 on phones, 4-wide Embla on phones if > 4).
  - Card: item art 112px on a lime-tinted radial glow, a `New` tag (lime `#B6E36A` on 16% tint, 11px/800), the name
    (17px/700) and an offers line ("3 offers on DropMarket" or "No offers yet").
  - Primary button: **Buy From $X** when in stock, else **Sell Yours First** (amber tint → `/[game]/sell`).
  - Secondary: **How To Get** → `valueHref` (hidden when null).
  - Heading: `Hot New {Game} {Items}`, sub "Just added to {Game}. Updated daily.", action `All New {Items}` →
    `/[game]/values` (the New tab's own URL state is client-side, so link the list).

- [ ] **Step 4: Run** tests + tsc. Expected: PASS. Owner checks localhost.
- [ ] **Step 5: Commit** `feat(game-home): values feed adapters and Hot New items (day-seeded order)`

---

### Task 5: Start Selling band

**Files:**
- Create: `src/features/game-home/sections/StartSelling.tsx`
- Modify: `build.ts`, `types.ts`, `GameHome.tsx`

**Interfaces:**
- Produces: `StartSellingModel = { gameSlug; gameName; itemNoun; examples: { name; imageUrl; priceUsd }[] }`. The
  examples are our 3 highest-priced live item offers (own data only). The section renders without them.

- [ ] **Step 1: Failing test** in `build.test.ts`: examples come from `offers.items` sorted by `pricePerUnit` desc,
  max 3, and skip offers without an image.
- [ ] **Step 2: Implement**
  - Split band (`lg`: 1.1fr / 1fr) on a deep amber-tinted ground with a soft radial glow; no inner cards.
  - Left: eyebrow "Sell On DropMarket", H2 `Sell Your {Game} {Items} For Real Money`, and three proof lines with
    silver icons (`store.svg` "Listing is free", `wallet.svg` "Get paid when it sells", `bolt.svg` "Buyers already
    shop {Game} here").
  - Buttons: **Start Selling** (amber, 52px) and **How Selling Works** (text link to `/sell/fees`).
  - Right: the example items floating (CSS `gh-float` keyframes, 6s, staggered −1.5s), each showing its art and
    "Listed At $X". With no examples, the `/icons/set/coins.svg` silver icon is shown large instead.
  - With no offers at all, the band reads `Be The First To Sell {Game} {Items}` and the H2 sub changes; "Opening
    Soon" is merged into this band and the old component deleted.
- [ ] **Step 3: Verify** tests, tsc, localhost.
- [ ] **Step 4: Commit** `feat(game-home): Start Selling band`

---

### Task 6: Biggest {Game} Price Moves This Week

**Files:**
- Create: `src/features/game-home/model/movers.ts`, `src/features/game-home/sections/PriceMoves.tsx`
- Test: `src/features/game-home/model/movers.test.ts`

**Interfaces:**
- Produces:
  - `pickMovers(items: FeedItem[], n = 3, minUsd = 1): { rising: MoverRow[]; falling: MoverRow[] } | null`
  - `MoverRow = { slug; name; imageUrl; href: string | null; pct: number; label: string | null }`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { pickMovers } from './movers'
const m = (slug: string, pct: number | null, valueUsd = 10) => ({ slug, name: slug, imageUrl: null, href: null, isNew: false, trendPct: pct, trendLabel: null, valueUsd })
describe('pickMovers', () => {
  it('splits rising and falling, biggest first', () => {
    const r = pickMovers([m('a', 2), m('b', 9), m('c', -4), m('d', -1)])!
    expect(r.rising.map((x) => x.slug)).toEqual(['b', 'a'])
    expect(r.falling.map((x) => x.slug)).toEqual(['c', 'd'])
  })
  it('ignores penny items so a $0.01 → $0.03 jump does not lead', () => {
    expect(pickMovers([m('penny', 200, 0.03), m('a', 2), m('b', -3)])!.rising.map((x) => x.slug)).toEqual(['a'])
  })
  it('null when fewer than two items moved', () => expect(pickMovers([m('a', 3), m('b', null)])).toBeNull())
})
```

- [ ] **Step 2: Implement** with `TREND_MIN_PCT` from `lib/values/trends.ts` as the floor.
  - Section: two side-by-side lists (one surface each, hairline rows; no nested cards).
  - Row: art 40px, name, variant label chip-less (e.g. "FR" in muted text), and the % in success/error colour with
    ▲/▼.
  - Header action: **See Full Value List** → `/[game]/values`.
  - Freshness line: `Prices updated {Mon D}` when `updatedAt`, else "Updated daily".
- [ ] **Step 3: Verify** tests, tsc, localhost.
- [ ] **Step 4: Commit** `feat(game-home): Biggest Price Moves`

---

### Task 7: Free {Game} Trading Tools — registry + one-row Embla rail

**Files:**
- Create:
  - `src/features/game-home/model/tools.ts`, `src/features/game-home/sections/Tools.tsx`
  - `src/features/game-home/sections/ToolsRail.client.tsx`
- Modify: `src/lib/content/hub-tools.ts` (add `export const NEON_CALCULATOR_GAMES = ['adopt-me'] as const`) and
  `src/app/(marketplace)/[gameSlug]/neon-calculator/page.tsx` (its `generateStaticParams` uses that constant).
- Test: `src/features/game-home/model/tools.test.ts`

**Interfaces:**
- Produces:
  - `gameTools(gameSlug: string, gameName: string, itemNoun: string): ToolTile[]`
  - `ToolTile = { key: string; href: string; tag: string; question: string; cta: string; icon: string; featured: boolean }`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { gameTools } from './tools'
describe('gameTools', () => {
  it('lists every tool page the game publishes, the trade calculator first', () => {
    const t = gameTools('adopt-me', 'Adopt Me', 'Pets')
    expect(t[0]).toMatchObject({ key: 'calculator', featured: true, href: '/adopt-me/calculator' })
    expect(t.map((x) => x.key)).toContain('values')
    expect(t.map((x) => x.key)).toContain('neon')
  })
  it('no tools for a game without hub pages', () => expect(gameTools('fortnite', 'Fortnite', 'Items')).toEqual([]))
})
```

- [ ] **Step 2: Implement** one `TOOL_DEFS` array in the display order. Each def has a page flag key of
  `HubPageSet`, or a `games` list for routes outside it. The entries:

  | Key | Page / games | Path | Tag | Question | CTA | Icon |
  |---|---|---|---|---|---|---|
  | `calculator` | `calculator` | `calculator` | Trade Calculator | Is Your Trade Fair? | Check A Trade | `analytics.svg` (featured) |
  | `values` | `values` | `values` | Value List | What Are My {Items} Worth? | Check Values | `tag.svg` |
  | `neon` | `NEON_CALCULATOR_GAMES` | `neon-calculator` | Neon Calculator | Build A Neon Or Buy It? | Work It Out | `crown.svg` |
  | `inventory` | `inventory` | `inventory` | Inventory Calculator | What Is My Inventory Worth? | Add Your Items | `package.svg` |
  | `chromas` | `chromas` | `chromas` | Chromas | Is A Chroma Worth It? | See Chromas | `star.svg` |
  | `boxes` | `boxes` | `boxes` | Box Odds | Which Box Pays Off? | See The Odds | `gift.svg` |
  | `events` | `events` | `events` | Events | What Did Each Event Add? | See Events | `clock.svg` |
  | `freeItems` | `freeItems` | `free-items` | Free {Items} | Can You Get It Free? | See How | `discount.svg` |
  | `codes` | `codes` | `codes` | {Game} Codes | Any Working Codes Today? | See Codes | `key.svg` |
  | `priceIndex` | `priceIndex` | `price-index` | Price Index | Is The Market Up Or Down? | See The Index | `stock.svg` |

  Adding a page flag to a game's theme makes its tile appear.
- [ ] **Step 3: Rail**
  - `Tools.tsx` (server) renders `SectionHeading` "Free {Game} Trading Tools", sub "No sign-up.", and passes the
    tiles to `ToolsRail.client.tsx`.
  - The rail: Embla with `align: 'start'`, `dragFree: true`, `containScroll: 'trimSnaps'` and wheel gestures (already
    installed), plus prev/next buttons like `OfferRail`.
  - The featured tile is 2× width with a blue radial glow and two item images. The other tiles are ~260px wide, all
    one height, one row.
  - Slides are rendered in the server HTML (Embla only enhances).
- [ ] **Step 4: Verify** tests, tsc, localhost (drag, wheel, arrows, phone swipe).
- [ ] **Step 5: Commit** `feat(game-home): tools registry and one-row tools rail`

---

### Task 8: {Game} Guides carousel

**Files:**
- Create: `src/features/game-home/sections/Guides.tsx`, `src/features/game-home/sections/GuidesCarousel.client.tsx`
- Modify: `load-game-home.ts` (adds `getBlogRail(gameSlug, 8)` to the fan-out), `types.ts`, `build.ts`

**Interfaces:**
- Consumes: `BlogRailPost[]` from `@/lib/blog/rail`.
- Produces: `GuidesModel = { gameName; moreHref: string; posts: BlogRailPost[] } | null` (null when 0 posts).

- [ ] **Step 1: Failing test** in `build.test.ts`: guides are null with 0 posts, else `moreHref` = `/[game]/blog`.
- [ ] **Step 2: Implement** the Embla carousel: one guide per swipe on phones and 1.6 slides visible on desktop
  (the active slide large, the next peeking).
  - Motion: scale/opacity tween on scroll from the official Embla "tween" example (active 1, neighbours 0.92 and 0.6
    opacity), updated in `requestAnimationFrame`.
  - Dots + prev/next; autoplay off; loop on.
  - Slide: cover 16:9 (`next/image`, `sizes`), category label in its accent colour, title 22px/800, excerpt one line,
    "Read Guide →".
  - Header action **All Guides** → `/[game]/blog`.
- [ ] **Step 3: Verify** tsc and localhost (swipe on phone, keyboard arrows).
- [ ] **Step 4: Commit** `feat(game-home): guides carousel`

---

### Task 9: Why Players Buy — floating icons, no cards

**Files:**
- Create: `src/features/game-home/sections/Trust.tsx`
- Modify: `game-home.css` (`gh-float` keyframes, if not added in Task 5), `GameHome.tsx`

- [ ] **Step 1: Markup**
  - Full-width section on a green-tinted top glow; heading `Why Players Buy {Game} {Items} On DropMarket`.
  - Three columns, no surfaces: icon (120px) floating 6s with staggered delays, a soft coloured glow disc behind it
    (blur-2xl), title 20px/800 and a line 15px.
  - The items:

    | Icon | Title | Line |
    |---|---|---|
    | `/icons/safedrop-emblem.png` (brand art, own colour, not silver) | SafeDrop Protection | You get exactly what you ordered, or your money back. |
    | `verified.svg` silver | Verified Sellers | Every seller is ID-checked and rated on real orders. |
    | `bolt.svg` silver | Fast In-Game Delivery | About an hour on average, tracked in your order chat. |

  - Each title links to its explainer (`/safedrop`, `/sell/fees` → seller rules, `/how-it-works`, whichever exists;
    grep the routes).
- [ ] **Step 2: Verify** tsc and localhost.
- [ ] **Step 3: Commit** `feat(game-home): trust section with floating icons`

---

### Task 10: Centred FAQ + About {Game}

**Files:**
- Create: `src/features/game-home/model/about.ts`, `src/features/game-home/sections/About.tsx`
- Modify: `src/components/marketplace/FaqCards.tsx` (adds `align?: 'left' | 'center'`; default unchanged)
- Test: `src/features/game-home/model/about.test.ts`

**Interfaces:**
- Produces:
  - `aboutRows(f: AboutFacts): AboutRow[]`
  - `AboutFacts = { gameName; itemNoun; categoryNames: string[]; offerCount: number; lowPrice: number | null; hasValues: boolean; hasCurrency: boolean; currencyName: string | null; avgDelivery: string | null }`
  - `AboutRow = { id: 'buy' | 'what' | 'why'; heading: string; paragraphs: string[]; layout: 'text-left' | 'text-right' | 'centre' }`

- [ ] **Step 1: Failing tests**
  - Three rows in the order `buy` (text-left), `what` (text-right), `why` (centre).
  - Headings: `Buy {Game} {Items} From Verified Sellers`, `What You Can Buy In {Game}`,
    `Why Buy {Game} {Items} On DropMarket?`.
  - The `buy` paragraph includes the real offer count and price only when known.
  - The `what` row lists the real category names and mentions the value list only when `hasValues`.
  - No paragraph contains `[` or `]` (no placeholders).
- [ ] **Step 2: Implement** short, plain, buyer-first paragraphs (2–3 sentences each) from the facts.
  - No keyword stuffing; the game name once per paragraph at most.
  - Inline links where useful: the value list, the sell page, `/safedrop`.
- [ ] **Step 3: About.tsx**
  - Row 1: text left, collage right (up to 5 item images from the feed or offers, floating on a radial glow).
  - Row 2: art left (the game art, rounded 24px, scrim), text right.
  - Row 3: centred block on an amber top glow.
  - Phones: stacked, art first.
- [ ] **Step 4: FAQ**
  - `FaqSection` gets `align="center"`: centred heading, accordion max-w-3xl, centred in the page.
  - The game home passes `align="center"`.
- [ ] **Step 5: Verify** tests, tsc, localhost.
- [ ] **Step 6: Commit** `feat(game-home): centred FAQ and About section from real facts`

---

### Task 11: JSON-LD, IndexNow, skeleton, cleanup, review

**Files:**
- Modify: `page.tsx` (adds `productAggregate` JSON-LD), `src/app/(marketplace)/[gameSlug]/loading.tsx` (create or
  update so it mirrors the new section order)
- Delete:
  - `_GameHub.tsx` and the `HubFacts`/`SellCta`/`OpeningSoon` code with it;
  - `HowItWorksBand` / `WhyBuyCard` only if no other importer remains (grep first).

- [ ] **Step 1:** `productAggregate`
  - `name` `{Game} {Items}`; `description` = the meta description;
  - `brand` = game name;
  - `lowPrice` / `highPrice` / `offerCount` from the item offers shown;
  - `url` `/[game]`;
  - only when `offerCount > 0`.
- [ ] **Step 2: IndexNow.** Check `src/lib/seo/indexnow/listing-events.ts` includes `/${gameSlug}` in the URLs it
  pings for a listing change. If not, add it with a test in `listing-events.test.ts`.
- [ ] **Step 3: `loading.tsx`.** A centred hero block, a 4-card rail and a 4-step row, using the same containers.
- [ ] **Step 4: Full checks**
  - `pnpm vitest run src/features/game-home src/lib/content src/components/marketplace src/test/guards/public-route-caching.guard.test.ts src/test/guards/listing-mutations-revalidate.guard.test.ts`;
  - tsc;
  - eslint;
  - `node scripts/check-public-route-caching.mjs`.
- [ ] **Step 5: Review.** Run the web-design-guidelines review on `src/features/game-home/**` and fix findings.
  Check desktop 1280 + phone 375 on localhost.
- [ ] **Step 6: Commit** `feat(game-home): product JSON-LD, skeleton, remove the old hub`, then open the PR (merge only on
  the owner's word).
