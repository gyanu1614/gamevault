# Values catalogue pipeline, one price rule, data-led sell pages: design

Date: 2026-10-21 · Owner-approved in chat (daily schedule, auto-add, no $1 floor, sell-page plan).

## Why

- **SAB** has added no brainrot since 2026-07-23. Nothing automated inserts into `sab_brainrots`.
- **Adopt Me**'s weekly job scrapes adoptmevalues.app, whose terms ban scraping. It hides new pets under $1, rewrites existing rows, and timed out on 2026-10-17.
- **MM2** imports new items only from wiki categories, so it misses pages that are not categorised yet. The Halloween 2026 Embergun is one example.
- **Steal an Egg** has never been scheduled.
- No values job posts to Discord or records its runs. A pipeline that silently stops is found by a human weeks later.
- **Price display** differs by game:
  - AM needs a 200-character description before a pet gets a page; 281 pets have none.
  - MM2 gives a page only to priced, top-tier items.
  - Only AM falls back to trade value.
- **Sell pages:** all 243 `/[game]/sell` pages are one template with the name swapped. They had 0 Google impressions in the 4 weeks to 2026-10-19.

## Decisions

1. **One pipeline, one adapter per game.**
   - The shared core does every step. An adapter only knows its wiki and how to read one page.
   - Adding a game = an adapter file, a registry line, a fixture test.
   - This mirrors `PRICING_GAMES` (`src/lib/pricing/registry.ts`).
2. **Source = each game's Fandom wiki** through the MediaWiki API: CC BY-SA, 1 request a second, UA `DropMarketBot/1.0`. adoptmevalues.app is retired.
3. **Daily, auto-apply, insert-only.**
   - When nothing is new, the job makes no writes, so it costs the same as weekly.
   - Existing rows are never updated or deleted by the pipeline.
4. **No price floor.** Every item is added and gets a page. Search indexing is decided by the gate, never by 404.
5. **One headline rule for every game:** On DropMarket (our live listing) → Market price → Value → "New, no trades yet".
6. **Sell pages are data-led.**
   - Sections render only when their data exists.
   - Item rows read "Bat Dragon · Sells For $X" with the item's image. No fee is shown.
   - The rows come from the one query the page already makes.

## Architecture

```
scripts/catalogue.mjs  (tsx CLI, GitHub runner)
  └─ src/lib/catalogue/run.ts        orchestrator, all I/O injected
       ├─ wiki.ts       MediaWiki client: paced, retried, timed out, batches of 50
       ├─ plan.ts       pure: candidates, adopt vs insert, guard verdicts
       ├─ store.ts      catalogue_refs + catalogue_runs (service role)
       ├─ images.ts     wiki file → 512 px WebP → game bucket
       ├─ notify.ts     Discord text (pure) + post
       └─ registry.ts → games/<game>.ts adapters
```

**Boundaries**
- Core files never import an adapter; only `registry.ts` does. Adapters never import each other.
- Catalogue modules use relative imports, not `@/`, so tsx scripts and vitest load them the same way.

**Adapter contract** (`types.ts`)
- `key`, `gameSlug`, `label` ("brainrots"), `wiki` (host).
- `listQueries`: categorymembers or embeddedin queries whose union is every item page.
- `parse(page) → ParsedItem | null`: pure. `null` means the page is not an item (galleries, stickers, maps).
- `loadKnown(db) → { slug, name, pageId? }[]`: our current items, one read.
- `insert(db, items, images) → string[]`: inserted slugs. Insert-only: on conflict, do nothing.
- `missingImages(db) → { slug, imageFile }[]`: pipeline-added rows still without an image.
- `insertCap?` (default 50).

**ParsedItem** fields: `pageId`, `revisionId`, `wikiTitle`, `slug`, `name`, `rarity`, `imageFile`, `releasedAt`, `origin`, `howToGet`, plus `extra` for game-specific fields such as income and cost.

## Data model (one migration, service-role only, RLS on, no policies)

- **`catalogue_refs`**: every wiki page the pipeline has decided about.
  - Primary key: `(game_slug, page_id)`.
  - Columns: `wiki_title`, `item_slug` (null when ignored), `status` (`item|ignored`), `first_seen_at`, `checked_at`.
  - About 2,800 rows across 4 games.
  - Purpose: page ids survive renames, and pages we have seen are never re-fetched.
- **`catalogue_runs`**: one row per game per run.
  - Columns: `game_slug`, `started_at`, `finished_at`, `trigger` (`schedule|manual`), `status` (`ok|nothing_new|blocked|failed`), `listed`, `candidates`, `adopted`, `added_slugs text[]`, `ignored`, `images_fixed`, `message`, `details jsonb`.
  - Indexed on `(game_slug, started_at desc)`. Rows older than 180 days are pruned by the run.

## Run flow (per game)

