/**
 * Adopt Me CASH/USD collector — Eldorado marketplace
 * ============================================================================
 * Mirrors the SAB Eldorado collector, adapted to Adopt Me:
 *   - gameId 201 (SAB was 259), category CustomItem
 *   - variant comes from the offer's structured "Traits" attribute, not the
 *     title — cleaner than SAB's title parsing. Eldorado's codes: None, F, R,
 *     FR / N (= NEON), NF, NR, NFR / M (= Mega Neon), MF, MR, MFR. The
 *     single-potion neon/mega combos have no ladder column and are dropped.
 *
 * For each pet in adopt_me_pets it queries the offers API filtered by the
 * CANONICAL pet identity (tradeEnvironmentValue2 = the exact Item Name), walks
 * every page, and records each listing's USD price + variant (from the
 * structured Traits attribute). Toys/bundles/accounts named after the pet and
 * scam-bait titles are rejected. Writes raw listings to JSON; the importer /
 * correction cron computes the reputable cheapest + average.
 *
 * Polite: one pet at a time, delay between pets, a few pages each. Tune with
 * flags. USER runs this against the live site (as the SAB collector is run).
 *
 * Offer cleaning (toys, scam-bait, new accounts, trait-primary variant) lives
 * in scripts/lib/adoptme-eldorado.mjs, shared with the category crawl.
 *
 * TWO MODES
 *   per-pet (default)  one te_v2 query per catalog pet, every page. Requests
 *                      grow with the catalog (~1 + offers/50 per pet).
 *   --crawl            ONE paged walk of the whole Adopt Me "Pets" item type
 *                      (~1,300 pages on 2026-10-04), grouped by Item name and
 *                      kept for catalog pets only. Request count is fixed by
 *                      Eldorado's offer volume, not by how many pets we list —
 *                      the mode to use once the catalog is ~800 pets.
 *
 * Usage:
 *   node scripts/collect-eldorado-adoptme.mjs --limit 5        # test on 5 pets
 *   node scripts/collect-eldorado-adoptme.mjs                  # all pets → JSON
 *   node scripts/collect-eldorado-adoptme.mjs --crawl          # one category crawl → JSON
 *   node scripts/collect-eldorado-adoptme.mjs --send           # + run importer
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  ELDORADO_AM_GAME_ID as GAME_ID,
  DEFAULT_MIN_ACCOUNT_AGE_DAYS,
  cleanEldoradoOffer,
  crawlEldoradoPets,
  fetchEldoradoOffers,
  itemNameOf,
  eldoradoKeyFor,
  normalizeName,
} from './lib/adoptme-eldorado.mjs'

const DEFAULT_OUTPUT = 'data/adopt-me-feeds/eldorado-cash-latest.json'
const COLLECTOR_VERSION = 3 // 3 = Eldorado trait N is NEON (was Normal); NF/NR/MF/MR combo forms dropped

function loadEnv() {
  // No-op when .env.local is absent (CI uses GitHub-secret env vars).
  let raw
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return
    throw err
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function parseArgs(argv) {
  const o = {
    send: false,
    limit: Number(process.env.ELDORADO_AM_LIMIT ?? 0),
    // Safety ceiling on pages per pet. te_v2 scopes to one pet, so this is high
    // enough to cover the busiest pet (Owl ~13 pages) while the empty-page break
    // stops small pets early. Was 3 (too low — truncated the cheapest listings).
    maxPages: Number(process.env.ELDORADO_AM_MAX_PAGES ?? 20),
    delayMs: Number(process.env.ELDORADO_AM_DELAY_MS ?? 1500),
    outputPath: DEFAULT_OUTPUT,
    slugs: null, // comma-separated slugs to target a subset
    onlyPublished: false, // only pets with a live page (has_page)
    // --crawl: one walk of the whole Pets category instead of per-pet queries.
    // Its own page ceiling — ELDORADO_AM_MAX_PAGES (per pet, 20) would cut a
    // ~1,300-page crawl short.
    crawl: process.env.ELDORADO_AM_CRAWL === '1',
    crawlMaxPages: Number(process.env.ELDORADO_AM_CRAWL_MAX_PAGES ?? 2000),
    minAccountAgeDays: Number(process.env.ELDORADO_MIN_ACCOUNT_DAYS ?? DEFAULT_MIN_ACCOUNT_AGE_DAYS),
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--send') o.send = true
    else if (a === '--only-published') o.onlyPublished = true
    else if (a === '--limit') o.limit = Number(argv[++i])
    else if (a === '--max-pages') o.maxPages = Number(argv[++i])
    else if (a === '--delay-ms') o.delayMs = Number(argv[++i])
    else if (a === '--output') o.outputPath = argv[++i]
    else if (a === '--slugs') o.slugs = argv[++i].split(',').map((s) => s.trim())
    else if (a === '--crawl') o.crawl = true
    else if (a === '--crawl-max-pages') o.crawlMaxPages = Number(argv[++i])
  }
  // Politeness floor: never faster than one request a second.
  o.delayMs = Math.max(1000, o.delayMs)
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * One pet's offers, by the CANONICAL identity: `tradeEnvironmentValue2=<pet
 * name>` is Eldorado's server-side Item-name facet, so "Owl" returns only Owl
 * (a `searchQuery` substring match also returned Snow Owl, Peach Owl …).
 */
