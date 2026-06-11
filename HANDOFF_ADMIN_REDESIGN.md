# Handoff — Admin Game Management + Seller Listing Flow Redesign

> Written at the end of a long homepage-redesign session. The next session opens **cold** — read this entire doc first, then start with the audit step.
>
> **No code changes have been made for this project yet.** Everything below is plan-only.

---

## Project scope (what this redesign actually is)

Two coupled redesigns that depend on a shared schema-builder system:

### 1. Admin game management (`/admin/games`, `/admin/categories`)
Current state: large flat-CRUD pages (admin/games is ~1100 lines, admin/categories is ~566 lines). Need a step-by-step builder UI that lets an admin:

- Create or edit a **Game** (slug, name, logo for navbar, cover art for Popular Games, branding)
- Per game, enable any subset of these **categories**: Currency / Items / Accounts / Top Up / Boosting (Boosting is disabled at launch but the data model must support it)
- Per game + category, define an **attribute template** with **conditional sub-attributes** (schema-builder)
  - Example: Steal a Brainrot → Items → admin defines `Mutation` (enum), `Item Type` (enum: Brainrot / Bundle / Other), and conditionally: `if Item Type = Brainrot → require Brainrot Name (enum) + Rarity (enum)`
- Manage Currency entries per game (Robux, V-Bucks, etc.) — currency is simpler, mostly a single named item with its own pricing

### 2. Seller listing flow (`/account/listings/new`)
Current state: 1613-line page with the existing "Step 1 of 2: Select Game → Category" flow (screenshot in the session). User-reported pain: the page renders inside the regular layout with sidebar + navbar; they want a **stripped, full-screen flow** when "Sell" is clicked.

Target flow:
1. Click "Sell" anywhere → **client-side navigate** to a stripped-layout listing wizard (no sidebar, no main navbar — just the wizard)
2. Step 1: pick **category** (buttons with custom icons: Currency / Top Up / Items / Accounts / Boosting–disabled)
3. Step 2: pick **game** (only games where that category is enabled)
4. Step 3: **Offer details** — form fields rendered dynamically from the admin-defined attribute template for `(game, category)`. Includes conditional sub-fields.
5. Step 4: Offer Title / Image / Description / Min Quantity / Stock / Discount / Terms / Fee preview / Submit

