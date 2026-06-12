# Sell Wizard — Restructure Spec

Authoritative pre-build spec for the 3-step sell wizard at `/sell/new`.
Companion to `HANDOFF_SELLER_EXPERIENCE_SPEC.md`. Every dimension, gap, and
color decision lives here so we don't loop on geometry during the build.

---

## 0. Decisions locked (from the Q&A)

| | |
|---|---|
| Step count | **3** (Category → Game → Details). Publish folds into Details. |
| Sequencing | Restructure first; D1 moderation gate after. |
| Surfaces | Page `bg-bg-base` → outer wizard card `bg-bg-raised` → sub-section cards `bg-bg-overlay`. Three-level depth, **no lime tint on surfaces**. |
| Dropdown | Radix UI Select via shadcn. Portaled; correct z-index; backdrop scrim. |

---

## 1. The 3 steps

### Step 1 — Category (existing, keep)
- 5 row-cards as today (Currency / Items / Accounts / Top Up / Boosting).
- After "Continue": Step 2.

### Step 2 — Game (existing, keep)
- Search + Popular/Recent tabs + tile grid as today.
- After picking a game (+ region/platform if required): Step 3.

### Step 3 — Details (NEW, replaces old Step 3 + Step 4)
- Single long page. All remaining content lives here. No more "Publish" tab.
- Three section blocks (see §3), submitted together via one **Publish** button at the bottom.

---

## 2. Layout — outer chrome (every step)

```
┌─ <main> container ─────────────────────────────────────────┐
│  px-3 sm:px-6, pt-4 sm:pt-6, pb-24                         │
│  max-w-4xl on sm, max-w-5xl on lg                          │
│                                                            │
│  ┌─ <nav> Breadcrumbs ──────────────────────────────────┐  │
│  │  text-xs text-text-tertiary, h-6                     │  │
│  │  "Home › Select category › Select game › Details"    │  │
│  │  Each completed crumb is a Link; current is plain.   │  │
│  │  Separator: › (text-text-disabled)                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                            ↓ mt-3                          │
│  ┌─ <section> Wizard card ─────────────────────────────┐  │
│  │  rounded-3xl                                         │  │
│  │  bg-bg-raised  border-border-default                 │  │
│  │  shadow-elevated                                     │  │
│  │  p-5 sm:p-7 lg:p-8                                   │  │
│  │                                                      │  │
│  │  [StepBar — 25/50/75/100% lime progress rail]        │  │
│  │  mb-6                                                │  │
│  │                                                      │  │
│  │  [Step header: title + sub-header]                   │  │
│  │  mb-6                                                │  │
│  │                                                      │  │
│  │  [Step body — Step 1 / 2 / 3 content]                │  │
│  │                                                      │  │
│  │  [Footer: Back ←     → Continue / Publish]           │  │
│  │  mt-8, border-t border-border-subtle, pt-6           │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Dimensions

- **Outer container**: `mx-auto w-full max-w-4xl lg:max-w-5xl px-3 sm:px-6 pt-4 sm:pt-6 pb-24`
- **Breadcrumb bar**: `h-6 text-xs leading-6`, items `gap-2` separated by `›` glyphs (`text-text-disabled mx-1`)
- **Wizard card**: `rounded-3xl bg-bg-raised border border-border-default shadow-elevated p-5 sm:p-7 lg:p-8`
- **Step bar**: full width of card content, see §4
- **Step header**: see §5
- **Footer**: `flex justify-between items-center mt-8 pt-6 border-t border-border-subtle`

### Tokens used (no lime on surfaces)

| Element | Token |
|---|---|
| Page bg | `--color-bg-base` (#0A0A0F) |
| Wizard card bg | `--color-bg-raised` (#121218) |
| Sub-section card bg | `--color-bg-overlay` (#1C1C25) |
| Inset (helper text strips) | `--color-bg-inset` (#0C0C12) |
| Border default | `--color-border-default` (rgba 10%) |
| Border subtle | `--color-border-subtle` (rgba 6%) |
| Primary text | `--color-text-primary` (#F3F3F6) |
| Secondary text | `--color-text-secondary` (#9EA0AB) |
| Tertiary (placeholders, labels) | `--color-text-tertiary` (#65666F) |
| Lime accent | only on: progress fill, primary CTAs, focused input border, selected-state checkmark |

---

## 3. Step 3 — Details body

Three section blocks, stacked, `space-y-5`. Each block is a sub-card:

```
┌─ Step header ──────────────────────────────────────────────┐
│  Title: "Sell Game Items"     text-2xl font-semibold       │
│         text-text-primary, text-center on sm+               │
│  Sub-header: [game-logo 28×28] [game-name text-sm           │
│              text-text-secondary], centered, mt-2           │
└────────────────────────────────────────────────────────────┘
                              ↓ space-y-5