const fetchOffers = (itemName, page) =>
  fetchEldoradoOffers({ tradeEnvironmentValue2: itemName }, page, { retries: 0 })

/**
 * Fallback for casing/spelling drift (our "Ring-Tailed Lemur" vs Eldorado's
 * "Ring-tailed Lemur" — te_v2 is case-sensitive). Fuzzy, so the caller MUST
 * re-filter each result by normalised Item name.
 */
const fetchSearchOffers = (query, page) =>
  fetchEldoradoOffers({ searchQuery: query }, page, { retries: 0 })

/** Per-pet mode: walk every page of each pet's te_v2 query. */
async function collectPerPet(targets, opts) {
  const listings = []
  let matched = 0
  let skipped = 0
  for (let i = 0; i < targets.length; i += 1) {
    const pet = targets[i]
    let petListings = 0
    try {
      const petKey = normalizeName(pet.name)
      let firstBody = await fetchOffers(pet.name, 1)
      let useSearchFallback = false
      if ((Number(firstBody?.recordCount) || 0) === 0) {
        useSearchFallback = true
        firstBody = await fetchSearchOffers(pet.name, 1)
      }
      const fetchPage = (page) =>
        useSearchFallback ? fetchSearchOffers(pet.name, page) : fetchOffers(pet.name, page)
      const totalPages = Math.min(Number(firstBody?.totalPages) || 1, opts.maxPages)
      for (let page = 1; page <= totalPages; page += 1) {
        const body = page === 1 ? firstBody : await fetchPage(page)
        const results = body?.results ?? []
        if (!results.length) break
        const nowMs = Date.now()
        for (const item of results) {
          if (!item?.offer) continue
          // Fallback search is fuzzy: enforce identity by the structured Item name.
          if (useSearchFallback) {
            const iname = itemNameOf(item.offer)
            if (!iname || normalizeName(iname) !== petKey) {
              skipped++
              continue
            }
          }
          const cleaned = cleanEldoradoOffer(item, {
            petName: pet.name,
            nowMs,
            minAccountAgeDays: opts.minAccountAgeDays,
          })
          if (!cleaned.ok) {
            skipped++
            continue
          }
          listings.push({ slug: pet.slug, name: pet.name, ...cleaned.listing })
          petListings++
          matched++
        }
        if (results.length < 50) break // last page
        await sleep(opts.delayMs)
      }
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ${petListings} clean listings`)
    } catch (err) {
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ERROR: ${err.message}`)
    }
    if (i < targets.length - 1) await sleep(opts.delayMs)
  }
  return { listings, matched, skipped }
}

