# Audit — Admin Game Management + Seller Listing Flow

Scope: only files in the Step-1 checklist of [HANDOFF_ADMIN_REDESIGN.md](HANDOFF_ADMIN_REDESIGN.md). No other code read.

---

## 1. Current data model (games / categories / templates / listings)

Reconstructed from the named migrations only — the `games` and `listings` tables predate these and only their column adds/changes are visible here. Treat unread columns as "exists but unknown" until verified.

### `games`
- `id uuid PK`, `name text`, `slug text UNIQUE`, `emoji text`, `image_url text`, `is_active bool`
- Added later: `display_name text` (short label for navbar), `sort_order int default 99` (lower = first in navbar dropdowns) — both from [20260217_game_expansion.sql](supabase/migrations/20260217_game_expansion.sql)
- Logo storage: just a string URL into `image_url`, typically `/games/<slug>.png` (per [update-game-logos.sql](supabase/migrations/update-game-logos.sql)). Newer rows use uploads via `uploadGameIcon` server action — bucket name not visible in checklist files.

### `categories` — **currently game-scoped, not global**
After [20260208_create_game_specific_categories.sql](supabase/migrations/20260208_create_game_specific_categories.sql):
- `id uuid PK`
- `game_id uuid REFERENCES games(id) ON DELETE CASCADE` — categories belong to ONE game
- `name`, `slug`, `description`, `display_order int`, `is_active bool`
- `metadata jsonb` — stores `{type, unit_label, requires_region, available_regions, requires_platform, available_platforms, sub_types, is_limited, is_modded}`. `type` values seen: `currency`, `items`, `account`, `gift_card`, `service`, `top_up`.
- UNIQUE `(game_id, slug)` — same slug ("accounts", "items") is reused across games.
- **The migration `TRUNCATE public.categories CASCADE`** before reseeding — destructive, but already shipped.

After [20260306_category_icons.sql](supabase/migrations/20260306_category_icons.sql):
- `icon_url text`, `icon_type varchar(20) in ('emoji','image','svg')`, `icon_emoji text default '📦'`, `sort_order int default 0`
- Storage bucket `category-icons` (public, 2 MB cap, png/jpg/svg/webp). Admin-only write RLS.
- Legacy `icon` column migrated into `icon_emoji` in a `DO $$` block; the old column may still exist or may have been dropped elsewhere — not visible.

### `listing_templates` ([20260206_create_listing_templates.sql](supabase/migrations/20260206_create_listing_templates.sql))
- `id uuid PK`, `game_id uuid NOT NULL`, `category_id uuid NULL`, `template_name text`, `fields jsonb default '[]'`, `is_active bool`, timestamps
- UNIQUE `(game_id, category_id)` — one template per (game, category) pair
- `fields` is a flat JSON array. Each field: `{name, type, label, required, placeholder, min, max, maxLength, defaultValue, options:[{value,label}]}`. Types seen: `text`, `number`, `select`, `boolean`, `textarea`.
- **Conditional sub-attributes are NOT modeled.** The current schema is a flat field list — no rule like "if Item Type = Brainrot → show Rarity".
- RLS: anyone reads `is_active=true`; admins manage.
- Seeded inserts for Roblox, Valorant, Fortnite, LoL accounts only — Items, Currency, Top Up categories have no seeded template.

### `listings` (extensions only — base table predates checklist)
Added by [20260208_create_game_specific_categories.sql](supabase/migrations/20260208_create_game_specific_categories.sql):
- `region text` (indexed where not null)
- `platform text` (indexed where not null)
- Compound indexes: `(game_id, category_id, region)`, `(game_id, category_id, platform)`, full filter `(game_id, category_id, region, platform, price)` for active listings

From [listings actions usage in /account/listings/new/page.tsx](src/app/account/listings/new/page.tsx):
- Stores filled-in template values in a `template_data jsonb` column (read on line 311, written via `CreateListingInput.template_data`).
- Other writable fields seen: `title, description, price, original_price, quantity, min_quantity, delivery_method ('instant'|'manual'), delivery_time, delivery_method_type, images[], status ('draft'|'active'), region, platform`.

### Relationships (visible from the audit set)

```
games (1) ──< categories (game_id)
games (1) ──< listing_templates (game_id)
categories (1) ──< listing_templates (category_id)
games (1) ──< listings (game_id)
categories (1) ──< listings (category_id)
listings.template_data jsonb  ←  shape defined by listing_templates.fields
```