1. **List:** the union of `listQueries` and the wiki's `recentchanges` new pages from the last 3 days, which catches uncategorised new pages. This gives `pageId → title`.
2. **Candidates:**
   - pages not in `catalogue_refs`;
   - plus `ignored` refs first seen in the last 14 days. A stub page can gain its infobox later, so these are re-checked.
3. **Fetch** candidate content, 50 pages per request. **Parse** each page.
4. **Plan** (pure):
   - A parsed item whose slug or normalised name we already hold is **adopted**: a ref is written, nothing is inserted. This is also how the first run backfills refs for existing items.
   - Everything else is **new**.
5. **Guards** (pure):
   - parse exceptions over 20% of candidates (and at least 3) → `blocked`, because the wiki format probably changed;
   - new items over `insertCap` → `blocked`.
   - A blocked run writes nothing except its run row and an alert.
   - `--allow-large` (manual only) lifts the cap.
6. **Write:**
   - copy images, then insert items;
   - retry `missingImages`;
   - upsert refs for adopted, new and ignored pages.
7. **Refresh:** `POST /api/internal/values-revalidate?game=` with `changedSlugs`. Evidence refresh then sends the new URLs to IndexNow through `seo_url_events`.
8. **Record and announce:**
   - insert the run row;
   - post to Discord (`DISCORD_OPS_WEBHOOK_URL`) when items were added or a run was blocked or failed;
   - stay silent when nothing was new.

**Cost per game per day**
- Wiki: 2–8 requests, plus 1 per 50 new pages.
- Database: 2 small reads (refs, known items), writes only for new rows, 1 run row.
- Vercel: revalidation of the new slugs and the list.

## Isolation and failure handling

- **Workflow** `values-catalogue-daily.yml`: a matrix with one job per game, `fail-fast: false`, 20 minutes each.
  - A step with `if: failure() || cancelled()` posts the game and run link to Discord.
  - The job is light, so it stays off the DB-heavy list. Cron is 13:05 UTC; GitHub starts schedules 5–7 h late.
- **Guard test:** workflow matrix keys = registry keys, and every adapter has a fixture test with saved wiki pages.
- **Duplicate protection:**
  - refs primary key;
  - each table's unique slug key;
  - inserts that do nothing on conflict.
- **Health watchdog** (later step): one daily check per hub game, covering:
  - a catalogue run within 48 h;
  - prices updated within 48 h;
  - a non-empty `rows.json`.
  - Any failure → Discord. This covers the SAB freshness check's job for every game.

## Per-game adapters

| Game | List | Parse | Insert |
|---|---|---|---|
| steal-a-brainrot | embeddedin `Template:Brainrot Infobox` | infobox (rarity, cost, income) + `src/lib/sab/wiki-facts.ts` | `sab_brainrots`, source fields as in the July import, `image_path=<slug>.webp` in `sab-brainrots`, `image_status='approved'`, `needs_review=false` |
| murder-mystery-2 | Category:Weapons + Pets | `src/lib/values/catalogue/mm2-wiki.ts` | `values_items` (as the `--new-only` importer), then the images path |
| steal-an-egg | Category:Pets | `{{Detail}}`, as in `seed-steal-an-egg.mjs` | `values_items` |
| adopt-me | Category:Pets | `src/lib/adopt-me/wiki-facts.ts` | `adopt_me_pets` + 8 `adopt_me_pet_values` rows |

## Later steps (each has its own plan and PR)

- **Price, page and Google rule.**
  - One headline helper, used by the item hero, list cards and sell pages.
  - Every catalogue item gets a page: AM drops the description gate; MM2 drops the priced and top-tier gate.
  - Indexed when priced, or when new (under 30 days) with How To Get and a release date. Otherwise noindex until data arrives.
  - The sitemap follows the same verdict.
- **Sell pages:**
  - Values games: Top Items ("X · Sells For $Y" with image), New This Week, search, FAQs built from data.
  - Listing games: offers per category with "From $X".
  - Category-only games: live player stats from `game_metrics_daily`, what you can sell, a first-seller pitch, per-game FAQs.
  - Nothing unique → noindex, after checking Bing referrals first.
  - Also fixes the split headings.
- **Admin Values tab:** a conditional tab in `GameDetailTabs` plus a row button.
  - A stat strip: items, new this week, no price, no image, no How To Get, last run, last price update.
  - An items table with filters (50 per page).
  - Recent runs.

## Testing

- **Pure units:** plan, guards, notify text, adapter `parse` against saved wiki fixtures.
- **Integration (local stack):** the run against a fake wiki inserts, adopts, ignores, blocks over the cap, and a second run is a no-op. Cleanup goes through the fixture namespace.
- **Guards:** workflow matrix = registry; table posture (new tables default-deny).
- **Manual:**
  - a dry run against prod (read-only) prints the plan;
  - the first prod write goes per game, with the owner's yes;
  - then Discord, the admin page and the live pages are checked.
