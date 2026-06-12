# Seller Experience — Design Spec (no code yet)

Companion to `HANDOFF_ADMIN_REDESIGN.md` / `__AUDIT.md` / `__PROPOSAL.md`.
Written after the Phase A–C build (additive schema, admin redesign, `/sell/new` wizard).

This document is **design-only**. It defines the target seller experience, the
features we're committing to, and how each grounds onto systems that already
exist in this branch. Implementation happens after review.

---

## 0. Decisions locked (from the kickoff Q&A)

| Decision | Choice |
|---|---|
| Theme | **Drop purple. Adopt the lime/homepage design language** (currently on `homepage-redesign` branch) by extracting its tokens into this branch. Applies to `/sell` and admin. |
| Build | **Bulk Upload (CSV)** + **Duplicate listing** + **Live buyer-card preview + price guidance** — all behind a moderation gate. |
| Moderation gate | **Tier-based.** Trusted sellers auto-approve; new/unverified sellers queue. Caps scale with trust. |
| Bulk caps | **Seller tier + verification status** drive the cap. |
| Price data | **Completed sales (orders)** for the same game + category. |
| Sequencing | **Design first** (this doc), then build. |

---

## 1. The branch reality (must resolve before theming)

Confirmed by inspection:

- **`main`** has **no lime theme**. Its homepage is the old `src/app/page.tsx` (violet/purple/cyan). Latest commit is a withdrawal-migration script.
- **`homepage-redesign`** has the lime theme: a `--lime` token in `src/app/globals.css` and lime accents across `src/features/home/*` (`HeroCarousel`, `WhyCard`, `HowStep`, `RowHeader`, `RecentlySoldTicker`, `HomePage`). **It has never merged to main.**
- **`admin-redesign`** (this worktree) branched from main before the homepage work, so it carries the **old** violet theme. Everything the sell wizard "matched" was the old homepage.

**Action:** extract the lime design tokens from `homepage-redesign` into this branch
(option 1 from the Q&A) — not a full branch merge, just the tokens and accent
patterns. See §6 for the token plan.

---

## 2. Competitive read (where we win)

Leaders: Eldorado, PlayerAuctions, G2G, Funpay. Adjacent: StockX, Whatnot, Depop.

**Table stakes we already have or lead on:**
- Category-first selection (Eldorado pattern) ✓
- Dynamic per-(game, category) attribute forms with conditional sub-fields —
  **we lead here.** Competitors hardcode attributes; ours are admin-authored.

**Table stakes we're missing:**
- **Bulk listing** — Eldorado leads its "Start selling" screen with *Bulk Upload (CSV) — New*, above Currency. Power sellers drive most GMV and a one-at-a-time wizard repels them.
- **Duplicate / list-another-like-this** — turns the 2nd–Nth listing into seconds.
- **Price guidance** — reduces abandonment and bad pricing.