┌─ Sub-card #1: Offer Details ───────────────────────────────┐
│  bg-bg-overlay rounded-2xl border-border-subtle p-5         │
│  ┌─ Card head ─────────────────────────────────────────┐   │
│  │  h-9 mb-4 flex items-center justify-between         │   │
│  │  "Offer Details" — text-sm font-semibold            │   │
│  │  (no right-side actions on this card)               │   │
│  └─────────────────────────────────────────────────────┘   │
│  Dynamic fields rendered from attribute_templates,         │
│  space-y-4. Each field renders per §6.                     │
└────────────────────────────────────────────────────────────┘
┌─ Sub-card #2: Offer Description ───────────────────────────┐
│  Same shell as #1                                          │
│  ┌─ Title field ───────────────────────────────────────┐   │
│  │  Label "Title" — text-xs uppercase tracking-wider   │   │
│  │  Input row + helper-strip below (see §7)            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─ Description field ─────────────────────────────────┐   │
│  ┌─ Photos field ──────────────────────────────────────┐   │
│  ┌─ Delivery method + window ──────────────────────────┐   │
│  ┌─ Price field (with fee preview) ────────────────────┐   │
│  ┌─ Stock + min qty (2-col) ───────────────────────────┐   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Sub-card shell

- `bg-bg-overlay rounded-2xl border border-border-subtle p-5`
- Card head: `flex items-center justify-between h-9 mb-4`
  - Title: `text-sm font-semibold text-text-primary` (sub-card name)
  - Optional right-side meta: small text-text-tertiary
- Body: `space-y-4` between fields

---

## 4. Step bar (unchanged from current, but slimmer)

Already rebuilt as a horizontal lime progress rail. Sticking with that.

- Container: `mb-6`
- Labels row: `grid grid-cols-3 gap-1 text-[10px] sm:text-[11px] mb-2.5` (now 3 cols, not 4)
- Each label: chip (h-4 w-4) + uppercase tracking-wider text
- Rail: `h-1.5 w-full overflow-hidden rounded-full bg-bg-overlay-2`
- Fill: `bg-lime`, animated width `33% / 67% / 100%` (steps 1/2/3)
- Active label: `text-lime-text`; done: `text-success`; future: `text-text-disabled`

---

## 5. Breadcrumbs

```
Home › Select category › Select Game › Details
```

- Component-wise: render an array; each crumb is either a clickable `Link` (resets the wizard to that step) or plain text (current step).
- Class: `inline-flex items-center gap-2 text-xs text-text-tertiary`
- Each link: `hover:text-text-secondary transition-colors`
- Current crumb: `text-text-primary`
- Separator: `›` rendered as `<span className="text-text-disabled">›</span>` between items
- Step 1: shows `Home › Select category`
- Step 2: shows `Home › Select category › Select game`
- Step 3: shows `Home › Select category › Select game › Details`

---

## 6. Form fields — uniform spec

Every field follows the same vertical rhythm, irrespective of type.

```
┌─ Field wrapper (mb-4 via parent space-y-4) ──────────────┐
│  Label row    text-xs uppercase tracking-wider           │
│               text-text-secondary, mb-1.5                │
│               • Label text                               │
│               • Required marker (text-error "*")          │
│               • Helper hint (optional) — text-[10px]      │
│                                                          │
│  Control      h-10, rounded-xl, border-border-default     │
│               bg-bg-inset (one shade darker than card     │
│               so it pops), px-3, text-sm                  │
│                                                          │
│  Helper strip (when present)                             │
│               mt-2, rounded-lg bg-bg-inset border-none    │
│               p-3, text-xs text-text-secondary            │
│               (matches your screenshot #3)               │
└──────────────────────────────────────────────────────────┘
```

### Control specs by type

