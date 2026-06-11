# Proposal — Admin Game Management + Seller Listing Flow

Companion to [HANDOFF_ADMIN_REDESIGN.md](HANDOFF_ADMIN_REDESIGN.md) and [HANDOFF_ADMIN_REDESIGN__AUDIT.md](HANDOFF_ADMIN_REDESIGN__AUDIT.md).

**Approved decisions from the kickoff Q&A:**
1. **Conditional sub-attributes** → relational tables (`attributes`, `attribute_options`, `attribute_conditional_rules`). Every attribute and option carries a `slug` + SEO fields so they can power URLs and landing pages.
2. **Categories** → global `categories` + `game_categories` join.
3. **Seller wizard** → new `/sell` route group with its own minimal layout.
4. **Rollout** → hard cutover, no parallel routes.

---

## 1. Data model

### 1.1 Final schema

All new/changed tables. Existing tables outside the audit (orders, profiles, etc.) are untouched.

```
games
  id uuid pk
  slug text unique               ← used in URLs: /games/<slug>
  name text
  display_name text
  emoji text
  logo_url text                  ← navbar logo (square, 256×256, png/webp)
  cover_url text                 ← Popular Games cover (600×800 portrait)
  brand_color text               ← hex, for accents on game pages
  sort_order int default 99
  is_active bool default true
  seo_title text
  seo_description text
  created_at, updated_at

categories                         ← GLOBAL, 5 fixed rows at launch
  id uuid pk
  slug text unique               ← 'currency' | 'items' | 'accounts' | 'top-up' | 'boosting'
  name text                      ← 'Currency', 'Items', 'Accounts', 'Top Up', 'Boosting'
  description text
  icon_url text                  ← custom icon (Currency / Top Up etc.)
  icon_emoji text
  sort_order int
  is_active bool                 ← Boosting = false at launch
  seo_title text
  seo_description text

game_categories                    ← join, drives "what does this game sell?"
  id uuid pk
  game_id uuid fk → games
  category_id uuid fk → categories
  is_enabled bool default true
  requires_region bool default false
  available_regions jsonb        ← per-pair, e.g. Valorant Accounts has different regions than LoL Accounts
  requires_platform bool default false
  available_platforms jsonb
  delivery_modes text[] default '{manual}'   ← which delivery_method values are allowed for this pair
  sort_order int                 ← per-game category ordering
  seo_title text                 ← override for /games/<game>/<category> page
  seo_description text
  unique (game_id, category_id)

attribute_templates                ← one per (game, category) pair, replaces listing_templates
  id uuid pk
  game_category_id uuid fk → game_categories  on delete cascade
  name text                      ← admin label: 'Brainrot Items Template'
  is_active bool default true
  version int default 1          ← bump when shape changes; listings keep template_version_used
  created_at, updated_at
  unique (game_category_id)      ← one active template per pair

attributes                         ← the schema-builder rows
  id uuid pk
  template_id uuid fk → attribute_templates on delete cascade
  parent_attribute_id uuid null fk → attributes (self-ref, for nested children — optional, see §1.3)
  slug text                      ← 'mutation', 'brainrot-name', 'rarity'  — SEO/URL friendly
  name text                      ← 'Mutation', 'Brainrot Name', 'Rarity'
  description text
  type text check (type in ('text','number','textarea','select','multiselect','boolean','image_select'))
  is_required bool default false
  placeholder text
  help_text text
  min_value numeric, max_value numeric, max_length int    ← per-type validation
  default_value jsonb
  sort_order int
  seo_title text                 ← for future /games/<g>/<c>/<attr-slug> filter pages
  seo_description text
  facet_indexed bool default false  ← future: include in search index
  unique (template_id, slug)

attribute_options                  ← enum values for select/multiselect/image_select
  id uuid pk
  attribute_id uuid fk → attributes on delete cascade
  slug text                      ← 'tralalero-tralala', 'mythical', 'iron'  — SEO/URL friendly
  value text                     ← the stored value written into listings.template_data
  label text                     ← display label
  description text
  icon_url text                  ← image_select uses this (brainrot icons, knife thumbnails, rank badges)
  metadata jsonb                 ← e.g. {"income_per_sec": 50, "tier": "mythical"}
  sort_order int
  seo_title text
  seo_description text
  unique (attribute_id, slug)

attribute_conditional_rules        ← "show child attribute only if parent matches"
  id uuid pk
  attribute_id uuid fk → attributes on delete cascade   ← the CHILD attribute (the one being conditionally shown)
  trigger_attribute_id uuid fk → attributes              ← the PARENT attribute being watched
  operator text check (operator in ('equals','not_equals','in','not_in'))
  trigger_values jsonb           ← array of option values that trigger this rule
  created_at
```

