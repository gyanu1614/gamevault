# Values Platform, Step A: MM2 + Steal an Egg Auto-Add — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** The daily catalogue job adds new Murder Mystery 2 items and Steal an Egg pets from their wikis the way it already does for Steal a Brainrot. Each new item gets its own How To Get. The 9 missing Halloween 2026 items arrive once the wiki gives them an infobox.

**Architecture:** Two new adapters behind the existing `CatalogueAdapter` contract (`src/lib/catalogue/games/`). Three small core additions:
1. a 30-day look-back on a game's first run, so pages created before the job existed are still found;
2. an `enrich` hook that runs after the guards, for wiki reads that only new items need (MM2 gamepass and event costs);
3. `fixMissingImages` receives the wiki client, because generic `values_items` rows store no image file name.

MM2 parsing reuses `buildMm2Catalogue` (`src/lib/values/catalogue/mm2-wiki.ts`). How To Get is generated from the structured `obtain` data by a new pure module. The old weekly MM2 job is retired.

**Spec:** `docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md` (adapter table, run flow).

## Global Constraints
- **Insert-only.** Existing `values_items` rows are never changed, except images on rows this pipeline added in the last 30 days.
- **Imports.** Relative imports only in `src/lib/catalogue/**` and `src/lib/values/catalogue/**` (tsx CLI). Tests may use `@/`.
- **Wiki etiquette.** About 1 request per second, batches of 50. The enrich step reads at most 10 extra pages per run.
- **Steal an Egg pets.**
  - Insert pets only, as `kind='pet'` with `is_priced=false`, exactly like `scripts/seed-steal-an-egg.mjs`.
  - Link a pet to an egg only when that egg already exists. Never create egg or area rows from wiki text: the wiki has junk like `egg_name=VOIDSEER`.
- **Images.**
  - MM2: `values-items/murder-mystery-2/<slug>.webp`, with `image_url` = storage public URL.
  - Attribution: `Image: Murder Mystery 2 Wiki (Fandom), CC-BY-SA 3.0 — <File page URL>`, matching `import-mm2-wiki-catalogue.mjs`.
- **Tests.** Local stack only. Integration rows use the file's fixture namespace and are cleaned up.

## File Structure
| File | Change |
|---|---|
| `src/lib/catalogue/types.ts` | `enrich?`, `fixMissingImages(db, images, wiki)` |
| `src/lib/catalogue/plan.ts` | `BOOTSTRAP_WINDOW_DAYS = 30` |
| `src/lib/catalogue/run.ts` | refs loaded before recent changes; the window depends on refs; enrich; wiki passed to fixMissingImages |
| `src/lib/values/catalogue/mm2-how-to-get.ts` (new) | pure obtain → How To Get |
| `src/lib/catalogue/games/murder-mystery-2.ts` (new) | MM2 adapter |
| `src/lib/catalogue/games/steal-an-egg.ts` (new) | SaE adapter |
| `src/lib/catalogue/games/values-items.ts` (new) | shared `values_items` helpers: game id, known items, next sort order, insert-only upsert |
| tests next to each, plus fixtures `mm2-pages.json` and `sae-pages.json` | |
| `src/lib/catalogue/registry.ts`, workflow matrix | + `murder-mystery-2`, `steal-an-egg` |
| `.github/workflows/adopt-me-weekly-catalog.yml` | remove the `mm2-catalog` job |
| `src/test/routes/adopt-me-weekly-new-pets.test.ts`, `src/test/routes/db-heavy-schedule.test.ts` | follow the retirement |
| `scripts/values-seeds/murder-mystery-2.how-to-get.json` | curated entries for the Halloween 2026 items already in prod |

---

