# Sell Wizard — Design Decisions Log

Authoritative record of every UX / visual decision made for `/sell/new`
through Phase R12. Reference this BEFORE making any wizard change so we
don't relitigate settled calls.

Cross-references:
- `HANDOFF_SELL_WIZARD_RESTRUCTURE.md` — the original pre-build spec from R2.
- `HANDOFF_SELLER_EXPERIENCE_SPEC.md` — the broader seller experience scope.

---

## R0 — Universal rules (apply to every component touched in this scope)

1. **Tokens, not raw colors.** Inputs use `bg-transparent` over the parent
   sub-card surface (`bg-bg-overlay`). Borders use `border-border-default` /
   `border-border-strong`. Lime accent via `bg-lime`, `border-lime`,
   `text-lime-text`, `bg-lime-tint-bg`, `border-lime-tint-border`. Never use
   raw `violet-*`, `purple-*`, `cyan-*` etc.

2. **Responsiveness is mandatory.** Every layout decision must include
   breakpoints for at minimum `(< sm)`, `sm` (640px), and `lg` (1024px).
   - Sub-card padding: `p-4 sm:p-5`.
   - Grid columns: explicit breakpoints (e.g. `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
   - Text sizes: smaller on mobile, larger on desktop (e.g. `text-sm sm:text-base`).
   - Container widths: `max-w-4xl lg:max-w-5xl`.

3. **No hand-rolled UI when a primitive exists.** Use the shadcn / Radix
   primitives in `src/components/ui/`. If something's missing, ADD a
   primitive — don't inline a one-off.

4. **A11y is non-optional.** Form controls must have associated labels,
   `aria-label`s, focus rings, keyboard navigation, and screen reader
   semantics. Use Radix primitives where possible; they handle this.

---

## R1 — Surfaces (the three-level depth rule)

| Layer | Token | Where it shows up |
|---|---|---|
| Page background | `bg-bg-base` (#0A0A0F) | the `(sell)/layout.tsx` page bg |
| Wizard card | `bg-bg-raised` (#121218) | the outer `<section>` shell with `rounded-3xl border-border-default shadow-elevated` |
| Sub-card | `bg-bg-overlay` (#1C1C25) | each section card inside Step 3 (`<SubCard/>`) |
| Inputs | `bg-transparent` | text/textarea/select/number inputs — share the sub-card surface, border defines the field |

Why transparent inputs: avoids the "black on grey" double-surface look. The
border is the field. Focused border turns lime, soft halo via
`focus:ring-2 focus:ring-lime-tint-bg`. R12 decision.

---

## R2 — Shape

- Wizard card: `rounded-3xl` (24px) — distinctly soft, signals "this is a page-level container."
- Sub-cards: `rounded-2xl` (16px) — softer than the chrome inside.
- Tiles (category, game): `rounded-xl` (Step 1 R13), `rounded-xl` (Step 2).
- Buttons (primary CTA + footer): `rounded-xl` (12px) — pill-ish but not capsules.
- Step chips (top of the card): `rounded-xl`.
- Inputs (text, textarea, select trigger, number-field wrapper): ~~`rounded-none`~~ → **`rounded-md` (6px)**. Sharp 90° corners felt severe. R14 reverts R12.
- Checkboxes: `rounded-md` (kept slightly rounded so the affirmative state reads as a soft tick, not a sharp square).

---

## R3 — Step navigation (the StepBar)

- Three clickable text labels across the top of the card: Category / Game / Details.
- ~~Pill chrome (bordered box around each label).~~ **Dropped in R13.**
- Each step is now a plain text label with a leading number badge (active = lime filled circle, completed = success-green filled circle with check, future = outlined empty circle).
- Active state: lime text only — no enclosing box.
- Completed state: secondary text + subtle `hover:bg-bg-raised-hover` so the click affordance is hover-only, not always-visible chrome.
- Future state: dimmed, no hover.
- Below the labels: a horizontal lime progress rail filling 33/67/100% (thinner — `h-1` not `h-1.5`).
- Breadcrumbs are **removed entirely**. The label row is the only step navigation.

---

## R4 — Top spacing (the navbar-to-modal gap)

Single constant in the wizard component:
```
const WIZARD_TOP_OFFSET = 128
```

- `<main>` has `pt-24 sm:pt-28 lg:pt-32` so first paint already shows the right gap.
- A scroll-to-top effect runs on mount (instant) and on every step change (smooth). It lands the wizard card's top at `WIZARD_TOP_OFFSET` from the viewport top.
- Same effect, same offset, no special-casing of the first paint anymore. R12 decision — earlier versions skipped the first paint and the navbar gap was inconsistent.

---

## R5 — Step 1 (Category) layout

- **Heading**: centered, with a leading lime-tint circle icon (`ShoppingBag` on Step 1, `Gamepad2` on Step 2). Text: "Choose a category" / "Choose a game". R13.
- **Tiles**: compact horizontal row cards, NOT large square tiles. R13 revision of R12.
- Layout: flex-wrap with `justify-center`, `basis-full sm:basis-[calc(50%-0.3125rem)] lg:basis-[calc(33.333%-0.4167rem)]`, gap `2.5`, container `max-w-3xl`. R14 — orphan card on the final row centers instead of leaning left, which the previous `grid-cols-3` layout did with the 5-category set.
- Each tile: `rounded-xl`, `p-3 sm:p-3.5`, `bg-bg-overlay` with a category-tinted icon plate. Horizontal flex: [icon plate] [title + 1-line description] [trailing chevron/check].
- Icon plate: 40×40 (sm: 44×44) `rounded-lg` with a gradient tint matching the category, Lucide icon centered.
- Category color theme (defined in `CATEGORY_THEME` constant):

| Category | Icon | Gradient hue |
|---|---|---|
| Currency | `Coins` | amber → yellow → orange |
| Items | `Backpack` | rose → pink → red |
| Accounts | `UserSquare2` | sky → blue → indigo |
| Top Up | `Zap` | yellow → amber → yellow |
| Boosting | `Trophy` | violet → purple → fuchsia |

- Trailing indicator: 24×24 circle, arrow when not selected, lime check when selected. No bordered "chip" — the icon alone signals state.
- Disabled categories (Boosting at launch): `opacity-50` + small inline `"Soon"` warning badge next to the title.
- The decorative top-right gradient blob from R12 is gone — the compact layout doesn't need it.

---

## R6 — Step 2 (Game) layout

- Search bar at the top.
- Popular / Recent tab switcher.
- Game grid: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8`. Up to 8 tiles per row on wide screens.
- Each game tile: aspect-square, `rounded-xl`, gradient/cover image + name overlay.
- Selecting a tile auto-advances to Step 3 unless the (game, category) pair requires a region or platform, in which case those pickers render inline and the user uses Continue.

---

## R7 — Step 3 (Details) layout

- Up to six stacked sub-cards (Offer Details, Title, Description, Photos, Pricing, Stock, Delivery, Confirm) with `space-y-5` between.
- Offer Details sub-card is **hidden entirely** when the admin has no template for the (game, category) pair. R8/R10.
- Each sub-card:
  - Title row: `text-base font-bold text-text-primary` with a `border-b border-border-subtle pb-3 sm:pb-4` divider beneath. R9.
  - Body: `space-y-4` for top-level field rows; `space-y-3` for nested rows.

---

## R8 — Form field structure (the FieldRow + FieldHint pattern)

```
<FieldRow>
  <label class="text-xs uppercase tracking-wider text-text-secondary">Field name</label>
  <input class={inputCls} />
  <FieldHint>Short hint text below the input</FieldHint>
</FieldRow>
```

- `FieldRow` = `space-y-2` wrapper, matches what shadcn's `FormItem` provides.
- Labels: `text-xs font-semibold uppercase tracking-wider text-text-secondary`.
- Inputs: see `inputCls` constant in `SellWizard.tsx`.
- Hints: ~~no surface~~ → small contained box (`rounded-md border-border-subtle bg-bg-inset px-2.5 py-1.5 text-[11px] text-text-tertiary`). R14 reverses R7. Floating bare text felt out of place; a soft inset surface anchors the helper to the input it belongs to.
- Hints are skipped for choice-typed fields (select, multiselect, image_select, boolean) — the placeholder/value already conveys intent. R10 decision.

### Required-field error state (R14)

- Every required input tracks `touched` (becomes `true` on first blur).
- When `touched && empty`, the input gets `aria-invalid="true"` and its border + ring turn red (`border-error`, `ring-error-bg`). The corresponding `<FieldHint/>` is replaced by `<FieldError/>` ("This field is required.").
- `<FieldError/>` mirrors `<FieldHint/>`'s box shape but uses `border-error/40 bg-error-bg text-error` so the layout doesn't jump when error replaces hint.
- The `Combobox` primitive accepts `invalid` and `onBlur` props; the trigger borders/rings turn red when `invalid && !open`.
- Title minimum-character requirement: **dropped**. Only emptiness blocks publish. R14 (was R8 / 5-char minimum).

---

## R9 — Nested sub-field treatment

When a field has children that appear based on its choice:

- The children render with `border-l-2 border-lime-tint-border pl-4`.
- Above the children: a tiny eyebrow line — `"PARENT FIELD: chosen value"` where the field name is dim and the chosen value is lime.
- No chip / pill. The left rail + eyebrow IS the visual cue. R10 decision (the "because you chose X" chip was too plain).

---

## R10 — Dropdowns / select-typed fields

- Use `<Combobox/>` (Radix Popover + cmdk) — NOT `<Select/>`.
- Trigger looks like an input. Click → panel opens with a search input auto-focused at the top of the panel.
- Options sorted alphabetically by label by default.
- Search filter respects label + keywords.
- Items show a thumbnail when `icon_url` is set. Selected item shows a lime check at the right.

R10 decision: the original shadcn Select required clicking to open the panel and then there was no way to search; the Combobox is the modern combobox/typeahead pattern.

---

## R11 — Stock / quantity inputs

Use `<NumberField/>` (react-aria-components) — NOT `<input type="number">`.

- Layout: `[−] [number box] [+]`.
- Long-press repeat, full keyboard nav, locale-aware formatting all free.

---

## R12 — Delivery sub-card

- Two cards: Stock (qty + min qty), Delivery (method + window).
- Delivery method tiles: bigger touch targets, two-column grid (`grid-cols-1 sm:grid-cols-2`).
- Delivery window: pill grid `grid-cols-3 sm:grid-cols-6`, each pill `h-10`.
- Hint text has bumped contrast (`text-text-secondary` not `text-text-tertiary` inside the method tiles).

---

## R13 — Terms acceptance

- Sub-card at the very end, before the footer.
- Two `<Checkbox/>` rows (Radix Checkbox, themed lime). Each row labelled with a link to the relevant page.
- `canPublish` gated on both being checked. The "Create Offer" button (renamed from "Publish") stays disabled until then.

---

## R14 — Footer / Create Offer button

- Mobile (< sm): `fixed inset-x-0 bottom-0 z-40` sticky bar with backdrop blur.
- Desktop (sm+): inline at the bottom of the wizard card with a `border-t border-border-subtle` separator.
- Buttons (in order):
  1. **Back** (left). Hidden on step 1.
  2. **Create Offer** (right, primary). Disabled until `canPublish` is true. R14 dropped Save draft — the wizard always publishes; drafts are out of scope until Phase D.
- The Create Offer button: `h-11 sm:h-12`, `px-6 sm:px-8`, `font-bold uppercase tracking-wider`, **no leading icon**. Designed to read as the unambiguous next action.

---

## R15 — Step transitions

- Browser back gesture walks step 3 → 2 → 1 → previous page. `history.pushState` on every step change, `popstate` listener calls `setStep` accordingly. R11.c.
- Scroll-to-top on every step change (smooth) AND initial mount (instant). R12.
- Step 2 → 3 happens automatically on game tile click (no Continue needed) unless region/platform required. R8.

---

## R16 — Animations

- Step transition: `AnimatePresence mode="wait"`, vertical slide-in 12px → 0, exit 0 → -8px, duration 0.22s.
- Sub-field reveal (when a parent choice changes): `AnimatePresence` with height + opacity tween, duration 0.22s.
- Tile entry on Step 1 / Step 2: staggered `delay: i * 0.04`.

---

## R17 — Data path & known constraints

- The wizard reads from the **new schema** (`global_categories`, `game_categories`, `attribute_templates`, `attributes`, `attribute_options`, `attribute_conditional_rules`).
- It writes to the **legacy `listings` table** so existing marketplace browse/detail pages keep working.
- `listings.description` is NOT NULL — the publish action sends `''` not `null` when the seller left it blank. R12 decision.
- `listings.category_id` references the **legacy `categories` table** (game-scoped, not global). The publish action calls `ensureLegacyCategoryRow` from `_category-bridge.ts` to find or create the matching legacy row for the (game_id, global_slug) pair. R11.a.
- Admin's `upsertGameCategory` keeps the legacy table in sync when toggling pairs ON/OFF. R11.a.

---

## R18 — The "no patches, real fixes" rule

When fixing bugs:
- Find the root cause, not the symptom.
- If two callers need the same logic, extract a shared helper module (e.g. `_category-bridge.ts`).
- If the data layer is wrong, fix the data layer. Don't try-catch around it.
- If a primitive is missing, add it to `src/components/ui/` and use it everywhere — don't write three different one-offs.

---

## Phase history (commits)

- **R1** — Radix Select primitive
- **R2** — collapse from 4 steps to 3
- **R3** — outer chrome (breadcrumbs, wizard card, step header)
- **R4** — Step 3 split into two sub-cards
- **R5** — replace custom Dropdown with Radix Select
- **R6** — helper text + sticky mobile publish bar
- **R7** — five sub-cards on Step 3, shadcn Form primitives, minimal hints
- **R8** — clickable step chips, auto-advance Step 2, NumberField stepper, terms gate, rename Publish → Create Offer
- **R9** — sub-card title + divider, less-round inputs, top spacing, softer step chips
- **R10** — Combobox primitive, sub-field left rail, scroll-on-mount fix, Step 1 compression
- **R11.a** — fix publish error (auto-create legacy categories row)
- **R11.b** — game tiles 8/row
- **R11.c** — browser back walks wizard steps
- **R12** — null fix, transparent square inputs, uniform top spacing, Step 1 tile revamp, this doc
- **R13** — StepBar pill chrome dropped (plain text labels), centred Step 1/2 headings with leading lime icon, compact horizontal category tiles
- **R14** — required-field touched error state, inputs back to `rounded-md`, hints in soft inset boxes, Save draft removed, Create Offer beefed up and icon dropped, title min-char rule dropped, category grid balanced via flex-wrap + center
- **R15** — Category tile subtext switched from DB description (long + truncated + dim) to short concrete examples authored in `CATEGORY_THEME.example`, color bumped from `text-text-tertiary` to `text-text-secondary`

---

## How to use this document

1. Before adding a wizard feature: read the relevant R-section. If the
   feature contradicts a decision, escalate — don't silently override.
2. When making a change, add a brief R-entry to this doc in the same
   commit. Future contributors should be able to read the doc top-to-bottom
   and understand the current state without reading every PR.
3. If you're rewriting an R-section, mark the old version with a strikethrough
   and add the new version below. Decisions are historical record.