No join table `game_categories`. **"Per-game enablement" is achieved today by category rows themselves being game-scoped**, not by a many-to-many. The handoff envisions a global categories table + `game_categories` join — that's a model change, not just an extension.

---

## 2. Admin /admin/games UX — 5 bullets ([page.tsx, 1122 lines](src/app/(admin)/admin/games/page.tsx))

- **Single flat table, dark violet/black theme.** Columns: Icon · Name · Slug · Display Name · Manage Icon · Order · Listings · Status · Actions. Filter input + "Add Game" in header. Inactive games stay visible with red-tinted row.
- **Inline-row editing only** (no modal, no wizard). Click ✏ → row becomes an `EditRow` with inputs. "Save first, then upload →" hint because uploads need a saved row.
- **Per-game category management is inline-expandable**: each row has a ▸ chevron that opens a `GameCategoriesSection` (nested table with the same emoji/upload/edit pattern, scoped to that game's `categories`). This is the only place game↔category linkage is managed today.
- **Icon upload is two-track:** emoji string field (inline) + image upload (`GameIconUploadCell` → base64 → `uploadGameIcon` server action). Uploaded image takes precedence; delete reverts to emoji.
- **Destructive ops use `window.confirm` chains** (one or two prompts) — no modal pattern. Pause/Resume and Delete both call server actions and invalidate React Query keys `['admin-games']`, `['admin-categories', gameId]`, `['nav-categories']`.

**Painful** (observed from the code, not external):
- No notion of attribute templates here at all — admin must navigate elsewhere (presumably no UI exists for templates yet; templates are seeded by SQL only).
- "Display name", "Order", "Manage Icon" all crammed into one row → narrow columns; editing is fiddly.
- No image cropping / aspect-ratio guidance for game icon vs. cover art. The handoff calls out cover art for Popular Games separately, which has no admin surface.

---

## 3. Admin /admin/categories UX — 5 bullets ([page.tsx, 567 lines](src/app/(admin)/admin/categories/page.tsx))

- **Same table-with-inline-edit pattern as /admin/games.** Columns: Emoji · Icon Upload · Name · Slug · Description · Order · Listings · Status · Actions.
- **This page lists categories WITHOUT showing their `game_id`** — `fetchAdminCategories()` is called with no argument, so it returns all rows globally. Two categories with slug `accounts` on different games will both appear identically.
- **Same `IconUploadCell` component for emoji+image** (re-implemented inline, slightly different layout from games page).
- **No game filter, no game column.** A category here is orphan-looking from the admin's perspective unless they remember which game it came from.
- **Delete is disabled when `listing_count > 0`.** Pause/Resume + Delete use the same double-`confirm` pattern as games.

**Painful** (observed):
- Duplicates and overlaps /admin/games' nested category table — same category surfaces in both places with different context. Hard to tell which page is the source of truth.
- No attribute-template surface; metadata (`requires_region`, `available_regions`, etc.) isn't editable through the UI at all. It's hard-coded in the SQL seed.

---

## 4. Seller /account/listings/new UX — 5 bullets ([page.tsx, 1613 lines](src/app/account/listings/new/page.tsx))

- **2-step wizard, not the 4-step in the handoff target**: Step 1 = Game + Category (+ Region + Platform if `metadata.requires_*`); Step 2 = everything else (Title, Description, Template fields, Images, Pricing, Inventory, Delivery, Instant codes). `STEPS` array on lines 100-103.
- **State machine = many `useState` + `useEffect` chains** (no reducer, no FSM lib). Game-change effect resets category/region/platform/template; category-change loads `selectedCategoryData` + decides if delivery must be manual (currency forces `'manual'`); category+game combo triggers `loadTemplate`.
- **Renders inside [account layout](src/app/account/layout.tsx)** — `AccountSidebar` is mounted and main wrapper applies `lg:pl-72`. There IS already an exception list in that layout (`isOrderDetail`, `isBecomeSeller`, `isSellerStatus`) for stripping the sidebar — same hook could include the listing wizard but currently does not. Layout-wrapper also keeps the floating navbar.
- **Template renderer is built-in** — switch on `field.type` (text/number/textarea/select/boolean) writes into `templateData` state. No conditional sub-attribute handling. Required-validation only checks top-level fields.
- **Edit mode is the same page** (`?id=...` triggers `loadListingForEdit`) and pre-fills all state. Drafts: `status: 'draft'` write path. Right sidebar has a checklist + sticky Publish/Draft buttons; pro-moderation banner if seller's first N listings.

**Painful** (observed):
- "Stripped layout" is the explicit user ask in the handoff — currently the sidebar and navbar are both visible, which is exactly the layout the redesign wants to escape.
- The Step-1 hero says "Step 1 of 2" — the handoff target is 4 steps (category-first, then game, then dynamic offer details, then offer + submit). The current ordering is the reverse.
- File is 1613 lines doing everything inline (selector components are extracted but template rendering, image grid, delivery method buttons, instant-delivery codes, sidebar checklist all live in this one component). Hard to redesign incrementally.

---

## 5. Already done vs fresh-build vs rip out

| Area | Verdict | Notes |
|---|---|---|
| `listing_templates` table + JSONB `fields` | **Keep + extend** | Flat field list works for ~80% of cases. To get conditional sub-attributes either (a) extend `fields[].showWhen = {fieldName, equals}` rules in the same JSON, or (b) move to relational `attributes` + `attribute_options` + `attribute_conditional_rules` tables as the handoff suggests. Migration story matters because some templates are already seeded. |
| `listings.template_data jsonb` | **Keep** | Already the right shape for storing filled-in answers. No separate join table needed. |
| `listings.region`, `listings.platform` | **Keep** | Indexes are already in place. |
| Game-scoped `categories` (game_id FK) | **Rip out / re-model** | Handoff wants global categories (Currency/Items/Accounts/Top Up/Boosting) + `game_categories(game_id, category_id, is_enabled)` join. Current schema duplicates "accounts"/"items" per game with the same `metadata.type`. Migration must rebuild: extract distinct `metadata.type` values into 5 global rows, build the join from existing rows, preserve `metadata` overrides per pair. |
| `categories.metadata` (region/platform/sub_types) | **Move** | Region/platform requirements logically belong on the (game, category) pair or on the template — not the category itself, because they vary by game. Today the metadata is per-game-scoped row, which "works" only because categories aren't global. |
| Per-game icon/cover storage | **Keep buckets, extend** | `category-icons` bucket exists. Need a parallel `game-logos` and `game-covers` bucket (handoff calls out navbar logo vs. Popular Games cover art) — bucket for game logos isn't visible in the checklist migrations. |
| Admin /admin/games inline-row editor | **Rip out, replace with wizard** | Step-by-step builder per handoff. The existing table can stay as the list view + entry point. |
| Admin /admin/categories standalone page | **Rip out (or repurpose)** | With global categories, this page becomes "the 5 fixed categories" + an attribute-template browser. Most editing moves into the per-game wizard. |
| Seller /account/listings/new 2-step flow | **Rip out, replace with 4-step full-screen wizard** | Step order inverts (category → game → details → submit). Layout must be stripped. Use a new route group to avoid touching the account layout. |
| `Account layout`'s exception list for stripped pages | **Extend** | Already a pattern at [account/layout.tsx:52-62](src/app/account/layout.tsx). The wizard can join it, OR (cleaner) live under a sibling route group with its own layout. |
| Existing template renderer (text/number/select/boolean/textarea) | **Keep + extend** | Add: `showWhen` conditional logic, multi-select, image-picker for enum options (e.g. brainrot icons), and a "free-form additional notes" fallback for Tier 2 games. |

---

## 6. UI library / component primitives in use

From [src/components/ui/](src/components/ui/) and [package.json](package.json):

- **shadcn-style primitives present**: `button`, `card`, `input`, `label`, `textarea`, `dialog`, `radio-group`, `checkbox`, `slider`, `separator`, `skeleton`, `badge`, `alert`, `pagination-controls`.
- **"Glass" / Apple-feel components already exist**: `glass-badge`, `glass-card`, `glass-input`, `glass-modal`, plus `glass-index.ts` barrel. The handoff's "lighter, more Apple feel" can build on these — they are not currently used in the admin pages (which are heavy dark + violet) but are available.
- **Animation**: `framer-motion` ^11 (used heavily in the listings page for step transitions, expand/collapse).
- **Forms**: `react-hook-form` ^7.54 + `@hookform/resolvers` + `zod` ^3.24 are all installed but **not used** in the audited pages (everything is hand-rolled `useState`). Available for the redesign.
- **Drag & drop**: `react-dropzone` ^14 is installed (for file uploads). **No `dnd-kit`** — needed for reordering attribute fields in the template builder; would be a new dep.
- **Data**: `@tanstack/react-query` ^5.90, `@supabase/ssr`, `zustand` ^5 (not seen in audited files).
- **Decorative**: `meteors`, `moving-border`, `layout-text-flip`, `background-ripple`, `multi-step-loader`, `spinner-loader`, `navbar-menu` — visual flourishes available for the wizard.
- **Icons**: `lucide-react` is the standard; `@tabler/icons-react` also installed. The handoff calls for "custom icons" per category — likely uploaded images via the existing `category-icons` bucket.

**No** Headless UI, no Radix Tabs/Accordion (only Dialog/Checkbox/RadioGroup/Slider primitives) — if the wizard wants tabs or an accordion for the template builder, those would be new.

---

## 7. Risks

1. **Categories table is global-vs-game-scoped — and the schema is presently game-scoped.** Going to a global-categories + `game_categories` join requires:
   - A reshape migration that dedupes ~5 category "types" out of ~50 existing rows.
   - Updating every read path (the seller wizard's `getGameCategories`, navbar, marketplace pages — not in audit scope so unverified) to read from the join.
   - Existing FKs on `listings.category_id` point at game-scoped rows; either remap them to global IDs (preferred) or keep dual writes during transition. Both are error-prone.
   - The handoff says "Phase A: schema + admin Games CRUD redesign" — that schema migration is the riskiest single piece.

2. **`TRUNCATE public.categories CASCADE` is already in the history.** If `listings` had any rows referencing categories at the time it ran, they were deleted by cascade. Future destructive migrations must be guarded with row-count checks; the proposal should add a "no-truncate" rule.

3. **RLS policies are scattered across many migrations** (only a handful in the audit scope). Risks:
   - `listing_templates` RLS: anon/authenticated can read all active templates (line 34-37 of [20260206_create_listing_templates.sql](supabase/migrations/20260206_create_listing_templates.sql)) — fine for now, but new tables (`attributes`, `attribute_options`, `attribute_conditional_rules`) must mirror this or sellers won't see the schema-builder output.
   - Admin writes use `profiles.role IN ('admin', 'super_admin')`. That role check pattern must be reused on every new admin-only table.
   - Storage bucket policies (`category-icons`) use the same admin check — replicate for any new buckets.

4. **`listing_templates` UNIQUE(game_id, category_id) constrains one template per pair.** If the redesign wants variants (e.g. "Brainrots" vs "Bundles" both under Items for Steal a Brainrot), it either (a) bakes the variant into a single template via a conditional rule, or (b) drops the unique constraint and adds a `variant_key`. Option (a) aligns with the handoff's schema-builder direction.

5. **Existing templates are seeded inline in the migration with hard-coded option enums** (Iron→Radiant for Valorant, EUW/NA/KR for LoL, etc.). When the proposal recommends extracting attribute options into a separate `attribute_options` table, those seeds need a migration plan: read JSON → upsert into new tables → keep templates working in the meantime. Otherwise live listings break.

6. **Seller wizard render-inside-account-layout assumption is baked in.** A new route at `/account/listings/new` shares that layout no matter what. Solutions: (a) move the route to `/sell/new` under its own group with a minimal layout, or (b) add the wizard path to the strip-list in `account/layout.tsx`. Option (a) avoids the navbar via `layout-wrapper.tsx` only if we ALSO add the path to its exception list (currently only `/admin` is excluded) — both files need a touch.

7. **`listings.delivery_method` is forced to `'manual'` for `metadata.type === 'currency'`** ([listings/new page line 376-378](src/app/account/listings/new/page.tsx)). When we migrate to global categories, this enforcement needs to move from category metadata to the (game, category) join row's metadata, or it must read from a stable global category-type field on the new categories table. Otherwise the constraint silently breaks.

8. **No template UI exists today.** Seeded SQL is the only way templates land in production. If the proposal Phase B introduces a builder before any templates are migrated to the new shape, you risk a window where the seller wizard shows nothing for some (game, category) pairs. Sequencing matters: keep the old `fields` JSON path readable until the new shape is fully populated.

---

End of audit. Stopping here for review per Step 1 instructions — no proposal written yet.
