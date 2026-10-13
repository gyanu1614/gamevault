# Item Fields: Admin Builder Rebuild + Fast Offer Details

Date: 2026-10-12 · Branch: `feat/buy-rails` (own commit, owner's call) · Status: awaiting owner OK

## Why

- The admin template builder (`/admin/games/[id]/templates/[categorySlug]`) is hard to follow: a left tree whose ≡ icons look like drag handles but are the Dropdown type icon, a separate right panel, every choice of every level open at once (200 knife names per rarity).
- `/sell/new` shows choices A→Z, not the order set in admin (`combobox.tsx:129` sorts unless `unsorted`; `FieldInput.tsx:146` never passes it; the edit page shares the bug).
- Offer Details takes 0.5–1.5 s to appear after the game pick: 7–8 sequential round trips per load, no caching, `select('*')` (~450 KB for ~1,000 options), and an 800-row unvirtualised list.
- The builder page is slow and can lose choices: `loadBuilderState` reads every option of every game with no filter (`admin-template-builder.ts:171`), capped at 1,000 rows.

## Not changing

- The database. `attributes` + `attribute_options` (`sort_order`) + `attribute_conditional_rules` already store a tree. No migration.
- Buyer filters (they already keep admin order).
- "Hide a choice instead of delete": needs a real column, so it waits for a later PR.

## Part 1 — Offer Details loads fast

1. **One cached read.** New `src/lib/sell/template-read.ts` (`server-only`): `getSellTemplate(gameCategoryId)`.
   - Uses `unstable_cache` with key `['sell-template', id]`, tags `sell-template` and `sell-template:<id>`, and a 1 h TTL as a backstop.
   - Reads untagged through `createAnonClient` (a tagged fetch inside `unstable_cache` leaks tags in Next 14.2).
   - Selects only the columns it needs. Options: `id, attribute_id, value, label, icon_url, sort_order, metadata`. Attributes: no SEO or description columns.
   - Orders by `(attribute_id, sort_order, id)` so the existing index serves it, and pages past 1,000 rows.
2. **No re-resolving.** The wizard already holds `game.game_category_id`; pass it in. This drops the two category lookups and the cookie client. The swallowed `error`s become real errors.
3. **Served by a GET route, cached on the client.**
   - `/api/sell/template/[gameCategoryId]` returns the cached read with `Cache-Control: s-maxage=30, stale-while-revalidate=60` (a save clears the server cache at once, not edge copies). It sits outside the `/sell` auth middleware.
   - Rationale: a server action queues behind the fee preview and price hint actions, and pays the middleware `getUser` + `sell_access_kind` cost on every call.
   - The client reads it with React Query (provider already mounted), key `['sell-template', id]`, staleTime Infinity. Going back, and switching A→B→A, become instant.
4. **Prefetch.** On step 2, prefetch the template for each Recent chip and for the highlighted or hovered game. On the `?game=&category=` start path, load it in `page.tsx` and seed the query.
5. **Admin saves refresh it.** Every write in `admin-template-builder.ts` calls `revalidateTag('sell-template:<id>')` next to its existing `revalidatePath`. The prefill (`wizard-prefill.ts:45`), the items page taxonomy (`_itemsData.ts:76`) and the importer read through the same function.
6. **Safe publish.** `canPublish` waits for the template. Today a slow load lets a seller publish with empty fields (`offer-rules.ts:33`).
7. **No wasted renders.**
   - Memoise the options map in `FieldInput`.
   - `React.memo` FieldCard and FieldInput, with a stable `onFieldChange`.
   - Drop framer `layout` on FieldCard; it forced a reflow on every keystroke.
8. **Skeleton.** The "Loading details…" spinner becomes a skeleton the size of the real fields (label + 48 px box), so nothing jumps.
9. **One visibility rule.** Keep `attribute-tree.ts` `isVisible`; delete the copies in `new-schema.ts:371` and `sell-wizard.ts:502`. Split the 1,300-line `sell-wizard.ts` into `sell-reads.ts` and `sell-writes.ts`.

Target: Offer Details usable in under ~100 ms on a warm cache, and payload down 4–5x.

## Part 2 — The field itself (seller form)

- **Search inside the field.** Clicking Item Type turns the box into a text input in place: caret blinking, "Item Type" as the placeholder. Typing filters.
  - The list opens attached under the box: shared border, the box's bottom corners go square, no gap, no second search bar.
  - Enter picks, Esc closes, and arrow keys move the highlight.
- **Order = admin order.** FieldInput and Step2Game pass `unsorted`. Other callers keep today's A→Z (phone codes, founding, bulk upload, browse).
- **Big lists stay quick.** Combobox filters itself over precomputed lowercase keys with `useDeferredValue` and renders at most 100 matches. If more match, a muted last row reads "Keep typing to see more".
- **Phones.** The bottom sheet stays, with its own search at the top so the keyboard does not push the list away. The same rules apply.
- **Calm layout (Eldorado image 3).**
  - Remove the "Item Type: Pets" line and the divider (`Step3Details.tsx:104`).
  - Each field is label above, box below, 20 px between fields. A sub-field appears below its parent with the same spacing: no indent, no tinted strip.
- **Opt-out.** A `searchable` prop (default on) is turned off for short lists: the browse sort, bundles.

## Part 3 — Admin builder as Finder columns

### Desktop (≥1024 px)

```
Fields        │ Item Type              │ Rarity · for Knives    │ Knife Name · for Uncommon
 Item Type  › │ ⠿ Knives      Rarity › │ ⠿ Common   Knife Name › │ [+ Add choice] Paste · A–Z
 Trait        │ ⠿ Guns        Rarity › │ ⠿ Uncommon Knife Name › │ ⠿ Cane 2018
 + Add field  │ ⠿ Pets      + Add field│ ⠿ Rare     + Add field  │ ⠿ Silent Night …
```

- **Column 1 — Fields.** Lists the template's top-level fields (Item Type, Trait), with drag to reorder and "+ Add field".
- **Each choice column belongs to one field.**
  - Header: the field name, type and Required, plus a ⚙ button that opens Field Settings (name, type, required, placeholder, help text, slug, filter on/off, show rules) in a side sheet.
  - Under the header: the add box, plus Paste List and Sort A–Z.
  - Then the choices, each with a ⠿ drag handle (dnd-kit), inline label edit, an icon, delete, and on the right what opens next ("Rarity ›") or "+ Add field".
- **Opening the next column.**
  - Clicking a choice opens the field shown for it in the next column.
  - If a choice shows two fields (e.g. Pets → Pet Name and Trait), the column header gets a small two-tab switcher.
  - A choice with no field yet shows an empty column: "Nothing shown for Pets yet" and a Create Field form (name + type).
- **Navigation.**
  - Columns scroll on their own, and the strip scrolls sideways when deeper than four.
  - The path is a breadcrumb at the top (Item Type › Knives › Rarity › Uncommon).
  - Arrow keys move between rows and columns.
- **Preview.** A Preview button opens a sheet with the real seller fields (the same FieldInput), so admin sees exactly what sellers see, in the same order.

### Phone

- One column at a time. Tapping a choice slides in the next column (iOS Settings style), with a back arrow and the breadcrumb.
- Field Settings opens as a bottom sheet (Vaul). Drag handles work with touch.
- Inputs are 16 px so iOS does not zoom.

### Fixes inside

- **Load less.** `loadBuilderState` reads only this template's options (`.in('attribute_id', ids)`, paged).
- **Order everywhere.**
  - New choices and new sub-fields get `max(sort_order)+1`, computed on the server, so there are no ties.
  - Field drag wires the unused `reorderAttributes`.
  - Paste keeps the pasted order. Sort A–Z writes that order once, and is offered only on demand.

### Code shape

- `TemplateBuilder.tsx` (1,743 lines) becomes `_components/template-builder/`, each file ≤ ~300 lines:
  - `builder-model.ts`: pure. It derives columns from the attributes + rules and computes next `sort_order`.
  - `FinderView.tsx`, `FieldColumn.tsx`, `ChoiceRow.tsx`, `AddChoiceBar.tsx`, `FieldSettingsSheet.tsx`, `RulesEditor.tsx`, `PhoneDrill.tsx`, `PreviewSheet.tsx`, `useBuilder.ts`
- Server actions stay in `admin-template-builder.ts` (each one gains the tag revalidation).

## Testing

- **Unit:**
  - `builder-model` (columns from rules; multi-field choices; next sort_order; reorder payloads)
  - the combobox filter + 100 cap
  - the template mapper (column trim, order kept)
  - `canPublish` waits for the template
- **Integration (local stack, fixture namespace, full cleanup):**
  - `getSellTemplate` returns options past 1,000 rows, in `sort_order`
  - `loadBuilderState` returns only this template's options
  - `createOption` after a delete never duplicates `sort_order`
  - admin writes revalidate the template tag (mocked `next/cache`)
- **Browser (localhost, desktop + 390 px):**
  - build MM2 Knives › Uncommon › names in the Finder
  - reorder, then confirm `/sell/new` shows the same order
  - time Offer Details before and after (network panel)
- **Guards:** public-route-caching (the GET route is an API route, not a page), grants posture (no new SQL functions).

## Order of work

1. Part 1 + Part 2 (seller side, measurable win, and they unblock checking order).
2. Part 3 (admin Finder).
3. Then the queue: footer three columns in one row on phones, blog phone fixes.
