/**
 * Adopt Me catalog + trade-value collector — adoptmevalues.app
 * ============================================================================
 * Mirrors the SAB collector pattern (scripts/collect-*-sab-*.mjs): fetch a
 * public source, parse it, write a normalized JSON feed to data/, and (with
 * --send) hand it to the importer. Scrape is SEPARATE from the DB write so a
 * bad parse never corrupts the catalog.
 *
 * WHAT THIS SOURCE GIVES US
 *   - The pet CATALOG: name, slug, rarity, image (all public facts)
 *   - The TRADE-VALUE axis: community consensus points
 *   - Only 3 of 8 variants are published: Default(N), Neon(NEON), Mega(MEGA).
 *     The other 5 (F,R,FR,NFR,MFR) are DERIVED downstream from the potion
 *     ladder and flagged is_estimated — this collector does NOT invent them.
 *
 * WHAT IT DOES NOT GIVE US
 *   - USD cash values. Those come from marketplace collectors (Eldorado,
 *     gameboost, u7buy) in a later pass. This feed's cash side stays null.
 *
 * POLITE BY DEFAULT: one request at a time, real delay between requests, a
 * normal browser UA. Tune with --delay-ms. Enrichment (per-pet pages) is
 * opt-in via --enrich because it's one extra request per pet.
 *
 * PAGINATION: the list is /values (page 1, 60 cards + "Load More") then
 * /values/page/2 … /values/page/N (14 pages / 791 pets on 2026-10-04). The
 * collector walks pages until one has zero cards (hard cap --max-pages, 30).
 * Parsing lives in scripts/lib/adoptmevalues-catalog.mjs (shared with the
 * catalog dry run).
 *
 * Usage:
 *   node scripts/collect-adoptmevalues.mjs              # every list page → JSON
 *   node scripts/collect-adoptmevalues.mjs --enrich     # + per-pet obtainability/demand
 *   node scripts/collect-adoptmevalues.mjs --enrich --send   # + seed the DB
 *   node scripts/collect-adoptmevalues.mjs --limit 10   # first 10 pets (testing)
 *   node scripts/collect-adoptmevalues.mjs --enrich --enrich-offset 0 --enrich-limit 200
 *   node scripts/collect-adoptmevalues.mjs --send --qualifying data/adopt-me-catalog-dryrun/<date>.json
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import {
  ADOPTMEVALUES_BASE_URL as BASE_URL,
  DEFAULT_MAX_LIST_PAGES,
  fetchCatalogPages,
  fetchText,
  parsePetPage,
} from './lib/adoptmevalues-catalog.mjs'

const DEFAULT_OUTPUT = 'data/adopt-me-feeds/adoptmevalues-latest.json'
const COLLECTOR_VERSION = 2 // 2 = every list page, not just page 1

// --- args -------------------------------------------------------------------
function parseArgs(argv) {
  const o = {
    enrich: false,
    send: false,
    delayMs: Number(process.env.ADOPTME_DELAY_MS ?? 1500),
    limit: Number(process.env.ADOPTME_LIMIT ?? 0), // 0 = all found
    maxPages: Number(process.env.ADOPTME_MAX_PAGES ?? DEFAULT_MAX_LIST_PAGES),
    // Enrichment batching: one request per pet, so a full 791-pet pass is
    // ~20 min. --enrich-offset/--enrich-limit split it; --enrich-slugs targets.
    enrichOffset: 0,
    enrichLimit: 0, // 0 = every pet from the offset
    enrichSlugs: null,
    // Passed through to the importer on --send (see import-adoptmevalues.mjs).
    qualifying: null,
    allowNew: false,
    outputPath: DEFAULT_OUTPUT,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--enrich') o.enrich = true
    else if (a === '--send') o.send = true
    else if (a === '--delay-ms') o.delayMs = Number(argv[++i])
    else if (a === '--limit') o.limit = Number(argv[++i])
    else if (a === '--max-pages') o.maxPages = Number(argv[++i])
    else if (a === '--enrich-offset') o.enrichOffset = Number(argv[++i])
    else if (a === '--enrich-limit') o.enrichLimit = Number(argv[++i])
    else if (a === '--enrich-slugs') o.enrichSlugs = argv[++i].split(',').map((s) => s.trim())
    else if (a === '--qualifying') o.qualifying = argv[++i]
    else if (a === '--allow-new') o.allowNew = true
    else if (a === '--output') o.outputPath = argv[++i]
  }
  // Politeness floor.
  o.delayMs = Math.max(1000, o.delayMs)
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Slugs that qualify in a dry-run report (adoptme-catalog-dryrun.mjs). */
async function qualifyingSlugs(reportPath) {
  const report = JSON.parse(await readFile(resolve(process.cwd(), reportPath), 'utf8'))
  return new Set((report.pets ?? []).filter((p) => p.qualifies).map((p) => p.slug))
}

