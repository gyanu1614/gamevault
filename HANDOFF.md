# GameVault — Engineering & Design Handoff

> Single source of truth for anyone (human or AI) continuing this codebase.
> Read this **before** writing code. It encodes the conventions, design rules,
> and gotchas learned over the redesign so you don't re-derive or violate them.
>
> Last updated: 2026-06-26 (V22 — account-pages glass pass).

---

## 1. What this is

GameVault is a **gaming marketplace** (buy/sell in-game currency, items, accounts,
top-ups). Three audiences share one app:

- **Buyers** — browse games → categories → listings, checkout via Stripe escrow.
- **Sellers** — list offers, manage orders, get paid out (Wallet).
- **Admins** — manage games/categories, review sellers, resolve disputes.

---

## 2. Stack (don't swap without a reason)

| Concern | Choice |
|---|---|
| Framework | **Next.js 14** App Router (`^14.2`), React 18 |
| Language | TypeScript (strict; `npx tsc --noEmit` must pass before any change is "done") |
| Styling | **Tailwind** + design tokens in CSS vars (`src/styles/tokens.css`) |
| UI primitives | **Radix UI** (dialog, popover, select, tabs, switch, checkbox, radio, tooltip, collapsible) |
| Component layer | **shadcn/ui** pattern in `src/components/ui/*` (built on Radix) |
| Searchable select | **cmdk** (via `Combobox` in `src/components/ui/combobox.tsx`) |
| Animation | **framer-motion** — `motion`, `AnimatePresence`. NEVER hand-roll CSS keyframe tricks. |
| Charts | **recharts** |
| Carousel | **embla-carousel-react** (+ autoplay) |
| Toasts | **sonner** (`toast.success/error`) |
| Icons | **lucide-react** (inline), plus swappable currentColor mask SVGs (§7) |
| Data/backend | **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — Postgres + RLS + Auth + Realtime + Storage |
| Server cache | **@tanstack/react-query** |
| Payments | **Stripe** (escrow model) + Stripe Connect for seller payouts |
| Validation | **zod** |

**Golden rule: a prebuilt library component beats a hand-rolled one, every time.**
If you find yourself writing focus management, popover positioning, height
0↔auto collapse, or fuzzy filtering by hand — stop and use Radix / framer-motion / cmdk.

---

## 3. Repo structure

```
src/
  app/                       # Next App Router. Route groups in (parens) don't affect URL.
    (admin)/admin/...        # Admin panel (lime-accented shell, sidebar)
    (admin-auth)/            # Admin login
    (marketing)/             # Static marketing pages (vaultshield, etc.)
    (marketplace)/           # Buyer browse: /[gameSlug]/[categorySlug]/[listingSlug]
    (sell)/                  # Seller listing wizard (/sell/new, /sell/edit/[id], /sell/bulk)
    (seller)/                # Seller-specific surfaces
    account/                 # Logged-in user hub (dashboard, orders, wallet, listings=Offers, reviews, etc.)
    api/                     # Route handlers (Stripe webhooks, etc.)
    auth/ login/ signup/     # Auth
    globals.css              # @layer base + utilities. Imports tokens.css.
    layout.tsx               # Root layout
  components/
    ui/                      # shadcn-style primitives (Button, Card, Combobox, Tabs, …) — REUSE THESE
    account/                 # AccountSidebar, AccountPageHeader, SellerDashboard, BuyerDashboard
    reviews/ navbar-floating.tsx ...
  features/                  # Larger feature modules
  hooks/                     # use-auth, use-seller-earnings, use-seller-listings, use-buyer-orders, …
  lib/
    actions/                 # 'use server' server actions (the data layer). One file per domain.
    supabase/                # client.ts (browser) + server.ts (RSC/actions) factories
    stripe/ storage/ utils/ templates/ config/ seo/ crypto/ email/
    utils.ts                 # cn() = clsx + tailwind-merge. Use for all conditional classes.
  styles/tokens.css          # THE design tokens (colors, radii). Edit here, not inline hex.
  types/
public/assets/
  heroes/                    # 2880×1600 AVIF page backdrops
  account-icons/  menu-icons/  payment-methods/   # swappable currentColor SVGs
supabase/migrations/         # SQL migrations — USER runs these in Supabase SQL editor (see §9)
```