/** Crawl mode: one walk of the Pets category, kept for catalog pets only. */
async function collectByCrawl(targets, opts) {
  const crawl = await crawlEldoradoPets({
    delayMs: opts.delayMs,
    maxPages: opts.crawlMaxPages,
    minAccountAgeDays: opts.minAccountAgeDays,
    log: (m) => console.log(m),
  })
  const listings = []
  let matched = 0
  for (const pet of targets) {
    const group = crawl.byName.get(eldoradoKeyFor(pet.name))
    if (!group) continue
    for (const l of group.listings) {
      listings.push({ slug: pet.slug, name: pet.name, ...l })
      matched++
    }
  }
  const rejected = Object.values(crawl.rejected).reduce((a, b) => a + b, 0)
  const petKeys = new Set(targets.map((p) => eldoradoKeyFor(p.name)))
  let notInCatalog = 0
  for (const [key, g] of crawl.byName) if (!petKeys.has(key)) notInCatalog += g.listings.length
  console.log(
    `  crawl: ${crawl.pagesFetched}/${crawl.totalPages} pages, ${crawl.recordCount} offers, ` +
      `${crawl.uniqueOffers} unique, ${crawl.duplicates} duplicates, ${crawl.errors.length} page errors, stopped: ${crawl.stoppedBy}`,
  )
  if (crawl.stoppedBy !== 'complete') {
    // A truncated crawl would make the importer retire listings it never saw.
    throw new Error(`crawl incomplete (${crawl.stoppedBy}) — not writing a partial feed`)
  }
  return {
    listings,
    matched,
    skipped: rejected + notInCatalog,
    crawlStats: {
      pages: crawl.pagesFetched,
      total_pages: crawl.totalPages,
      offers_reported: crawl.recordCount,
      unique_offers: crawl.uniqueOffers,
      duplicates: crawl.duplicates,
      page_errors: crawl.errors.length,
      rejected: crawl.rejected,
      listings_not_in_catalog: notInCatalog,
    },
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log(`Adopt Me cash collector — Eldorado (gameId ${GAME_ID}) mode=${opts.crawl ? 'crawl' : 'per-pet'}`)
  console.log(
    `  limit=${opts.limit || 'all'} maxPages=${opts.crawl ? opts.crawlMaxPages : opts.maxPages} delay=${opts.delayMs}ms\n`,
  )

  // Which pets to price — from our catalog. Paged: one PostgREST response stops
  // at 1000 rows and the cut is silent.
  const pets = []
  for (let from = 0; ; from += 1000) {
    let query = sb.from('adopt_me_pets').select('slug,name').eq('is_active', true)
    if (opts.onlyPublished) query = query.eq('has_page', true)
    if (opts.slugs) query = query.in('slug', opts.slugs)
    const { data, error } = await query.order('name').order('slug').range(from, from + 999)
    if (error) throw new Error(`load pets: ${error.message}`)
    pets.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const targets = opts.limit > 0 ? pets.slice(0, opts.limit) : pets

  const started = Date.now()
  const { listings, matched, skipped, crawlStats } = opts.crawl
    ? await collectByCrawl(targets, opts)
    : await collectPerPet(targets, opts)

  const feed = {
    source: 'eldorado',
    game_id: GAME_ID,
    collector_version: COLLECTOR_VERSION,
    mode: opts.crawl ? 'crawl' : 'per-pet',
    collected_at: new Date().toISOString(),
    duration_sec: Math.round((Date.now() - started) / 1000),
    pet_count: targets.length,
    listing_count: listings.length,
    matched,
    skipped,
    ...(crawlStats ? { crawl: crawlStats } : {}),
    listings,
  }

  const outPath = resolve(process.cwd(), opts.outputPath)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(feed, null, 2))
  console.log(
    `\nWrote ${listings.length} clean listings (${matched} matched / ${skipped} skipped) in ${feed.duration_sec}s → ${opts.outputPath}`,
  )

  if (opts.send) {
    console.log('\n--send: handing feed to the cash importer…')
    await new Promise((res, rej) => {
      const child = spawn('node', ['scripts/import-adoptme-cash.mjs', opts.outputPath, '--write'], { stdio: 'inherit' })
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`importer exited ${code}`))))
    })
  }
}

main().catch((err) => {
  console.error('\n❌ Collector failed:', err.message)
  process.exit(1)
})