**2026 differentiators most sites miss (future, not this phase):**
- AI screenshot → pre-filled listing (our schema-builder makes this cheap; incumbents can't easily copy it because their attributes are hardcoded). **Flagged as the wedge for a later phase.**
- AI-generated titles/descriptions from filled attributes.
- Image-hash duplicate/fraud detection.

**Strategic note:** the dynamic schema is the asset that makes the AI features
cheap later. We are not building AI now, but every decision here should keep the
door open (e.g. `template_data` keyed by attribute slug is already AI-friendly).

---

## 3. The safety principle (the crux of bulk upload)

The concern: bulk upload could let bad actors flood hundreds of unvetted listings.

**Resolution — bulk = queue, not bulk = live.** Three rules:

1. **Listings created in bulk default to `pending_approval`, never `active`.**
   They enter the existing moderation queue (`status = 'pending_approval'`,
   surfaced by `getPendingListings`, cleared by `approveListing` /
   `approve_listing` DB fn). This holds **regardless of seller tier** for the
   first version — we can relax it for diamond/platinum later.

2. **Throughput scales with trust (tier + verification).** Caps below.

3. **"Every listing is checked" becomes a buyer-trust selling point**, not a
   bottleneck — provided moderator capacity keeps up. We add queue-health
   metrics to the admin so we can see backlog.

### Tier-based caps (proposed starting values)

Grounded on the existing 6-tier system (`unverified → bronze → silver → gold →
platinum → diamond`) and verification status.

| Tier | Single-listing flow | Bulk upload/day | Auto-approve? |
|---|---|---|---|
| Unverified | allowed, **queues** | **disabled** (0) | no — always queue |
| Bronze | allowed, queues | 10 | no |
| Silver | allowed, queues | 25 | no |
| Gold | allowed, **auto** | 100 | **single: auto; bulk: queue** |
| Platinum | allowed, auto | 250 | single auto; bulk auto above 95% approval history |
| Diamond | allowed, auto | 500 | auto |

- "Auto-approve" means the listing goes live without review. Driven by the
  existing moderation logic (`checkSellerNeedsModeration`) extended to read tier.
- Verification (KYC) is a multiplier/gate: an **unverified** seller of any tier
  cannot bulk upload at all; verification unlocks the tier's bulk cap.
- All numbers are config, stored alongside `seller_tier_config` so they're
  tunable without a deploy.

---

## 4. Target seller flows

Three entry points from a single **"Start selling"** hub (mirrors Eldorado's
`/sell` landing), replacing the current direct-to-wizard jump:

```
/sell  (hub)
 ├─ Single listing      → /sell/new        (the 4-step wizard we built)
 ├─ Bulk upload (CSV)   → /sell/bulk        (new)
 └─ Duplicate existing  → /sell/new?from=<listingId>  (pre-filled wizard)
```

The hub shows the seller's tier, what their bulk cap is, and a "needs review vs
auto-live" indicator so expectations are set before they start.

### 4.1 Single listing — `/sell/new` (exists, keep refining)

The 4-step wizard already built (Category → Game → Details → Publish). Additions:

- **Live buyer-card preview** (§5.1) docked beside Step 4 (or as a toggle on
  mobile).
- **Price guidance** (§5.2) inline in the pricing section of Step 4.
- **On publish:** route through tier-aware moderation — `active` if the tier
  auto-approves, else `pending_approval` with a "submitted for review" state.
- **Draft autosave** (already have `status: 'draft'` plumbing — wire it so
  refresh/return resumes the full draft, not just the step).

### 4.2 Bulk upload — `/sell/bulk` (new)

Flow:

1. **Pick game + category** (same selectors as the wizard, reused).
2. **Download a template CSV** generated *from the attribute template* for that
   (game, category). Columns = `title, price, quantity, min_quantity,
   delivery_method, <each attribute slug>`. This is the magic: the CSV columns
   are dynamic per category, derived from the same schema the wizard uses.
3. **Upload filled CSV.** Parse client-side, validate each row against the
   attribute schema (required fields, enum values must match option slugs,
   number ranges, conditional-field logic).
4. **Review table** — a spreadsheet-like grid showing parsed rows, inline errors
   highlighted, fixable in place. Invalid rows blocked from submission.
5. **Cap check** — if rows exceed the seller's daily bulk cap, block with a clear
   message ("You can list 25/day at Silver. This file has 60 rows.").
6. **Submit** → all rows created as `pending_approval` (or `active` if tier
   auto-approves bulk), batched. Seller sees a summary: "48 submitted for review,
   12 had errors (download error report)."

Notes:
- No images in v1 of bulk (CSV can't carry files cleanly). Bulk listings can be
  published image-less to the queue and the seller adds images after approval,
  OR we require an image-URL column. **Decision needed at build time** — lean
  toward "image URL column, optional, validated."
- Reuses `react-image-crop`? No — bulk skips image tooling.

### 4.3 Duplicate listing — `/sell/new?from=<id>`

- From any of the seller's existing listings ("Duplicate" action in
  `/account/listings`), open the wizard pre-filled with everything except a few
  fields cleared (e.g. unique serials, stock reset to a default).
- Internally: load the source listing, hydrate the wizard's state from its
  `template_data` (keyed by attribute slug → map back to attribute ids), price,
  delivery settings. Seller tweaks and republishes.
- Still routes through the moderation gate on publish.

---

## 5. The premium-feel features

### 5.1 Live buyer-card preview

- A component that renders the **exact buyer-facing listing card** (reuse
  `src/components/listing-card.tsx`) from the wizard's in-progress state.
- Updates live as the seller types/selects. Shows title, main image, price,
  discount badge, delivery badge, key attributes.
- Desktop: docked right rail on Step 4. Mobile: a "Preview" toggle/sheet.
- Payoff: kills "why isn't my listing getting views" confusion; sellers
  self-correct thin titles and missing images.

### 5.2 Price guidance (completed-sales based)

Data path (grounded in the real `orders` shape):

```
orders (status = completed)
  → join listings on orders.listing_id
  → filter listings.game_id = X AND listings.category_id = Y
  → aggregate orders.unit_price
```

- Compute p25–p75 (interquartile) of `unit_price` for the same (game, category),
  optionally narrowed by a key attribute (e.g. rarity) when there's enough data.
- Show inline in Step 4 pricing: *"Similar Items in Adopt Me sold for
  **$4.20–$5.80** (last 30 days, 41 sales). Yours: $12 — priced high."*
- **Honesty rule:** always show the sample size and window. If fewer than N sales
  (say 5), show "Not enough sales data yet" rather than a misleading range.
- v1 uses completed sales only (per decision). If a category is too sparse, we
  show the no-data state — we do **not** silently fall back to asking prices
  (that was an explicit fork we chose against).
- Server action: `getPriceGuidance(gameId, categoryId, attrFilter?)` returning
  `{ low, high, sampleSize, windowDays }`.

---

## 6. Theming plan — adopt the lime design language

Extract from `homepage-redesign`, do **not** merge the whole branch.

1. **Tokens.** Pull the `--lime` CSS custom property (and any sibling accent
   tokens) from `homepage-redesign:src/app/globals.css` into this branch's
   `globals.css`. Verify exact hsl/hex values at extraction time.
2. **Accent swap.** Everywhere the sell wizard + admin currently use
   `violet-500` / `from-violet via-purple to-cyan`, replace with the lime accent
   system. Specifically:
   - Primary CTAs (Continue, Publish, Save) → lime.
   - Progress rail fill → lime gradient.
   - Active step label, selected-card rings → lime.
   - Keep neutral glass surfaces (white/[0.0x]) as-is; only the **accent** changes.
3. **Reference components.** Mirror the gradient/treatment patterns from
   `HeroCarousel`, `WhyCard`, `HowStep` so the sell page feels like the same
   product as the homepage.
4. **Scope.** One pass over: `SellWizard.tsx`, the `(sell)` layout, the admin
   `games-v2` / `categories-v2` / template builder, and the redesign hub.

**Risk:** the lime theme may still be evolving on `homepage-redesign`. We extract
a snapshot of the tokens; if they change later, it's a token-value update, not a
rewrite, because we'll have centralized them as CSS vars / Tailwind theme
extensions rather than hardcoding lime hex everywhere.

---

## 7. Data / schema additions (proposed, for build phase)

Nothing here is built yet — listing the deltas so we can review scope.

1. **`seller_tier_config`** (exists) — add columns: `bulk_daily_cap int`,
   `auto_approve_single bool`, `auto_approve_bulk bool`. Tunable caps without a
   deploy.
2. **`listings`** — add `source` enum (`'wizard' | 'bulk' | 'duplicate'`) for
   analytics and to drive different moderation defaults. Additive, nullable.
3. **Bulk batch tracking** — a lightweight `listing_import_batches` table
   (`id, seller_id, game_id, category_id, row_count, created_at`) so we can show
   "48 submitted, 12 errored" and rate-limit per day. Optional but recommended.
4. **No change** to the attribute schema — bulk CSV columns are *derived* from
   `attributes`, they don't need new storage.

RLS: bulk insert path must still enforce `seller_id = auth.uid()` and force
`status = 'pending_approval'` server-side (never trust a client-sent status for
bulk). The publish action owns the tier→status decision.

---

## 8. Phased build order (after this spec is approved)

- **Phase L — Theming.** Extract lime tokens, swap accents across sell + admin.
  Low risk, high visual payoff, unblocks everything looking consistent.
- **Phase D1 — Moderation gate + tier caps.** Extend `seller_tier_config`,
  wire the publish action to choose `active` vs `pending_approval` by tier +
  verification. Make the single-listing wizard honor it. (Foundation for bulk.)
- **Phase D2 — Price guidance.** `getPriceGuidance` server action + Step 4 inline
  UI + the no-data honest state.
- **Phase D3 — Live buyer-card preview.** Reuse `listing-card.tsx`, dock on
  Step 4.
- **Phase D4 — Duplicate listing.** `?from=<id>` hydration of the wizard.
- **Phase D5 — Bulk upload.** `/sell/bulk`, dynamic CSV template, client
  validation, review grid, cap check, batched `pending_approval` insert,
  error report.
- **Phase D6 (future, not committed) — AI screenshot→listing.** The wedge. Kept
  out of this scope deliberately; schema is already AI-ready.

The `/sell` hub (3 entry points) lands with D5 since it only makes sense once
bulk exists; until then `/sell/new` stays the direct entry.

---

## 9. Open questions to resolve at build time

1. **Bulk + images:** image-URL column (validated) vs. add-images-after-approval?
   Leaning toward optional image-URL column.
2. **Auto-approve threshold for platinum bulk:** what approval-rate history
   unlocks it (proposed 95%)? Needs a real number once we see moderation data.
3. **Price-guidance minimum sample size** before we show a range (proposed 5).
4. **Duplicate listing — which fields clear** on duplicate (serials, codes,
   stock)? Per-category or global rule?
5. **Theming:** confirm the exact lime token values at extraction (don't assume).