Existing tables, changed:
```
listings
  + template_version_used int    ← stamps which attribute_templates.version was active at listing time
  (template_data jsonb already exists — keep, no rename)
  (region, platform columns already exist — keep)
```

Existing tables, dropped:
```
listing_templates                 ← replaced by attribute_templates + attributes + options
```

### 1.2 Why `slug` everywhere

Per your note: attribute slugs and option slugs feed URL growth.

- `/games/steal-a-brainrot/items` → game_category page
- `/games/steal-a-brainrot/items/mutation` → all-options landing for the mutation attribute (faceted browse)
- `/games/steal-a-brainrot/items/brainrot-name/tralalero-tralala` → option-level landing page

Every slug column is `UNIQUE` within its parent scope (template / attribute) and the SEO fields let the marketing team override titles/descriptions per row. Sitemap generation later can enumerate the slug graph.

### 1.3 Conditional rules — relational, not nested rows

We use `attribute_conditional_rules` (a separate table) rather than `parent_attribute_id` self-reference for the canonical encoding. `parent_attribute_id` is kept on `attributes` only as an optional grouping hint (e.g. for the builder UI to nest visually); the **show/hide logic is driven by the rules table**. Rationale: one attribute may be conditionally shown by multiple triggers (e.g. "Rarity" appears for Brainrot OR Bundle item types); a single `parent_id` can't express that.

### 1.4 Migration strategy

Three sequenced migrations. Each is reversible up to step 3.

**M1 — Create new tables, copy data, leave old tables in place**
- Create `categories` (global), `game_categories`, `attribute_templates`, `attributes`, `attribute_options`, `attribute_conditional_rules`.
- Seed 5 global categories (Currency, Items, Accounts, Top Up, Boosting).
- For every existing `public.categories` row (game-scoped): upsert a `game_categories` row that links its `game_id` to the matching global category (deduce from `metadata->>'type'` — see mapping below). Copy `requires_region`, `available_regions`, `requires_platform`, `available_platforms` from the old category's `metadata` into the join row.
- For every `listing_templates` row: create one `attribute_templates` row keyed by the matching `(game_id, category_id)` → `game_category_id`. Walk the `fields` JSON array and insert `attributes` + `attribute_options` rows. Slugs are generated from `field.name` (already kebab-ish) and `option.value`.
- No `attribute_conditional_rules` populated yet — old templates were flat.

**M2 — Switch reads in the app, dual-write**
- All read paths (admin builder, seller wizard, marketplace) read from new tables.
- Listing writes go to the new shape; for safety, also write `listings.template_data` in the existing JSONB format. (No code change actually needed — `template_data` is already the storage; only the **definition** of what fields exist moves.)
- This step lands together with the admin builder + seller wizard UI.

**M3 — Drop old tables**
- After one week of stable production, drop `listing_templates` and `public.categories` (game-scoped version).
- The OLD `public.categories` is the same table name — we will rename it to `legacy_game_categories` in M1 and create the new global `categories` under the same name. (Postgres-safe: rename old → create new → migrate FK pointers on `listings.category_id` from old IDs to new global IDs in M2.)

