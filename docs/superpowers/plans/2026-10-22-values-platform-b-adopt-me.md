# Values Platform, Step B: Adopt Me on the Wiki — Implementation Plan

> Executed inline (superpowers:executing-plans). `- [ ]` steps.

**Goal:** New Adopt Me pets come from adoptme.fandom.com through the daily catalogue job, with How To Get, release date, origin, availability and a picture from day one. adoptmevalues.app is no longer scraped. Its weekly job stops rewriting existing pets (it reset `name`, `rarity`, `demand_trend` and `is_active`).

**Architecture:** One more adapter, `games/adopt-me.ts`.
- **Parse:** `{{Pets}}` infobox plus `src/lib/adopt-me/wiki-facts.ts` `buildAdoptMeFacts` (the parser that already fed `am:facts:import`).
- **Insert:** `adopt_me_pets`, plus the 8 empty form rows in `adopt_me_pet_values` (variant set `N, F, R, FR, NEON, NFR, MEGA, MFR`; row shape as in `import-adoptmevalues.mjs` `buildVariantRows`).
- **Picture:** `adopt-me-pets/wiki/<slug>.webp`, the path `adopt-me-wiki-images.mjs` uses.
- **Shared helper:** `firstImageFile` moves from the SAB adapter to `src/lib/catalogue/files.ts`, so adapters never import each other.
- **Weekly job:** `adopt-me-weekly-catalog.yml` keeps only the weekly picture check (`adoptme:images --write`). Dry run, collect and import are removed.

## Rules
- **Pet pages:** a `{{Pets}}` infobox and a known rarity (Common, Uncommon, Rare, Ultra-Rare, Legendary → `common` … `ultra_rare` … `legendary`).
  - Skip upcoming pets: rarity `TBA`, or the lead says "is an upcoming". They are re-read when the page is edited on release day.
  - Skip subpages.
- **Name:** the page title without " (Pet)". **Slug:** `slugifyTitle(name)`.
- **Availability** (CHECK: obtainable, limited, unobtainable) from the How To Get status:
  - obtainable → obtainable
  - seasonal → limited
  - unobtainable → unobtainable
  - unknown or none → obtainable (the old importer's default)
- **Insert-only:** `onConflict: 'slug'`, `ignoreDuplicates`. Form rows only for pets actually inserted. `is_active: true`. `description` stays null; the page rule comes in step D.
- **Picture retry** (pets added by this pipeline in the last 30 days, image_url null): read the page by `name`, then by `name (Pet)`, take the `{{Pets}}` image and copy it.

## Tasks
- [ ] **B1.** Move `firstImageFile` to `catalogue/files.ts` (SAB re-exports it; its tests stay green).
- [ ] **B2.** Tests from fixtures `am-pages.json` (Shoebill, Frost Dragon, Count Slothula (Pet) upcoming, Pets overview, Jungle Egg), then `parseAmPage`:
  - Shoebill → `uncommon`, origin Basic Egg / event, a How To Get, picture `Shoebill.png`, availability `limited` (wiki: Limited / Halloween 2026).
  - Frost Dragon → `legendary`, `unobtainable`.
  - Count Slothula → null (upcoming).
  - Pets overview → null.
  - Jungle Egg → null.
- [ ] **B3.** `loadKnown` / `insert` / `fixMissingImages`, with an integration test in a new guard file (pet + 8 forms; insert-only: a second run changes nothing; the retry fills a picture). Cleanup by fixture key: `adopt_me_pet_values` cascade, or delete by pet ids first.
- [ ] **B4.** Registry `adopt-me` and matrix key.
  - Weekly workflow → picture check only.
  - Guards: `adopt-me-weekly-new-pets.test.ts` now pins that the weekly job only repairs pictures and that the daily matrix has adopt-me; db-heavy minutes follow the job's timeout.
  - Remove the now-unused `adoptme:catalog` and `adoptme:catalog:dryrun` scripts only if nothing else references them; otherwise leave them unscheduled and documented.
- [ ] **B5.** Verify (unit now; integration and dry run in the step-A batch): `pnpm catalogue --game=adopt-me --env=local`.