Image upload sizing/specs to be discussed later (user's note).

---

## Decisions already made (don't re-litigate these)

| Question                                  | Answer                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Approach                                  | **Full audit first — no code yet**, then written proposal for approval |
| Attribute-system depth                    | **Full schema-builder with conditional sub-attributes** (most powerful, most complex)  |
| Data seeding strategy                     | **Hybrid** — user provides specs for games they care about; for Roblox games with deep in-game catalogs (Adopt Me pets, MM2 knives, Blox Fruits, PS99 pets, Brainrot catalog, GAG pets/crops/mutations), I research canonical lists from Wiki/Fandom/community sources and present for user review before seeding |
| Session strategy                          | **New session/worktree** — too big for one conversation                |
| Boosting                                  | Data model supports it but **disabled at launch**                      |
| Tier 3 games                              | **Out of scope for now** — Tier 1 + Tier 2 only                       |
| Gift Cards                                | Cross-game category at launch with 7 brands (Steam, PS, Xbox, Nintendo, Apple/Google, Roblox, Razer Gold) — exact UX TBD during proposal |
| Visual direction                          | **Lighter, more "Apple" feel**, not the heavy dark of the current admin. Match homepage lime accent + glass panels. User mentioned "use the best libraries for components if needed" |

---

## Step 1 — Audit (do this FIRST, no code)

Read these files **completely** (not partial) and write a short audit note for each:

### Frontend
- `src/app/(admin)/admin/games/page.tsx` (1122 lines) — what UI exists, what tables/columns it writes to, what props it expects
- `src/app/(admin)/admin/categories/page.tsx` (566 lines) — same questions
- `src/app/account/listings/new/page.tsx` (1613 lines) — current seller flow, how it reads templates (if at all), what state machine it uses
- `src/app/(marketplace)/layout.tsx` (or wherever the regular shell with sidebar/navbar lives) — needed to understand how to "strip" the layout for the seller wizard
- Find any existing UI primitives directory (likely `src/components/ui/` — shadcn?) — confirm what's already available before adding new libs

### Backend / schema
- `supabase/migrations/20260206_create_listing_templates.sql` — this name suggests an attribute-template system may already partially exist. If so, the schema-builder might be ~50% built already
- `supabase/migrations/20260208_create_game_specific_categories.sql` — per-game category enablement may already exist
- `supabase/migrations/20260306_category_icons.sql` — icon system
- `supabase/migrations/20260217_game_expansion.sql` — recent games schema extension
- `supabase/migrations/update-game-logos.sql` — logo storage pattern
- Any tables matching: `games`, `categories`, `game_categories`, `attributes`, `listing_templates`, `template_attributes`, `attribute_options`, `listings`

### Audit deliverable
A `HANDOFF_ADMIN_REDESIGN__AUDIT.md` document with:
1. Current data model diagram (tables + columns + relationships) for games / categories / attributes / listings
2. Current admin/games UX in 5 bullets — what works, what's painful
3. Current seller flow UX in 5 bullets — what works, what's painful
4. What's **already done** that we should keep / extend vs **fresh-build** vs **rip out**
5. What UI library / component primitives are in use
6. **Risks**: existing data that can't be migrated cleanly, RLS policies that constrain the new schema, etc.

---

## Step 2 — Written proposal (after audit, before any code)

Write a `HANDOFF_ADMIN_REDESIGN__PROPOSAL.md` covering:

### Data model
- Final schema for: `games`, `game_categories` (many-to-many with `is_enabled`), `attribute_templates`, `attributes`, `attribute_options`, `attribute_conditional_rules` (the schema-builder), `listings` (and how it stores filled-in attribute values — JSONB? separate table?)
- Migration plan: drop/keep existing tables, data backfill strategy
- RLS policies for admin-only writes vs seller-readable templates

### Page-by-page UX
- Admin landing (`/admin`?) — hub with cards for Games / Currencies / Categories / Attribute Templates
- Admin → Games list — list view with quick edit + "Add Game" entry to step-by-step builder
- Admin → Add/Edit Game wizard — multi-step modal or page (logo upload → categories enabled → per-category attribute template builder)
- Admin → Attribute Template builder — the schema-builder UI (this is the hard one)
- Seller wizard — full-screen stripped layout, client-routed (no full reload), 4 steps with custom icons

### Library choices
- Recommend specific libs for: schema-builder form rendering (likely `react-hook-form` + `zod`), drag-to-reorder attribute order (`dnd-kit`?), image upload + crop (TBD), icon set choice
- Confirm we stay on existing shadcn/Tailwind primitives where possible

### Phased rollout
- Phase A: schema + admin Games CRUD redesign
- Phase B: attribute template builder + per-game category enablement
- Phase C: seller wizard redesign consuming templates
- Phase D: seed Tier 1 games + their attribute data
- Phase E: seed Tier 2 games + simpler templates

User approves the proposal → then we code.

---

## Step 3 — Build (only after proposal approved)

Open questions to revisit at proposal time:
- Should we replace the existing layout for `/account/listings/new` route entirely (route group with no sidebar), or fork a `/account/listings/new-wizard` route while keeping the old one alive during transition?
- How to handle existing seller drafts mid-flow when we switch the schema?
- Image upload: dimensions? CDN/storage choice? Cropping UX?
- Currency entries: are they a separate model or just a flavor of "Items" with category = currency?
- Gift cards UX (cross-game): single section vs game-attached?

---

## Tier 1 / Tier 2 game taxonomy (verbatim from user)

### Tier 1 — Launch must-haves (~20 games)
Get full attribute templates, predefined dropdowns, SEO descriptions from day one.

| Game | Currency | Items | Accounts | Top Up | Boosting |
|------|----------|-------|----------|--------|----------|
| Roblox (platform) | Robux | — | ✓ | ✓ | — |
| Adopt Me | — | ✓ (pets: FR/NFR/MFR, age) | ✓ | — | — |
| Steal a Brainrot | — | ✓ (brainrots: mutation, income/s) | ✓ | — | — |
| Grow a Garden | Sheckles | ✓ (pets, crops, mutations) | ✓ | — | — |
| Blox Fruits | — | ✓ (fruits, gamepasses) | ✓ | — | ✓ (levels) |
| Murder Mystery 2 | — | ✓ (knives/guns, rarity) | — | — | — |
| Pet Simulator 99 | Gems | ✓ (pets, rarity, shiny) | — | — | — |
| Blade Ball | Tokens | ✓ (swords, abilities) | — | — | — |
| Fortnite | V-Bucks | — | ✓ (skins owned) | ✓ (Crew) | — |
| Valorant | VP | — | ✓ (rank, skins) | ✓ | ✓ (rank) |
| League of Legends | RP | — | ✓ (smurfs, rank) | — | ✓ |
| EA Sports FC 26 | FC Coins | — | ✓ | ✓ (FC Points) | — |
| Call of Duty | — | — | ✓ | ✓ (CP) | ✓ (camos) |
| GTA V Online | Cash | — | ✓ (modded) | — | ✓ (rank) |
| Old School RuneScape | OSRS Gold | ✓ | ✓ (maxed, pures) | — | ✓ (quests) |
| WoW (retail + Classic) | Gold | ✓ | ✓ | — | ✓ (raids, M+) |
| Genshin Impact | — | — | ✓ (5-star rosters) | ✓ (Genesis Crystals) | — |
| Honkai: Star Rail | — | — | ✓ | ✓ (Oneiric Shards) | — |
| Clash of Clans | — | — | ✓ (TH level) | ✓ (gems) | — |
| Clash Royale | — | — | ✓ | ✓ | — |

### Tier 2 — Fast follow, weeks 2-4 (~15 games)
Listed at launch but attribute templates simpler (first attribute predefined, rest free-form).

| Game | Key categories |
|------|----------------|
| Brookhaven RP | Accounts |
| Fisch / Fish It! | Items (rods, fish), Accounts |
| Anime Vanguards / Anime Defenders | Items (units), Accounts |
| Dress to Impress | Items, Accounts |
| 99 Nights in the Forest | Items, Accounts |
| Jailbreak | Cash (currency), Items (vehicles) |
| Bee Swarm Simulator | Items, Accounts |
| Counter-Strike 2 | Items (skins — huge market), Accounts |
| Rainbow Six Siege X | Top Up (R6 Credits), Accounts, Boosting |
| Apex Legends | Top Up (coins), Accounts, Boosting |
| Brawl Stars | Top Up (gems), Accounts |
| PUBG Mobile | Top Up (UC), Accounts |
| Mobile Legends | Top Up (diamonds), Accounts, Boosting |
| Escape from Tarkov | Currency (roubles), Items, Accounts |
| Path of Exile 2 | Currency (orbs — divine/exalted), Items, Accounts |

### Gift Cards (cross-game, separate launch category)
Steam, PlayStation, Xbox, Nintendo eShop, Apple/Google Play, Roblox gift cards, Razer Gold.

### Tier 3 — Out of scope for now
Minecraft, Overwatch 2, Rocket League, Pokémon GO, COD Mobile, Delta Force, Wuthering Waves, Zenless Zone Zero, Whiteout Survival, Growtopia, Albion Online, Lost Ark, Final Fantasy XIV, Elder Scrolls Online, Dota 2. Add when seller demand appears.

---

## Roblox in-game catalog research (defer until build phase)

For these games, I'll need to research and present canonical lists for user approval BEFORE seeding the admin attribute templates. Likely sources: Fandom wikis, Trello boards (community-maintained for some Roblox games), Reddit megathreads, official game value lists.

- **Adopt Me**: full pet list × rarity (Common/Uncommon/Rare/Ultra-Rare/Legendary) × age states (Newborn → Full Grown) × FR/NFR/MFR designations
- **Murder Mystery 2 (MM2)**: knives + guns catalog with rarity (Common → Vintage → Ancient → etc.)
- **Blox Fruits**: fruits catalog (Common → Mythical), gamepasses
- **Pet Simulator 99 (PS99)**: pets catalog, rarity tiers, shiny variants
- **Steal a Brainrot**: brainrots catalog with income/s + mutations
- **Grow a Garden (GAG)**: pets, crops, mutations
- **Blade Ball**: swords and abilities

Recommendation in proposal: present these as one approval batch with a "review and edit" flow before they hit production.

---

## Honest observations (user-provided, keep in mind during build)

1. **Don't seed all 35 with equal effort.** Tier 1 = full templates (real hours per game). Tier 2 = first-attribute-predefined fallback. Appearance of breadth attracts sellers; depth follows demand.
2. **Trending Roblox games churn fast** (Steal a Brainrot / Grow a Garden are huge now but meme-driven). Architecture must support deactivating + adding games easily. Editorial: review Roblox top charts monthly and rotate homepage Popular Games to match.
3. **Legal sensitivity** for Genshin/HoYoverse + Riot accounts + CS2 skin trading. Standard "venue not party" positioning is fine, but consider prioritizing UID-based top-ups (safer) over account sales for those specific publishers early on. Worth a proper review before launch — flag this for the user's lawyer, not me.

---

## Context from the homepage session that just ended

Recent work that's now live and **must not be broken** by this redesign:

- Homepage at `src/features/home/pages/HomePage.tsx` — full redesign: hero, popular games shelf with arrow paging, tabbed Shop by Category shelf with 5×2/4 grid + expand, Trust Stats, How It Works (with backdrop image), Why GameVault (aurora), CTA Band (backdrop), Recently Sold ticker
- Game cover art at `/public/games/covers/[slug].jpg` (600×800), section backdrops at `/public/section-bg/[name].jpg` (2400×900), noise texture at `/public/textures/noise.svg`
- `src/features/home/hooks/usePopularGames.ts` extended with `coverSrc` + `categories`
- `src/features/home/hooks/usePopularCurrencies.ts` extended to 20 entries
- `src/features/home/hooks/usePopularCategories.ts` extended `CategoryCard` interface with `fromPrice` + `listingCount`, 20 entries each for items/accounts
- `src/features/home/components/CategoryCard.tsx` redesigned to mirror CurrencyCard layout
- `src/features/home/components/GameCard.tsx` redesigned as portrait cover tile
- Tailwind config has new keyframes: `gradient-x`, `aurora-drift-a`, `aurora-drift-b`

These hooks are mock data; the schema redesign needs to expose equivalent shape via real Supabase queries when ready.

---

## How to start the next session

Open in a fresh worktree:

```bash
cd /Users/gyanendra/gamevault
git worktree add ../gamevault-admin-redesign -b admin-redesign main
cd ../gamevault-admin-redesign
```

Then prompt the new session with:

> Read `HANDOFF_ADMIN_REDESIGN.md` at the repo root. Begin with Step 1 (audit) — read no code outside the files listed in the audit checklist, write the audit doc, then stop and wait for me to review before writing the proposal.

The session should not start building anything until both the audit and the proposal are written and approved.