**`metadata.type` → global category mapping for M1:**
```
'currency'   → categories.slug='currency'
'items'      → categories.slug='items'
'account'    → categories.slug='accounts'
'top_up'     → categories.slug='top-up'
'service'    → categories.slug='boosting'   (service ≈ boosting/coaching, see note)
'gift_card'  → KEEP AS legacy, handled by separate "gift_cards" cross-game launch surface (out of scope §6)
```
Note: existing `service` rows include coaching, which is not "boosting" strictly. We collapse both into `Boosting` (disabled at launch anyway) and let admins re-categorize manually if needed before enabling.

### 1.5 RLS policies

Reuse the existing pattern (`profiles.role IN ('admin','super_admin')`).

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `categories` | anyone | admin only |
| `game_categories` | anyone | admin only |
| `attribute_templates` | anyone where `is_active=true` | admin only |
| `attributes` | anyone via active template | admin only |
| `attribute_options` | anyone via active template | admin only |
| `attribute_conditional_rules` | anyone via active template | admin only |

"anyone via active template" = a policy that joins through `attribute_templates.is_active`. Sellers and marketplace pages read freely; only admins mutate.

Storage buckets:
- Add `game-logos` (public, 2 MB, png/jpg/webp/svg) — admin write
- Add `game-covers` (public, 4 MB, png/jpg/webp) — admin write
- Add `attribute-icons` (public, 1 MB, png/svg/webp) — admin write — used for `attribute_options.icon_url` (brainrot art, rank badges, knife thumbnails)
- Keep existing `category-icons` bucket, repurpose for the 5 global category icons

---

## 2. Page-by-page UX

Visual direction: lighter, more Apple-feel. Build on the existing `glass-*` primitives from [src/components/ui/](src/components/ui/) — `glass-card`, `glass-modal`, `glass-input`, `glass-badge`. Homepage lime accent (per recent homepage work) carries through as a single CTA color; replace the current admin's heavy violet+black with a near-white card surface on a soft gradient background.

### 2.1 Admin hub — `/admin`

