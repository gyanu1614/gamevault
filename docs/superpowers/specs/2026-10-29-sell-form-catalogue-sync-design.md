# Sell form ↔ values catalogue sync (MM2 first): design

Date: 2026-10-29 · Owner-approved in chat ("yes mm2 first", plus: admin edits must not break future adds, a removed-then-re-added filter must re-link its listings, and the sell form must open faster).

## Why

- Migration `20261009024923_sell_forms_value_games` copied MM2 `values_items` into the sell form **once**. The daily catalogue job (13:05 UTC) adds items to `values_items` only, so every later item is missing from the form.
- On 2026-10-13 a hand-made form was built on top in the admin template builder:
  - Item Type options were changed to `knives / guns / pets / effects / powers / emotes / radios / miscellaneous`.
  - Rarity fields were added per type: `rarity-2` for knives, `rarity` for guns, `rarity-3` for pets.
  - Name lists were added per rarity: `knife-name…-6` and `gun-name…-5`, with 2 to 19 options each.
- The copied lists (`select-knife` 628, `select-gun` 355, `select-pet` 84) still show only when Item Type = `knife` / `gun` / `pet`. Those values no longer exist, so the lists never appear.
- Live data, 2026-10-29:
  - 1,102 enabled MM2 items and 1,067 copied options. 35 items, including the Halloween Ember set, can't be picked.
  - 12 items have no rarity (Gingerscythe, Icecrusher, Reaver, …).
  - 7 active MM2 listings. 2 use the hand-made fields, which are not in `PIPELINE_IDENTITY_KEYS`, so they carry no value link.

## Decisions

1. **The catalogue is the master. The form's item part is derived from it.**
   - One reconcile step builds the item part of a game's items form from `values_items`: Item Type → Rarity → Item.
   - It runs after every daily catalogue run, even when the run found nothing new, so drift heals within a day.
   - It can also run on demand.
2. **Shape: one chain, one rule per child.** This is the owner's shape and it matches how the wizard and the buyer filters nest children.
   - `item-type`, the existing field. Options are adopted: `knives`, `guns` and `pets` map to catalogue types knife, gun and pet. Effects, Powers, Emotes, Radios and Miscellaneous stay manual.
   - `rarity-<type>` (e.g. `rarity-gun`) is shown when Item Type = that type. Its options are the rarities that type really has, in the game's order.
   - `<type>-<rarity>` (e.g. `gun-ancient`) is shown when `rarity-<type>` = that rarity. Its options are the catalogue items, A–Z, with value = slug = `values_items.slug`, then "Other" last.
   - Items with no rarity go under a rarity option **Other**, so they stay sellable. The run report lists them so the data gets fixed. Once fixed, the item and its listings move to the right list automatically (decision 5).
   - All managed fields are `facet_indexed` (buyer filters) and required.
3. **Managed rows are marked, not hidden.**
   - Every option the sync owns carries `metadata.catalogue = { node, key }`, e.g. `{ node: 'gun-ancient', key: 'emberbow' }`.
   - A field is "ours" when its slug is the canonical slug for a node, or when it holds options marked for that node. The marker survives an admin renaming the field.
   - The sync only ever touches marked or canonical rows. Unmarked admin fields and options are never changed or deleted.
4. **Admin edits are safe:**
   - **Admin adds an option to a managed list.**
     - If its value or normalised label matches a catalogue item, the sync adopts it: it marks the option and keeps its value, so no duplicate appears.
     - If it matches nothing, it stays as a manual option until the catalogue gains that item. Then it is adopted the same way.
   - **Admin deletes a managed option or field, or a rule.** The sync restores it with the same slug and value. Listings keep their stored `template_data[slug] = value`, so they match again without any listing write.
   - **Admin renames a managed field's key, changes its type, or moves an option.** The builder refuses slug and type changes on managed fields, with the reason shown. A rename done outside the builder (SQL) is undone by the sync, and the listing repair (decision 5) re-points listings.
   - **To take an item out of the form**, disable it in the catalogue (`values_items.is_enabled = false`). The sync then hides it. Hidden options stay so old listings still render.