| Type | Component | Notes |
|---|---|---|
| `text` | `<Input/>` (shadcn) | h-10, rounded-xl |
| `textarea` | `<Textarea/>` (shadcn) | rows={4}, auto-grow up to ~10 |
| `number` | `<Input type="number"/>` | h-10 |
| `select` (dropdown) | **Radix Select via shadcn** | see §8 |
| `multiselect` | Radix Select with `data-multi` + chip row above | chips removable |
| `boolean` | Two-button toggle, h-10, fills row | identical sizing to inputs |
| `image_select` | Grid of tiles, `grid-cols-3 sm:grid-cols-5 gap-2` | tile aspect-square w/ thumbnail |
| `price` | Input with `$` prefix slot and right-side `USD` suffix slot | h-10 |
| `quantity` | Input flanked by `−` and `+` buttons (h-10 w-10) | matches your screenshot #3 |
| `images` | Upload tile + thumbnail row | h-32 dashed border tile + h-20 thumbs |

### Sizing rules
- **Every text-like control is `h-10`** so columns align.
- All inputs use `rounded-xl border border-border-default bg-bg-inset px-3 text-sm placeholder:text-text-tertiary`.
- Focused state: `focus:border-lime focus:ring-2 focus:ring-lime-tint-bg outline-none`.
- Error state (future): `border-error ring-error-bg`.

---

## 7. Helper-text strip (the boxed seller hints from your screenshot)

Pattern: every field that benefits from a hint gets a strip BELOW the control, not beside the label.

- `mt-2 rounded-lg bg-bg-inset px-3 py-2 text-xs leading-5 text-text-secondary`
- No icon, no border, just a one-shade-darker tinted box. Tight to the input.
- Examples (per your screenshots):
  - Title: "Give your item a descriptive title. What would buyers search for to find your item? Add the most searchable words at the front of your title. Titles have a 160 character limit."
  - Photos: "We recommend that your images be at least 800 pixels square."
  - Description: optional
  - Price: "Competitive prices improve your offer's ranking in the offer list."
  - Delivery: "Faster delivery time improves your offer's ranking in the offer list."

The hints are admin-authored where they exist on `attributes.help_text`, otherwise our wired-in defaults for the standard fields (title/photos/description/price/delivery/stock).

---

## 8. Dropdown — the bug fix

### The current bug
Hand-rolled dropdown panel is `absolute` inside its parent. When the panel is taller than the gap to the next field, it visually overlaps the field below, looking like a glitched page.

### The fix
Use **Radix Select** (`@radix-ui/react-select`) wrapped in shadcn's `Select` primitive. Radix:
- Portals the content to `document.body` so it's never trapped inside an `overflow-hidden` parent
- Auto-positions (top/bottom) based on viewport room
- Renders a backdrop-clickable overlay that closes on outside click
- Handles focus trap, keyboard nav (Arrow/Enter/Esc), and screen reader semantics
- Z-index defaults to 50 — sits above everything in the wizard card

### Visual spec (shadcn shell, GV tokens applied)

```
Trigger (closed):
  h-10 w-full rounded-xl border border-border-default
  bg-bg-inset px-3 text-sm text-text-primary
  flex items-center justify-between
  hover:border-border-strong
  focus:border-lime focus:ring-2 focus:ring-lime-tint-bg
  [chevron-down 16px text-text-tertiary]

Trigger (open):
  border-lime ring-2 ring-lime-tint-bg
  [chevron-up 16px]

Content (portaled panel):
  z-50 min-w-[trigger-width] max-h-72
  rounded-xl border border-border-default
  bg-bg-overlay shadow-elevated
  p-1 overflow-y-auto
  animate-in fade-in-0 zoom-in-95 (Radix data-states)

Search input (when options > 6):
  sticky top-0 in panel
  h-9 mb-1 px-2 border-b border-border-subtle
  bg-bg-overlay text-sm

Item:
  flex items-center gap-2 h-9 px-2 rounded-md
  text-sm text-text-secondary cursor-pointer
  hover:bg-state-hover hover:text-text-primary
  data-[state=checked]:bg-state-selected
  data-[state=checked]:text-text-primary
  data-[state=checked]:[svg]:visible
  [optional icon slot] [label flex-1] [check icon 14px text-lime-text invisible]

Empty state:
  px-3 py-2 text-xs text-text-tertiary
  "No matches"
```

### Installation
```
npm install @radix-ui/react-select
```
Then the shadcn `Select` component pattern (we can either use the official shadcn add-on file or write our own thin wrapper).