Single landing page (currently this route is unaudited; we'll create or repurpose). Four `GlassCard` tiles:

```
┌─────────────────┐  ┌─────────────────┐
│  🎮 Games       │  │  📦 Categories   │
│  20 active      │  │  5 (1 disabled)  │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│  💱 Currencies  │  │  🧩 Templates    │
│  per-game       │  │  18 / 95         │
└─────────────────┘  └─────────────────┘
```

Each tile links to its sub-section. Recent activity feed at bottom (optional, phase D).

### 2.2 `/admin/games` — list view

Keep a table, but lighter:
- Columns: Logo · Name · Slug · Categories enabled (badge row) · Listings · Sort · Status · ⋯
- Filter input, "+ Add Game" button (top right) → opens **wizard**, not inline row.
- Row click → opens the same wizard in edit mode.
- Pause/Delete moved into the row's `⋯` menu (no more triple `window.confirm` chains — use `glass-modal` with a typed-confirmation for destructive ops).

### 2.3 `/admin/games/new` and `/admin/games/[id]/edit` — wizard

Full-page (not modal — too much content per step). Steps:

1. **Identity** — name, slug (auto-from-name, editable), display_name, brand_color, sort_order, SEO title/description.
2. **Branding** — logo upload (square, with crop), cover upload (portrait 3:4, with crop), preview cards on the right showing how it will look in navbar and Popular Games shelf.
3. **Categories** — 5 toggle rows (Currency / Items / Accounts / Top Up / Boosting). Each enabled toggle expands to show: per-pair settings (requires_region, available_regions chips, requires_platform, available_platforms chips, allowed delivery modes). Boosting toggle is disabled and labelled "Available post-launch".
4. **Attribute templates** — for each enabled category, an inline link "Edit attribute template →" that opens §2.5 in a slide-over (Radix Dialog with side="right"). Optional in wizard; skippable, with a warning that the seller wizard will show no fields for that pair until a template exists.
5. **Review & save** — diff vs. current state for edit mode, confirmation for new.

Stepper across top is a `GlassBadge` row with checkmarks. Persist progress in URL search params so refresh doesn't lose state.

### 2.4 `/admin/categories` — repurposed

With only 5 global categories, this becomes a simple settings page: edit each category's name/icon/description/SEO fields. No add/delete (categories are fixed at launch). One scrollable column of 5 cards.

### 2.5 Attribute template builder — `/admin/games/[id]/templates/[categorySlug]`

The hard one. Pattern: **left tree of attributes / right detail editor**, plus a **live preview** of the seller-side form at the bottom-right.

```
┌──────── Attributes ────────┐  ┌──── Edit attribute ─────────────┐
│ ⠿ Item Type     (select)   │  │ Slug: item-type                  │
│   ↳ shown when: always     │  │ Name: Item Type                  │
│ ⠿ Brainrot Name (select)   │  │ Type: ▾ select                   │
│   ↳ if Item Type=Brainrot  │  │ Required ☑   Facet indexed ☑     │
│ ⠿ Rarity        (select)   │  │ Options:                          │
│   ↳ if Item Type∈{Brainrot,│  │   ⠿ Brainrot   slug brainrot  ✏   │
│      Bundle}               │  │   ⠿ Bundle     slug bundle    ✏   │
│ ⠿ Mutation      (select)   │  │   ⠿ Other      slug other     ✏   │
│ ⠿ Notes         (textarea) │  │ [+ Add option]                    │
│ [+ Add attribute]          │  │ Conditional rules:                │
│                            │  │   [+ Show this attribute only if…]│
└────────────────────────────┘  └───────────────────────────────────┘
              ┌──── Live preview (seller-side render) ────┐
              │  Item Type ▾                              │
              │  Brainrot Name ▾  (hidden until Item Type)│
              │  Rarity ▾         (hidden …)              │
              │  Mutation ▾                               │
              │  Notes [______________________]           │
              └───────────────────────────────────────────┘
```

- Left tree uses `@dnd-kit/sortable` for drag-to-reorder (new dep).
- "Add attribute" → `react-hook-form` + `zod` form in the right pane.
- For `select` / `multiselect` / `image_select` types, the right pane includes the options sub-editor with its own dnd-kit list. `image_select` shows the icon upload per option (writes to `attribute-icons` bucket).
- "Add conditional rule" UI: pick a trigger attribute (must be earlier in sort order, must be select/multiselect/boolean), operator, values. Multiple rules ANDed.
- Live preview renders the same component the seller will use, kept in sync via React Query optimistic state. Critical: ensures admin sees what seller sees before saving.

### 2.6 Seller wizard — `/sell/new`

New route group `app/(sell)/sell/`. Own `layout.tsx`:
- No navbar (excluded in [layout-wrapper.tsx](src/components/layout-wrapper.tsx) via path prefix check on `/sell`).
- No sidebar.
- Top bar: GameVault wordmark left, step indicator center, "Save & exit" right (writes draft, returns to `/account/listings`).
- Background: subtle gradient, fully takes over the viewport.

Steps (matches the handoff target):

1. **Choose category** — 5 large icon buttons in a 5-up grid (Currency, Items, Accounts, Top Up, Boosting-disabled). Each is a `GlassCard` with the custom icon from `categories.icon_url`. Tapping a card advances.
2. **Choose game** — only games where `game_categories.is_enabled=true` for the chosen category. Grid of game tiles using the new `cover_url`. Search box at top, scoped to that filtered list.
3. **Offer details** — dynamic form rendered from the attribute template for the (game, category) pair. Components:
   - Title (always present, max 100 chars, hint "Min 5 chars" — current behavior)
   - All attributes from the template, in `sort_order`, with conditional rules applied live
   - If `game_categories.requires_region`/`requires_platform` is true, those selectors at the top of the form
4. **Pricing, stock & publish** — price, original_price (discount badge preview), quantity (auto-set if instant delivery), min_quantity, delivery method (filtered by `game_categories.delivery_modes`), delivery time, images (1-5), description, terms checkbox, fee breakdown, **Publish** button.

Right rail (sticky, present on steps 3-4) carries forward the existing checklist + pro-tips pattern, just restyled.

State management: a single `useReducer` driving the wizard FSM. Persisted to `sessionStorage` on every step so refresh doesn't lose progress.

### 2.7 Sell button (everywhere)

Currently the "Sell" button (location unaudited) likely uses `<Link href="/account/listings/new">`. Change to `<Link href="/sell/new">`. The new route's layout strips the shell, satisfying the "click Sell → stripped full-screen flow" ask.

---

## 3. Library choices

| Need | Choice | Why |
|---|---|---|
| Form state & validation | `react-hook-form` + `zod` (already installed, unused) | Strong types from zod, low-rerender form, plays well with shadcn primitives. Both admin builder and seller wizard. |
| Drag-to-reorder (attributes, options) | `@dnd-kit/core` + `@dnd-kit/sortable` — **new dep** | Accessible, headless, lightweight (~30kb). Used in the template builder tree and option lists. |
| Animation | `framer-motion` (already installed) | Step transitions in the wizard. Existing pattern. |
| Wizard step routing | URL search params (`?step=2`) | No router lib needed. Keeps shareable URLs. |
| Image upload + crop | `react-image-crop` — **new dep** | Square crop for logos, 3:4 for covers, free crop for attribute icons. Small (~15kb), no canvas hacks. |
| Icons (UI chrome) | `lucide-react` (already in use) | Continue. |
| Icons (categories / attribute options) | Admin-uploaded images via storage buckets | Keeps options to user-provided art. |
| Wizard layout shell | Existing `glass-*` components | Apple-feel per handoff. No new design system. |
| Toasts | `sonner` (already in use) | Continue. |
| Data fetching | `@tanstack/react-query` (already in use) | Continue. Cache keys: `['admin-games']`, `['admin-game', id]`, `['admin-template', gameCategoryId]`, `['sell-categories']`, `['sell-games', categorySlug]`, `['sell-template', game, category]`. |

We will **not** add: tailwind variants, headless-ui, react-query persister, Storybook (out of scope), or a CSS-in-JS lib.

---

## 4. Phased rollout

Each phase ends with the app fully functional — no half-broken state in main.

### Phase A — Schema migration + read-path swap (no UI changes yet)
1. M1 migration: create new tables, seed 5 global categories, backfill `game_categories` from existing rows, backfill `attribute_templates` + `attributes` + `attribute_options` from `listing_templates.fields`.
2. Remap `listings.category_id` from game-scoped IDs to global category IDs (in M1, transactionally).
3. Update server actions (`getGameCategories`, `getCategoryById`, `getListingTemplate`) to read from new tables; output shape kept identical so existing UI keeps working.
4. Smoke test: existing `/account/listings/new` still works end-to-end against the new schema.

### Phase B — Admin redesign
1. New `/admin` hub.
2. New `/admin/games` list (lighter table, modal-confirm destructive ops).
3. Game wizard (`/admin/games/new`, `/admin/games/[id]/edit`).
4. Attribute template builder (`/admin/games/[id]/templates/[categorySlug]`) — the big one. Built behind an admin-only feature flag so we can ship the rest of B first if needed.
5. Repurpose `/admin/categories` to the 5-card settings page.

### Phase C — Seller wizard
1. Create `app/(sell)/sell/new` route group with its own minimal `layout.tsx`.
2. Update [layout-wrapper.tsx](src/components/layout-wrapper.tsx) to exclude `/sell` from the global navbar/footer.
3. Build the 4-step wizard, consuming the new attribute templates.
4. Redirect `/account/listings/new` → `/sell/new` (hard cutover). Edit mode for existing listings stays on `/sell/new?id=<listing_id>` so the layout is consistent.
5. Update every "Sell" button site-wide.

### Phase D — Tier 1 game seeding
For each of the 20 Tier 1 games, fill in attribute templates via the new builder UI (or seed SQL where appropriate). For the Roblox catalog-heavy games (Adopt Me, MM2, Blox Fruits, PS99, Steal a Brainrot, GAG, Blade Ball) I bring back research + canonical lists for your approval **before** seeding any options. Each batch is one review session, not a single mega-list.

### Phase E — Tier 2 game seeding
The 15 Tier 2 games. Lighter templates: first attribute is predefined, remaining attributes are free-form text the seller fills in. Same flow, less curated data.

### Out of Phase scope — call out as separate workstreams later
- Gift Cards launch surface (cross-game).
- Marketplace browse pages that consume the new attribute facets for filtering.
- Sitemap regeneration to enumerate the new slug graph (`/games/<g>/<c>/<attr>/<opt>` URLs).
- Tier 3 games.

---

## 5. Open questions (resolved before code)

These came from the handoff's "open questions" list. Decisions locked in here so we don't relitigate during build:

| Question | Decision |
|---|---|
| Replace `/account/listings/new` or fork? | Hard cutover, redirect. Pre-launch, no real drafts to preserve. |
| Existing seller drafts mid-flow? | Migrate `template_data` JSONB as-is. Old field names map 1:1 to new attribute slugs (we generate slugs from existing `field.name`). Drafts continue to work. |
| Image dimensions? | Logo 256×256 square (png/webp, max 2MB). Cover 600×800 portrait (png/webp, max 4MB). Listing images 1200×900 recommended, free aspect (existing). Attribute option icons 128×128 square (max 1MB). |
| CDN / storage choice? | Continue with Supabase Storage (already used for `category-icons`). New buckets per §1.5. No CDN change. |
| Cropping UX? | `react-image-crop` with the per-bucket aspect ratio enforced. Save crop in client, upload the cropped blob. |
| Currency entries — separate model or under Items? | Under the global `Currency` category. Per-game currency name (Robux, V-Bucks, Sheckles, etc.) is stored as an attribute on the Currency template for that game, with `slug: 'amount'` + `unit_label` metadata. Keeps the model uniform. |
| Gift cards UX (cross-game)? | Out of phase scope. Handled as a separate "Gift Cards" surface that doesn't go through the game-picker step. Schema for it lives in a follow-up. |

---

## 6. Risks revisited

From the audit's risk list, mitigated as follows:

1. ✅ **Categories reshape** — M1 does the full reshape in one transaction; M2 swaps reads; M3 drops the old table. App is functional after every migration.
2. ✅ **TRUNCATE precedent** — M1 uses INSERT/UPSERT only, no truncates. Listings get remapped, not deleted.
3. ✅ **Scattered RLS** — single template (§1.5) reused for all 5 new tables.
4. ✅ **UNIQUE(game_id, category_id) on templates** — kept on `attribute_templates`, but we add `version` so future schema changes don't break old listings.
5. ✅ **Hard-coded seeded enums** — M1 walks `fields[].options` and creates `attribute_options` rows with slugs derived from `option.value`.
6. ✅ **Wizard-in-account-layout** — solved by `/sell` route group with its own layout, plus updating `layout-wrapper.tsx`.
7. ✅ **`delivery_method='manual'` forced for currency** — enforcement moves to `game_categories.delivery_modes` array. Seller wizard reads it; admin sets it per (game, category).
8. ✅ **Template UI vacuum** — Phase A keeps old templates readable through the new tables. Phase B adds the builder. No window where templates disappear.

---

## 7. What we'll build first (concretely, after you approve this)

A — kickoff commits, in order:

1. **Migration M1** (one SQL file): create new tables, seed 5 global categories, backfill `game_categories`, backfill templates/attributes/options, remap `listings.category_id`, rename old `categories` → `legacy_game_categories`.
2. **Server actions refactor**: `getGameCategories`, `getCategoryById`, `getListingTemplate` read from new tables; output kept identical so existing pages keep working.
3. **Manual smoke test** of `/account/listings/new` end-to-end against new schema. We pause here, confirm green, then start Phase B.

Ready when you are.