URL pattern for listings is canonical and SEO-friendly:
`/{gameSlug}/{categorySlug}/{listingSlug}` (no `/marketplace` prefix — that tree was removed + 301'd).

---

## 4. Design tokens (exact values — use the token, not the hex)

Defined in `src/styles/tokens.css`, exposed as Tailwind colors in `tailwind.config.ts`.

**Surfaces (opaque):**
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0A0A0F` | page base |
| `bg-raised` | `#121218` | raised opaque card |
| `bg-raised-hover` | `#17171F` | hover |
| `bg-overlay` | `#1C1C25` | floating menus/popovers (opaque is CORRECT for dropdown panels) |

**Borders (translucent):**
| Token | Value |
|---|---|
| `border-subtle` | `rgba(255,255,255,0.06)` |
| `border-default` | `rgba(255,255,255,0.10)` |
| `border-strong` | `rgba(255,255,255,0.17)` |

**Text** (see also memory `feedback_text_colors`):
| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#F3F3F6` | headings, values |
| `text-secondary` | `#C8CAD2` | **real body copy, helper lines, meta** |
| `text-tertiary` | `#65666F` | ONLY true captions/eyebrows/timestamps |

> Rule: meaningful sub-text → `text-secondary`. Reserve `text-tertiary` for
> small uppercase eyebrow labels / timestamps. Don't let real text be near-invisible.

**Brand & status:**
| Token | Hex |
|---|---|
| `accent-default` / `lime` | `#C6FF3D` (the signature lime — primary actions, active states) |
| `lime-tint-bg` / `lime-tint-border` | lime at low alpha (active pills, selected rows) |
| `success` | `#3FD986` |
| `warning` | `#FFB23E` |
| `error` | `#FF5C5C` |

**Forbidden colors:** no `violet` / `purple` / `emerald` / `blue` / `pink` accents
or gradients. The redesign removed all of them in favor of **lime + neutral**.
(The only sanctioned violet is the ambient corner glow in `globals.css`.)

---

## 5. THE design rules (these override older memory)

These are reinforced repeatedly by the user. When older notes conflict, **these win.**

### 5.1 Shape — rectangular, `rounded-lg`
- Cards, modals, inputs, dropdown panels, pills → **`rounded-lg`** (sometimes `rounded-md` for small controls).
- **NEVER** `rounded-2xl` / `rounded-3xl` / fully-rounded `rounded-full` blocks.
- Status/filter pills are rectangular `rounded-md`, not capsule pills.
- ⚠️ Memory file `feedback_component_shape.md` says "rounded-xl/2xl" — **that is stale**. Use `rounded-lg`.

### 5.2 Surface — `card-frost` (the standard translucent card)
Account/seller/marketplace cards render over a hero backdrop and must let it
bleed through. The canonical surface is the **`.card-frost`** utility
(`src/app/globals.css`), tuned in ONE place:
- **`.card-frost`** = `rgba(20,20,27,0.56)` + `blur(12px)` — apply to any card/row/
  tile/filter/search-field over the hero. Pair with `border border-border-subtle rounded-lg`.
- **`.card-frost-hover`** = lifts to `rgba(26,26,35,0.70)` on hover — add to interactive rows/tiles.
- Do NOT add a separate `backdrop-blur-*` next to `card-frost` (blur is built in).
- Reference implementation: `/account/orders`, `/fortnite/buy-vbucks` bundle tiles + cards.
- The whole account area + marketplace bundle page were swept to this in V22; new
  cards should use it, not raw `bg-white/[…]`. The older `bg-white/[0.04]`/`backdrop-blur-xl`
  recipe below is the *manual* equivalent — prefer the utility.
- Manual fallback (if a utility class can't be used): `rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl`
  (use `bg-white/[0.025]` for a flatter secondary surface, `bg-white/[0.06]` for hover).
- **Glossier panels** (navbar, dropdowns, search overlays): `bg-[rgba(12,12,16,0.92)] backdrop-blur-2xl backdrop-saturate-150`.
- **`bg-bg-raised` / `bg-bg-overlay` are OPAQUE** → they read as flat black over the
  hero. Don't use them for account-page content cards. (They're fine for genuinely
  floating dropdown *panels*, which should be opaque for legibility.)
- ⚠️ Memory `feedback_card_shape.md` says cards are opaque `bg-bg-raised` — that's true
  for non-hero surfaces, but **account pages want glass**. Latest user direction: "we
  don't want black, we want our bg passing through with a glossy finish."

### 5.3 Tailwind alpha gotcha
Tokens are raw hex, so `bg-token/opacity` does NOT work (no alpha channel).
For translucency either use `bg-white/[0.04]`, or inline `style={{ backgroundColor: 'rgba(...)' }}`.

### 5.4 Size — compact, professional, content-sized
- "Don't make cards too big just to fill the page." Cards sized to content.
- Compact-pro density: `p-4`/`p-5` cards, `px-2.5 py-1`–`py-2` controls.
- Prefer **floating inline data over modals** where a modal isn't needed.

### 5.5 Motion — framer-motion only
- `<AnimatePresence>` + `motion.div`. Collapse = `animate={{ height: 'auto' }}` ↔ `{ height: 0 }`.
- ⚠️ A nested function component rendered as `<NavItems/>` gets a fresh identity each
  parent render → remounts the subtree → kills `AnimatePresence` exit anims. Render it
  as `{NavItems()}` instead, or hoist it to a stable top-level component.

### 5.6 Copy — Title Case labels, full nouns
- Short UI labels (buttons, pills, card titles, badges): **Title Case** — "Delivery Time",
  "Order Is Overdue", "Confirm Withdrawal". Not "time", not "order is overdue".
- Body copy / full sentences stay sentence case.

### 5.7 Hero backdrop pattern
New route with a hero → use `.has-backdrop` + `.hero-backdrop` + `--page-hero-image`
CSS var + `<link rel="preload">` in `page.tsx`. 2880×1600 AVIF in `public/assets/heroes/`.
Don't reinvent per route. (`HeroBackdrop` component + `feedback_hero_backdrop_pattern` memory.)

### 5.8 Focus rings
`globals.css` has a global `:focus-visible { box-shadow: 0 0 0 4px var(--color-focus-ring) }`.
Tailwind `ring-0` can't override a raw `box-shadow` — kill it with
`focus-visible:shadow-none` when a control should not show the ring (e.g. cmdk input).

---

## 6. Engineering standards (non-negotiable — `feedback_engineering_standards`)

1. **Library components first** (§2 golden rule).
2. **Root-cause fixes, no patches/quick-fixes.** If asked "was that the proper fix?",
   the answer must be yes by construction. Fix the cause, not the symptom.
3. **Optimal time & space complexity.** E.g. the offline-seller hiding does ONE
   `getPausedSellerIds()` fetch per page + a synchronous filter, backed by a partial
   index — not an N+1 or a per-row query (§8).
4. **Proper file split & professional naming.** No dumping everything in one file;
   no `temp`, `test2`, `foo` names in committed code.
5. **Universal typography / tokens** — never hardcode hex; use the token.
6. **Mobile-first responsive.**
7. **Always `npx tsc --noEmit` before declaring done.** Remove dead code you orphan.
8. **Check memory + this doc before building anything new.** Don't re-invent a pattern
   that already exists (Combobox, AccountPageHeader, HeroBackdrop, StatusBadge, etc.).

---

## 7. Reusable building blocks (use these, don't rebuild)

| Need | Use |
|---|---|
| Conditional classes | `cn()` from `src/lib/utils.ts` |
| Card / Button / Input / Tabs / Switch / Checkbox / Dialog | `src/components/ui/*` |
| Searchable dropdown filter | `Combobox` (`src/components/ui/combobox.tsx`) — glass panel, rectangular, cmdk-powered |
| Account page header (logo tile + title + subtitle + actions) | `AccountPageHeader` (`icon=` reads `public/assets/account-icons/<icon>.svg`) |
| Account left nav | `AccountSidebar` (NavItem supports `children` sub-items + framer collapse) |
| Seller dashboard | `SellerDashboard` + `getSellerDashboard()` server action (real data, derived nudges) |
| Page hero | `HeroBackdrop` + the §5.7 pattern |
| Swappable icons | currentColor mask SVGs in `public/assets/{account-icons,menu-icons}/` |
| Toasts | `sonner` `toast` |

---

## 8. Supabase / data layer conventions

- **Server actions** live in `src/lib/actions/<domain>.ts` with `'use server'`. This is
  the data layer — pages call these, not raw SQL from the client.
- Two client factories: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts`
  (RSC + actions, cookie-aware). Use the right one for the context.
- ⚠️ **PostgREST query builders are "thenable."** `await`-ing a builder EXECUTES the
  query. So a helper that returns a builder must stay **synchronous** — if you make it
  `async` and `await` it, you run the query and lose the builder (the classic
  `query.order is not a function` bug). Keep filter helpers sync; fetch IDs once, pass
  the array in.
- **One fetch per page for cross-cutting filters.** Pattern (offline sellers):
  `const pausedIds = await getPausedSellerIds()` once → `excludePausedSellers(query, pausedIds)`
  synchronous helper applied to each query branch. Backed by a partial index.
- Key tables: `listings`, `orders` (escrow: `seller_payout`, `escrow_status`,
  `auto_release_at`, `seller_marked_delivered_at`), `reviews`, `seller_presence`
  (`store_paused` bool), `wallet_transactions`, `disputes`/`dispute_resolutions`,
  `conversations`, `category_configs`.
- `useSeller*` / `useBuyer*` hooks wrap the actions with react-query.

---

## 9. Migrations (IMPORTANT — you cannot run DDL)

- There is **no `exec_sql` RPC and no DB URL** available to the agent. You CANNOT run
  DDL/migrations yourself.
- Write the migration SQL to `supabase/migrations/<date>_<name>.sql`, then **ask the
  user to run it** in the Supabase SQL editor. Wait for confirmation before switching
  code to depend on the new column/table.
- Make migrations idempotent + include backfill where relevant (see
  `20260625_add_store_paused_to_seller_presence.sql` as the reference: `ALTER TABLE …
  ADD COLUMN … boolean` + partial index + backfill from the old sentinel).

---

## 10. Offline Mode (store pause) — worked example of the standards

`seller_presence.store_paused` boolean. When a seller toggles offline, all their offers
are hidden from buyers until toggled back on.
- Toggle: `setStorePaused(bool)` / `getMyStorePaused()` in `lib/actions/seller-presence.ts`
  (optimistic update + rollback + toast in the profile dropdown).
- Buyer browse hides paused sellers via the one-fetch-per-page pattern in §8
  (`getPausedSellerIds()` + synchronous `excludePausedSellers`).
- Seller's own listings show an amber "Offline" badge (`StatusBadge offline` prop).
- Optimal: boolean column + partial index, single fetch per page, sync filter.
- ⏳ TODO: also block paused sellers' direct listing-detail URL + checkout (browse-hiding done).

---

## 11. Current state & open threads

**Recently completed (V22 account revamp):**
- Account pages standardized: `AccountPageHeader`, glass cards, content starts under
  navbar (`pt-14` single source in `account/layout.tsx`), left-aligned, hero shows first
  (no black flash).
- Dashboard rebuilt on real data (KPIs, attention queue, recharts earnings trend, top
  offers, reputation, derived nudges).
- Orders split into Sold/Purchases sub-pages; rectangular glass filters + status chips.
- Wallet: 2-card balance (Available + Pending Sales) + stats strip + full **Withdraw**
  page revamp (single-column flow, glass, lime, compact).
- Offers (`/account/listings`): removed in-page offer-type tab row (now sidebar-driven)
  + status pill row → replaced with **Game + Status `Combobox` dropdowns** + glass search;
  bulk-edit bar on row selection; glass row cards.
- `Combobox` panel restyled to rectangular translucent glass; killed the focus-ring on
  its search input.

**Pending / deferred (see also the task list):**
- `V17j` / `V19/P3.b` — settings revamp; persist `device` on listings server-side.
- `V19/P24/P5` — bundle skeleton.
- `V21/P8–P10` — order page **seller** variant (payout, mark-delivered modal), **admin**
  variant + AI dispute pre-resolution, AI chat moderation.
- `V21/F1` — rename order_number prefix `GV-` → `DM-` (DB).
- `V21/F2` — Postgres trigger: flip `paid→delivering` on first seller message.
- `V21/P7.n` — convert Top-up category to bundle-currency layout.
- Account pages still needing a full polish pass (header done, layout pending):
  **Feedback, Wishlist, Rewards & Cashback, Refer & Earn, INFORM Disclosure, Privacy &
  Data**. Note `PrivacyClient.tsx` is heavily off-system (`bg-[#0f0f0f]`, `rounded-xl`,
  blue/red accents, `text-white/40`) — needs the §5 treatment.

---

## 12. Workflow expectations

- **Confirm scope on big/ambiguous asks** (use a quick question with a recommended
  default) — but when scope is clear, act; don't over-survey options.
- **Screenshots** from the user are the spec — match what's shown.
- After a change: `npx tsc --noEmit`, remove dead code, report honestly (if a step was
  skipped or a check failed, say so).
- The persistent memory lives at
  `~/.claude/projects/-Users-gyanendra-gamevault-admin-redesign/memory/` (index in
  `MEMORY.md`). Keep it current; this `HANDOFF.md` is the human-facing superset.
- Commit/push only when asked.