// --- main -------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log('Adopt Me catalog collector (adoptmevalues.app)')
  console.log(
    `  enrich=${opts.enrich} send=${opts.send} delay=${opts.delayMs}ms ` +
      `maxPages=${opts.maxPages} limit=${opts.limit || 'all'}\n`,
  )

  // Every list page: /values, /values/page/2 … until a page has zero cards.
  const catalog = await fetchCatalogPages({
    maxPages: opts.maxPages,
    delayMs: opts.delayMs,
    log: (m) => console.log(m),
  })
  let pets = catalog.pets
  console.log(`Parsed ${pets.length} pets from ${catalog.pages} list pages (stopped: ${catalog.stoppedBy}).`)
  if (catalog.stoppedBy === 'max-pages') {
    console.log(`  ⚠️  hit the ${opts.maxPages}-page ceiling before an empty page — raise --max-pages if the catalog grew.`)
  }

  // Unknown rarity: never guess one. Log every card by name (it used to vanish
  // silently) and keep them out of the feed.
  const dropped = pets.filter((p) => !p.rarity)
  if (dropped.length) {
    console.log(`  ⚠️  ${dropped.length} skipped for unknown rarity:`)
    for (const p of dropped) console.log(`       ${p.name} (${p.slug}) rarity="${p.rarity_raw ?? ''}"`)
    pets = pets.filter((p) => p.rarity)
  }

  if (opts.limit > 0) pets = pets.slice(0, opts.limit)

  if (opts.enrich) {
    let batch = pets
    if (opts.enrichSlugs) {
      const want = new Set(opts.enrichSlugs)
      batch = pets.filter((p) => want.has(p.slug))
    } else {
      const end = opts.enrichLimit > 0 ? opts.enrichOffset + opts.enrichLimit : undefined
      batch = pets.slice(opts.enrichOffset, end)
    }
    console.log(`\nEnriching ${batch.length} of ${pets.length} pets from per-pet pages (${opts.delayMs}ms apart)…`)
    for (let i = 0; i < batch.length; i += 1) {
      const p = batch[i]
      try {
        const petHtml = await fetchText(`${BASE_URL}/values/${p.slug}`)
        Object.assign(p, parsePetPage(petHtml))
        process.stdout.write(`  [${i + 1}/${batch.length}] ${p.name} → ${p.obtainability ?? '?'}\n`)
      } catch (err) {
        console.log(`  [${i + 1}/${batch.length}] ${p.name} → enrich failed: ${err.message}`)
      }
      if (i < batch.length - 1) await sleep(opts.delayMs)
    }
  }

  // Informational only: how many of these pets a dry-run report says qualify.
  if (opts.qualifying) {
    const ok = await qualifyingSlugs(opts.qualifying)
    console.log(`\n${pets.filter((p) => ok.has(p.slug)).length} of ${pets.length} pets qualify per ${opts.qualifying}`)
  }

  const feed = {
    source: 'adoptmevalues.app',
    collector_version: COLLECTOR_VERSION,
    collected_at: new Date().toISOString(),
    list_pages: catalog.pages,
    enriched: opts.enrich,
    pet_count: pets.length,
    skipped_unknown_rarity: dropped.map((p) => ({ slug: p.slug, name: p.name, rarity_raw: p.rarity_raw })),
    pets,
  }

  const outPath = resolve(process.cwd(), opts.outputPath)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(feed, null, 2))
  console.log(`\nWrote ${pets.length} pets → ${opts.outputPath}`)

  if (opts.send) {
    console.log('\n--send: handing feed to the importer…')
    // --write so the importer PERSISTS. The importer only ever ADDS a pet that
    // is not already in the DB when --qualifying lists it (or --allow-new);
    // existing pets are refreshed as before.
    const importerArgs = ['scripts/import-adoptmevalues.mjs', opts.outputPath, '--write']
    if (opts.qualifying) importerArgs.push('--qualifying', opts.qualifying)
    if (opts.allowNew) importerArgs.push('--allow-new')
    await new Promise((res, rej) => {
      const child = spawn('node', importerArgs, { stdio: 'inherit' })
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`importer exited ${code}`))))
    })
  }
}

main().catch((err) => {
  console.error('\n❌ Collector failed:', err.message)
  process.exit(1)
})