### Multi-select consideration
Radix Select is single-select by default. For `multiselect` attribute type we keep our existing custom pill-row (it's the right pattern for short option lists). If a multiselect ever has > 8 options, we revisit with a checkbox-based Radix Popover.

---

## 9. Footer — Back / Continue / Publish

Single row at the bottom of the wizard card:

```
┌─ Footer ───────────────────────────────────────────────────┐
│  mt-8 pt-6 border-t border-border-subtle                    │
│  flex items-center justify-between gap-2                    │
│                                                             │
│  [Back ←]                       [Save draft] [→ Publish]    │
│   (step 1 hides; spacer)        (step 3 shows both)        │
└─────────────────────────────────────────────────────────────┘
```

- Back button: `h-10 rounded-xl border border-border-default bg-bg-inset px-3 sm:px-4 text-sm text-text-secondary hover:bg-bg-raised-hover`
  - Hidden on step 1 (rendered as `<span aria-hidden/>` spacer to keep Continue right-aligned)
- Continue (steps 1, 2): `h-10 rounded-xl bg-lime text-text-inverse font-semibold px-4 sm:px-5 hover:bg-lime-hover shadow-elevated`
  - Disabled style: `bg-bg-inset text-text-disabled cursor-not-allowed`
- Step 3 has **two buttons**:
  - "Save draft" — secondary: `h-10 rounded-xl border border-border-default bg-bg-inset px-3 text-sm text-text-secondary hover:bg-bg-raised-hover`
  - "Publish" — primary: same lime spec as Continue, plus a Sparkles icon

---

## 10. Sticky publish bar (mobile consideration)

On viewports `< sm`, the footer becomes a **sticky bottom bar** so the seller doesn't have to scroll all the way down to publish:

```
fixed bottom-0 inset-x-0 z-40
border-t border-border-subtle bg-bg-raised/95 backdrop-blur
px-3 py-3 flex items-center justify-between gap-2
```

On ≥ sm, the inline footer pattern is fine (the user can see the whole flow).

---

## 11. Browser primitives I'll add (npm install list)

- `@radix-ui/react-select` — proper dropdown
- shadcn's `Select`, `Label`, `Textarea` components — these wrap Radix and consume the GV tokens via the existing shadcn-compat shim

Nothing else new. We already have `framer-motion`, `react-image-crop`, `@dnd-kit/*`, `lucide-react`.

---

## 12. Build order (sequence I'll follow)

Each is one commit. Each ends with `tsc clean` + browser smoke.

1. **Install `@radix-ui/react-select`** + add the shadcn Select wrapper at `src/components/ui/select.tsx` (or confirm one already exists). Verify it imports and renders in isolation.
2. **Restructure STEPS array to 3 steps** in `SellWizard.tsx`. Update the progress rail math from `step/4` to `step/3`. Drop the old Step 4 jsx. Move all Publish-step state and handlers down into Step 3.
3. **Build the new outer chrome:** breadcrumbs row, wizard card wrapper (`bg-bg-raised rounded-3xl`), step header (title + game sub-header). Audit the existing Step 1 and Step 2 to make sure they render fine inside the new chrome (they should — they're already sub-content).
4. **Build the new Step 3 (Details) body** — two sub-cards (Offer Details + Offer Description). Move every field currently on Step 3 + Step 4 into the right sub-card with the new uniform field spec.
5. **Replace every existing dropdown** (`Dropdown` component) with the Radix Select wrapper. Verify no overlap, proper z-index, proper close-on-outside.
6. **Apply helper-text strips** to title / description / photos / price / delivery / stock (the standard fields), and to any dynamic attribute that has `help_text` set.
7. **Footer + sticky-mobile bar.** Final tsc + smoke.

After this restructure ships, we return to **Phase D1** (moderation gate + tier caps) on a now-correct shape.

---

## 13. Risk + escape hatches

- **If Radix Select doesn't theme cleanly** with our token aliases, fallback is to write a tiny custom Popover-based dropdown using `@radix-ui/react-popover` (already a transitive dep of dialog) which gives portal+positioning without the full Select API.
- **If users land on `/sell/new` mid-form during the migration** (have step=4 saved in URL or local state), redirect them to step 3 automatically — `step = Math.min(step, 3)` on mount.
- The old draft listings table doesn't change — `status='draft'` still works for the new combined Publish.

---

## 14. What this spec does NOT cover (intentionally)

- The buyer-side card preview (Phase D3) — that's a later phase and will dock to the right of Step 3 when it lands.
- Price guidance (Phase D2) — appears inline in the Price field, also later.
- Bulk / duplicate flows (Phase D4/D5) — separate routes.
- Moderation gate copy ("Goes live instantly" vs "Submitted for review") — lands in Phase D1, will sit just above the Publish button in the footer.

---

End of spec. Anything we'd need to revisit is parked here, not in code.