### Task A1: Core — first-run look-back, enrich hook, wiki for image retry
- [ ] Test (`run.test.ts`): a game with no refs asks `recentChanges` for 30 days; with refs, 3 days. `enrich` runs only on items being inserted, after the guards, and its result is what gets inserted. `fixMissingImages` receives the wiki.
- [ ] Implement:
  - `BOOTSTRAP_WINDOW_DAYS = 30` in plan.ts.
  - run.ts loads refs, then `recentChanges(new Date(now - (refs.size ? RECENT : BOOTSTRAP) days))`.
  - After `guardRun` passes: `const toInsert = adapter.enrich ? await adapter.enrich(plan.insert, deps.wiki, ctx) : plan.insert`. Use it for the dry-run report and for the insert.
  - `fixMissingImages(deps.db, deps.images, deps.wiki)`.
  - Types: `enrich?(items: ParsedItem[], wiki: WikiClient, ctx: ParseContext): Promise<ParsedItem[]>` and `fixMissingImages?(db: Db, images: ImageStore, wiki: WikiClient): Promise<string[]>`.
- [ ] All catalogue tests pass → commit.

### Task A2: `mm2HowToGet(item, pageUrl, checkedAt)`
- [ ] Tests:
  - A box source gives "Unboxed from the 2026 Halloween Box.", costs "600 Candies or 1 Halloween Key" and odds "0.2%". The year is not repeated when the name has it.
  - A pass gives "Reward of the Halloween Event 2026 (Tier Reward)."
  - A gamepass gives "Comes with the Elite Gamepass." with costs "499 Robux".
  - Crafting, code and shop sentences.
  - An extra source adds "Also from X and Y.".
  - Status follows `still_obtainable`.
  - Released reads "2026 (Halloween Event 2026)".
  - Key order is status, method, costs, odds, released, sources, confidence, checked_at.
  - Returns null when there is no usable source.
- [ ] Implement in `src/lib/values/catalogue/mm2-how-to-get.ts` (pure; types from `./mm2-wiki`, `StoredHowToGet` from `../../catalogue/types`).
- [ ] Commit.

### Task A3: MM2 adapter — parse (fixtures)
- [ ] Tests (`games/murder-mystery-2.test.ts`, fixtures `mm2-pages.json`):
  - The Emberbow page gives slug `emberbow`, rarity Ancient, itemType gun, a How To Get, and image file `Emberbow.png`.
  - Chroma Emberbow gives rarity Chroma with `extra.baseTitle = 'Emberbow'`.
  - The blank Embergun page and the box page give null.
  - Box odds come in through `prepare`'s boxes (`parseBoxPage`).
  - `listQueries` = Category:Weapons + Category:Pets.
- [ ] Implement:
  - `parse(page, ctx)` → `buildMm2Catalogue([{ title, wikitext: content }], ctx.boxes).items[0]` → ParsedItem.
    - `releasedAt: null`; the year goes in `extra.releaseYear`.
    - `extra = { itemType, isChroma, baseTitle, displayTitle, releaseYear, obtain }`.
    - `howToGet = mm2HowToGet(...)`.
  - `prepare` lists Category:Boxes, fetches those pages and parses the boxes.
  - `enrich`:
    1. For gamepass or pass sources with no cost, fetch up to 10 source pages by title.
    2. Apply the costs: `parseRobuxPrice` for a gamepass, `parseEventPassCost` for a pass.
    3. Recompute How To Get.
- [ ] Commit.

### Task A4: shared `values_items` helpers + MM2 DB methods + integration test
- [ ] `games/values-items.ts`:
  - `gameIdBySlug(db, slug)`
  - `loadValuesKnown(db, gameId)` → `{ slug, name, pageId: null }[]`, paged
  - `nextSortOrder(db, gameId)`
  - `insertValuesItems(db, rows)`: upsert `onConflict: 'game_id,slug'`, `ignoreDuplicates: true`, `.select('id,slug')`
- [ ] MM2 `insert`:
  1. Copy each image to `values-items/murder-mystery-2/<slug>.webp`. `image_url = db.storage.from('values-items').getPublicUrl(path).data.publicUrl`; attribution as in the Global Constraints.
  2. Rows: `kind:'item'`, item_type, slug, name, rarity, release_year, origin, obtain, wiki_title, how_to_get, image_url, image_attribution, `is_priced:true`, `is_enabled:true`, `sort_order` appended.
  3. After the insert, link chroma → base. Find the base slug among existing plus new rows: `slugifyTitle(baseTitle)` first, then the typed form `${baseTitle} (${Type})`. Update `base_item_id` only on rows inserted in this run.