5. **Listing repair: a listing's filter answers follow its item.**
   - A listing linked to a catalogue item (`listings.value_item_slug`) gets its managed answers recomputed from the item: Item Type, `rarity-<type>`, `<type>-<rarity>`.
   - When the stored answers differ, the sync rewrites only those keys, re-links the value, and refreshes the category pages.
   - This covers options moved by mistake, the old hand-made keys, and rarity fixes.
   - Statuses repaired: draft, active, paused, pending_approval, changes_requested, suspended. These are the same set `choice-usage` counts.
6. **Never deletes, guarded writes.**
   - The sync inserts, updates labels, sort order and rules, and hides.
   - A run that would add more than 300 options or repair more than 50 listings stops and posts to Discord, unless it is run with `--allow-large`. The first MM2 cutover is run this way, owner-approved.
7. **Writes run inside Next.**
   - Repairs must call `revalidateListingSurfaces` and `linkListingsToValueItems`, and form changes must refresh the sell template and filter caches. So the write step is a signed internal route, `/api/internal/sell-form/sync`, using `authorizeInternalRequest`.
   - The catalogue job calls this route after its run.
   - A tsx CLI does dry runs (pure plan + read-only client) and prints the diff.
8. **Filters refresh when the form changes.**
   - Today an admin template edit refreshes only the sell form. The market page's filter options stay cached for up to 24h.
   - Both the builder and the sync now revalidate the game's category surfaces and a per-template tag on the cached form read.

## One-time MM2 cutover (owner-approved dry run first)

1. Dry run against prod (read-only) prints the full diff: new fields, options, rules, and listing repairs.
2. Write run: build the managed chain, adopt Item Type, and repair all 7 listings onto the new keys.
3. Retire the superseded fields: `select-knife/gun/pet`, `rarity`, `rarity-2`, `rarity-3`, `knife-name*` and `gun-name*`. A field is deleted only once `choice-usage` reports no listing uses it. It is a separate, explicit cutover step, never part of the daily sync.

## Sell form speed

The list size is not the main cost: dropdowns already render at most 100 rows, and the template comes from a cached GET route. The cost is chained round trips plus animation.

| # | Cost today | Fix |
|---|---|---|
| S1 | Each wizard server action (policy, games list, fee preview, price hint) is a POST to `/sell/*`. Middleware runs `auth.getUser` and then the `sell_access_kind` RPC before the action starts. Next 14 queues actions one after another. | Skip only the RPC for `POST` + `Next-Action` requests, keeping `getUser` (it rotates the cookies). Every mutating action already re-checks `sellAccessKind` (`sell-wizard.ts:609,858,1127,1280`), and RLS plus the listings trigger enforce it again. |
| S2 | The edit page makes 7 calls in a row before any HTML. It loads the full games list (3 calls in a row), which edit never uses because the game is fixed. | Build the selected game from a join on the listing read. No games list on edit. Run `getUser` and the listing read in parallel; ownership is still checked. |
| S3 | The games list per category and `global_categories` are read fresh on every request. | `unstable_cache` with tags. Busted by the admin game, category and template actions. |
| S4 | `AnimatePresence mode="wait"` holds Details back for the 260 ms exit, then a 260 ms enter, then 180 ms field fades. | Overlap the exit and enter instead of waiting, and shorten the field fade. The motion stays, the wait goes. |
| S5 | `/sell/new?game=&category=` fetches games again on the client, and restoring a draft chains policy → games → template after hydration. | Seed the games and template as initial data, the way the edit prefill already does. |
| S6 | Edit mode rebuilds a Set over about 1,100 option values on every keystroke (`useOfferForm` initialiser isn't lazy). The four MUI icons pull MUI and Emotion into the route. | Lazy initialiser. Swap the icons for lucide equivalents. |

Measured before and after on a local production build with the live MM2 form loaded: calls on the critical path, template bytes, route JS, and time from click to usable form.

Not done here (noted): the template wire format (tuples without UUIDs), and moving the fee preview onto the server.

## Testing

- Pure planner unit tests (`plan.test.ts`): new item, new rarity, admin-added option adopted (by value and by label), admin-deleted option, field and rule restored, renamed field re-slugged, hidden on disable, no-rarity bucket, unmarked rows untouched, caps.
- Listing repair unit tests: moved option, old key, rarity change, unlinked listing untouched.
- Integration guard on the local stack with a copy of the live MM2 form: the sync makes every enabled item reachable through Type → Rarity → Item. A second run is a no-op, and deleting a managed option then re-running restores it with listings matching again.
- Builder guard: slug and type change on a managed field is refused.
