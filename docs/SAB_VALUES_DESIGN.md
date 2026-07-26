# Steal a Brainrot — Design System & Build Reference

The complete reference for the `/steal-a-brainrot` section: what we built, the design system it
uses, and the hard rules learned along the way. **Reuse these patterns for other game pages — don't
reinvent.** The shared system lives in `src/lib/sab/*` + components under `[gameSlug]/values/`.

---

## 0. The two surfaces (important distinction)

The SAB section is split into two surfaces with **different chrome**:

| Surface | Pages | Navbar |
|---|---|---|
| **Marketplace** | the landing `/steal-a-brainrot` | KEEPS the global DropMarket navbar |
| **DropMarket Values hub** | `/values`, `/values/[slug]`, `/calculator` | slim "DropMarket Values" header (global navbar stripped) |

Both share the **same forest theme, backdrop, and a game sub-nav** (`_SabSubNav`) for internal
linking. The landing is marketplace-first (listings, storefront); Values/Calculator are the nested
tools it links to. Whether the global navbar shows is controlled by `isValuesHub` in
`src/components/layout-wrapper.tsx` (regex matches `/values|value-calculator|trade-calculator|
calculator` — the landing is deliberately NOT matched so it keeps the global navbar).

---

## 1. Identity & palette

**Model: near-black base + forest-green ACCENTS only** (à la gameboost.com), NOT a green wash.
Mutation colors provide the per-item pops. White/near-white text. (An earlier all-green attempt read
muddy — don't go back to it.)

Tokens in **`src/lib/sab/theme.ts`** (import these, don't hardcode):

| Token | Value | Use |
|---|---|---|
| base | `#0C0F0E` | page background |
| card | `#121613` / `#0E1211` | card surface |
| hairline | `#1E2723` | borders (hover `#2A3A31`) |
| forest button | `#1B6B3F` (hover `#1f7a48`) | Buy/primary buttons, active tab/toggle |
| accent-green | `#4FB477` | labels, links, live dot, active icon |
| text | `#F1F3F1` / `#9BA8A0` / `#6D7A72` | primary / secondary / tertiary |
| confidence | high `#4FB477` · medium `#E0B155` · low `#9BA8A0` | color-coded pills |

Exported class strings: `sabCard`, `sabTile`, `sabHero`, `sabInteractive`, `sabPrimaryBtn`,
`sabPill`, `sabText`.

**Geometry:** rectangular `rounded-lg` (8px), restrained shadow (mostly on hover). NOT pill-round,
NOT heavy. Font is **Inter site-wide**; headings `font-semibold` (600) — never bold/extrabold (reads
heavy). Prices/counts use `tabular-nums`.

---

## 2. Hard rules (violating these got flagged during the build)

1. **No box-in-box.** Never nest a bordered card inside a bordered card. Use `sabCard` for a real
   group; inside it, sub-items float (`sabTile` = borderless faint fill) or sit on the page. The
   hero buy box floats (ring-inset, no hard border); mutation chips float on the page.
2. **Fixed-size cards.** A card must NOT resize when its data changes. Reserve space: fixed row
   count ("—" when absent), `min-h` on variable rows. (Verified: item hero stays 697px across all
   mutation switches, priced or not.)
3. **Grey-divider stat rows**, not boxed tiles. `label` left (`text-secondary`) · `value` right
   (`font-medium tabular-nums`), separated by `divide-y divide-white/[0.06-0.07]`. See
   `StatRow`/`BodyRow`/`ConfidenceBadge`.
4. **Icons: MUI** (`@mui/icons-material`), NOT lucide, going forward. Size via `sx={{ fontSize: N }}`.
5. **Motion:** framer-motion (subtle only — flowing Rainbow dot, slow mutation-tinted hero glow) +
   `canvas-confetti` (WIN celebration on the trade calculator). Respect `prefers-reduced-motion`.
6. **Consistency across the hub:** same header, sub-nav, `max-w-7xl` container, left-aligned heros,
   backdrop, breadcrumb style (`Brainrot → …`). Calculator/values must line up.

---

## 3. Shared library (`src/lib/sab/`)

- **`theme.ts`** — the class-string tokens above.
- **`format.ts`** — `formatIncome` (always compact `M/s`/`B/s` — fixed the raw-digits bug),
  `formatCash`, `formatMultiplier`, `formatDate`, `asNumber`. USE THESE EVERYWHERE.
- **`mutations.ts`** — `mutationVisual(slug)` → in-game-accurate color/gradient/order for all 14
  mutations (single source of truth); `mutationOrder(slug)`; `shade(hex, amount)` (for 3D button
  edges); `MUTATIONS` list.
- **`MutationDot.tsx`** — colored dot; Rainbow gets a flowing animated gradient (framer-motion).
- **`FreshnessBadge.tsx`** — pulsing green dot + "Updated <t> UTC" (SEO/trust signal).
- **`faq.ts`** — `buildBrainrotFaq(input)` → 6 curated data-driven Q&As per item, rendered via
  `src/components/marketplace/FaqCards.tsx` + `faqPage()` JSON-LD.

---

## 4. Components (under `[gameSlug]/values/`)

- **`_ValuesHeader.tsx`** — slim fixed header for the hub: logo + "DropMarket | Values" (links home
  for internal linking) + a game-specific "Buy {gameName} Items" CTA. Transparent→fills on scroll.
- **`_SabSubNav.tsx`** — game sub-nav (Overview / Values / Calculator / Buy Items), active-aware via
  `usePathname`, MUI icons, `↗` exit arrow on tabs that leave the hub (Overview, Buy Items).
- **`_SabHeroBackdrop.tsx`** — the shared hero backdrop: a lightly-desaturated image
  (`opacity-0.85`, `grayscale(0.35)`) under a TOP-LIGHT → deepening scrim
  (`from-#0C0F0E/0.45 via-/0.78 to-solid`) + a soft vignette, so the image is CLEARLY VISIBLE as
  atmosphere behind the hero and still fades fully into the page by the content. (Earlier it was too
  dark — 0.5 opacity + full grayscale + 0.88 scrim made it nearly invisible; user flagged it.) Wrap
  page content in it. Asset: `public/assets/heroes/steal-a-brainrot.avif` (~1920px, subject centered).
- **`_SabLanding.tsx`** — the marketplace landing body (game header + stat row, Top Selling Items /
  Accounts carousels with graceful empty states, feature peek cards → Values/Calculator).
- **`_ValuesDirectoryClient.tsx`** — the 498-brainrot directory: search, custom themed `Dropdown`
  (native `<select>` can't be styled — built our own), clean stat-row cards + `ConfidencePill`,
  **pagination** (60/page, numbered pager w/ ellipsis + Prev/Next).
- **`_SabSubNav`/`_SabHeroBackdrop`/`_ValuesHeader`** are reused across item + calculator + landing.

**Item page** (`values/[brainrotSlug]/`):
- `_ItemHero.tsx` — mutation-driven hero (owns selected-mutation state): art, dynamic name
  (`<Mutation> <Brainrot>`), grey-divider stat rows, floating buy box with mutation-colored 3D
  "Buy Now", mutation chips grid, `ConfidenceBadge`, income calc. Mobile: tapping a chip scrolls the
  hero into view. Estimate fallback (`isEstimated` → "est" tag) when a mutation has no listings.
- `_PriceTrendChart.tsx` — Recharts area chart, per selected mutation, "Collecting price history"
  state until ≥2 days of `sab_price_history` exist.
- `_SimilarBrainrots.tsx` — horizontal scroll-snap carousel, MUI arrows.
- The page also renders the market-value section, About, market-activity aside, and the curated FAQ.

**Calculator** (`[gameSlug]/calculator/`):
- `_CalculatorClient.tsx` — tabbed Cash Price / Trade / WFL. Cash: search→mutation grid→price + 3D
  Buy Now. Trade: two 9-slot sides (compact `max-w-[264px]` grid) + circular WFL verdict badge
  (confetti on WIN, thumbs-down on LOSS). Old `/value-calculator` + `/trade-calculator` 301-redirect
  here (`next.config.js`); reads `?tab=trade`.
- `_CalculatorSeo.tsx` — the SEO content package below the tool: top-40 value table (each links to
  its item page — the internal-linking engine), mutation-multiplier grid, ~1000-word guide, FAQ +
  `faqPage` JSON-LD. Keyword-rich dated headings.

---

## 5. SEO (the primary goal of all this)

Beat the competitors (bloxultra, igitems) who rank on long-form content + value tables + internal
links, NOT the tool. We add all that PLUS our edge: **live daily prices + 498 real item pages to
link to**. Every mutation price is crawlable text; FAQs have `faqPage` JSON-LD; breadcrumbs; dated
keyword headings ("… (Month Year)"); interlink landing ↔ values ↔ calculator ↔ item pages ↔
marketplace. "Updated daily" is a real freshness signal (backed by the collector + snapshot cron).

---

## 6. Data (context for the UI)

- Prices come from `sab_public_price_catalog` (display) / `sab_trade_price_catalog` (trade-ready).
  See `memory/sab-pricing-pipeline.md`.
- Coverage is inventory-limited: high-value items (Skibidi, Dragon Cannelloni) have 13-14 mutations;
  the long tail is thin. The Eldorado collector (priority queue + deep pagination) + daily GitHub
  Action widen it; the frontend estimate fallback fills the rest.
- Marketplace listing inventory is near-empty pre-launch (1 item, 0 accounts) — the landing leads
  with value data + graceful empty states; real Items/Accounts carousels fill as inventory grows.
- Price history: `sab_price_history` table + `sab_capture_price_history()` fn + daily cron; trend
  chart needs several days to draw a line (can't backfill).

Related memory: `sab-frontend-overhaul`, `sab-pricing-pipeline`, `sab-data-coverage-priority`,
`sab-landing-revamp`.