- [ ] MM2 `fixMissingImages(db, images, wiki)`: rows of this game with `image_url is null`, `wiki_title not null` and created in the last 30 days (limit 10). Fetch each page by its `wiki_title` (`wikitext`), `parseImageFile` the infobox, copy, then update image_url and attribution.
- [ ] Integration (`src/test/guards/catalogue-values-items.guard.integration.test.ts`): on a throwaway game (`guard-test-<key>…` slug):
  - insert-only (a second insert returns nothing and does not rewrite);
  - chroma → base linked;
  - sort_order appended;
  - fixMissingImages updates only a recent pipeline row;
  - cleanup of games and values_items by fixture key.
- [ ] Commit.

### Task A5: Steal an Egg adapter
- [ ] Tests (fixture `sae-pages.json`):
  - Voidseer Pumpkin gives name "Voidseer Pumpkin" (page title, not the all-caps `pet_name`), slug `voidseer-pumpkin`, rarity Divine, income 12,500,000,000, and area "Abandoned manor (Haloween dimension)". A biome containing "egg" is dropped.
  - An empty `{{Detail}}` (Werewolf) gives null.
  - A page without `{{Detail}}` gives null.
- [ ] Insert:
  - pets (`kind:'pet'`, rarity, area, income_per_sec, `is_priced:false`, appended sort_order, image when the page names one);
  - `source_item_id` links to an EXISTING egg whose comparable name equals `egg_name` or `egg_name + ' egg'`; no egg is created.
- [ ] Integration test cases in the same values-items guard file.
- [ ] Commit.

### Task A6: Registry, workflow, retire the weekly MM2 job
- [ ] Registry: `{ key: 'murder-mystery-2', name: 'Murder Mystery 2', adapter: murderMystery2 }` and `{ key: 'steal-an-egg', name: 'Steal an Egg', adapter: stealAnEgg }`. Matrix `game: [sab, murder-mystery-2, steal-an-egg]`.
- [ ] Delete the `mm2-catalog` job from `adopt-me-weekly-catalog.yml`.
  - Update `adopt-me-weekly-new-pets.test.ts`: the MM2 block now asserts the weekly file has no MM2 job, and the daily catalogue matrix includes `murder-mystery-2`.
  - Update `db-heavy-schedule.test.ts`: the weekly minutes become 60.
- [ ] Guard tests pass → commit.

### Task A7: Curated How To Get for the Halloween 2026 items already in prod
- [ ] Add entries to `murder-mystery-2.how-to-get.json` for emberbow, chroma-emberbow, emberscythe, chroma-emberscythe, embersickle, mortal and immortal.
  - Source: the events seed (`halloween-2026`) and the wiki event page.
  - Status `seasonal`, with a note "Halloween 2026 event, live until Nov 16, 2026", `confidence: 'high'` and `checked_at: 2026-10-22`.
- [ ] `pnpm values:mm2:how-to-get` (dry run, validation only) passes.
- [ ] Commit. The owner later runs `--write --env=prod --yes`.

### Task A8: Verify
- [ ] Type-check, ESLint on the changed files, and the catalogue + guard unit tests.
- [ ] Integration tests on the local stack (`pnpm db:up` + `pnpm test:reset` + MM2 seed `pnpm values:mm2:catalogue --write --env=local`).
- [ ] Local dry runs against the real wikis:
  - `pnpm catalogue --game=murder-mystery-2 --env=local` adopts about 1,070 and shows a short new list (Chroma Embersickle, Blue Emberbow …). It must not be blocked unless more than 50 are new; with `--allow-large` locally it must make sense.
  - `pnpm catalogue --game=steal-an-egg --env=local` (the local DB has no SaE items, so it is blocked over the cap, which is expected).
