/**
 * Adopt Me CASH/USD collector — u7buy marketplace (second source)
 * ============================================================================
 * u7buy is a Nuxt SPA, but its listings API is public and callable with a plain
 * fetch (no browser): discovered via Playwright network capture, documented in
 * the adopt-me-data-sources memory. Endpoint:
 *   GET /prod-api/product/urlMapping/game-service/getOtherBusinessSpuInfoShowVo
 *       ?spuId=1888155406422888618   (fixed "Adopt Me Items" product)
 *       &pageNum=N&pageSize=50
 *       &searchName={petName}         (the search param — NOT keyword/q)
 * Returns data.pageList.{total, rows[]}; each row has:
 *   offerName        — title (variant embedded, e.g. "Shadow Dragon MFR")
 *   priceUsdDouble   — USD price
 *
 * Writes the SAME feed shape as the Eldorado collector so the importer can pool
 * both sources into one median. Variant + noise filtering are shared
 * (scripts/lib/adoptme-variant.mjs) — title-driven, toys/age-listings excluded.
 *
 * Usage:
 *   node scripts/collect-u7buy-adoptme.mjs --slugs shadow-dragon
 *   node scripts/collect-u7buy-adoptme.mjs --only-published
 *   node scripts/collect-u7buy-adoptme.mjs                     # all pets
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { resolveVariant, titleIsPet } from './lib/adoptme-variant.mjs'

const API =
  'https://www.u7buy.com/prod-api/product/urlMapping/game-service/getOtherBusinessSpuInfoShowVo'
const SPU_ID = '1888155406422888618' // Adopt Me Items
const DEFAULT_OUTPUT = 'data/adopt-me-feeds/u7buy-cash-latest.json'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const COLLECTOR_VERSION = 1

// Seller-trust thresholds. u7buy exposes completedNum (orders) + favorableRate
// (positive %) per seller — the real trust signal Eldorado hides. A seller
// under these is likely a fake/scam listing (the "< 100 feedback" heuristic).
const MIN_COMPLETED_ORDERS = Number(process.env.U7_MIN_COMPLETED ?? 100)
const MIN_FAVORABLE_RATE = Number(process.env.U7_MIN_FAVORABLE ?? 90)

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
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
    onlyPublished: false,
    slugs: null,
    limit: Number(process.env.U7_AM_LIMIT ?? 0),
    maxPages: Number(process.env.U7_AM_MAX_PAGES ?? 3),
    delayMs: Number(process.env.U7_AM_DELAY_MS ?? 1200),
    outputPath: DEFAULT_OUTPUT,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--send') o.send = true
    else if (a === '--only-published') o.onlyPublished = true
    else if (a === '--slugs') o.slugs = argv[++i].split(',').map((s) => s.trim())
    else if (a === '--limit') o.limit = Number(argv[++i])
    else if (a === '--max-pages') o.maxPages = Number(argv[++i])
    else if (a === '--delay-ms') o.delayMs = Number(argv[++i])
    else if (a === '--output') o.outputPath = argv[++i]
  }
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(petName, pageNum) {
  const u = new URL(API)
  u.searchParams.set('spuId', SPU_ID)
  u.searchParams.set('pageNum', String(pageNum))
  u.searchParams.set('pageSize', '50')
  u.searchParams.set('sort', '100')
  u.searchParams.set('searchName', petName)
  const res = await fetch(u.toString(), { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (!res.ok) throw new Error(`u7buy ${petName} p${pageNum} → ${res.status}`)
  const body = await res.json()
  return body?.data?.pageList ?? { total: 0, rows: [] }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log('Adopt Me cash collector — u7buy')
  console.log(`  limit=${opts.limit || 'all'} maxPages=${opts.maxPages} delay=${opts.delayMs}ms\n`)

  let query = sb.from('adopt_me_pets').select('slug,name').eq('is_active', true).order('name')
  if (opts.onlyPublished) query = query.eq('has_page', true)
  if (opts.slugs) query = query.in('slug', opts.slugs)
  const { data: pets, error } = await query
  if (error) throw new Error(`load pets: ${error.message}`)
  const targets = opts.limit > 0 ? pets.slice(0, opts.limit) : pets

  const listings = []
  let matched = 0
  let skipped = 0

  for (let i = 0; i < targets.length; i += 1) {
    const pet = targets[i]
    let petCount = 0
    try {
      for (let page = 1; page <= opts.maxPages; page += 1) {
        const { rows } = await fetchPage(pet.name, page)
        if (!rows.length) break
        for (const row of rows) {
          const title = row.offerName
          if (!titleIsPet(title, pet.name)) {
            skipped++
            continue
          }
          const variant = resolveVariant(title, null, null)
          if (!variant) {
            skipped++
            continue
          }
          const price = Number(row.priceUsdDouble)
          if (!Number.isFinite(price) || price <= 0) {
            skipped++
            continue
          }
          // Real seller-trust filter — u7buy exposes what Eldorado hides:
          // completed orders + positive-feedback %. Drop low-trust sellers
          // (the "< 100 feedback = likely fake" heuristic).
          const store = row.remoteStoreDetail ?? {}
          const completed = Number(store.completedNum ?? 0)
          const favorable = Number(store.favorableRate ?? 0)
          if (completed < MIN_COMPLETED_ORDERS || favorable < MIN_FAVORABLE_RATE) {
            skipped++
            continue
          }
          listings.push({
            slug: pet.slug,
            name: pet.name,
            variant,
            priceUsd: price,
            title,
            sellerId: store.sellerId ?? null,
            completedOrders: completed,
            favorableRate: favorable,
          })
          petCount++
          matched++
        }
        if (rows.length < 50) break
        await sleep(opts.delayMs)
      }
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ${petCount} clean listings`)
    } catch (err) {
      console.log(`  [${i + 1}/${targets.length}] ${pet.name.padEnd(20)} ERROR: ${err.message}`)
    }
    if (i < targets.length - 1) await sleep(opts.delayMs)
  }

  const feed = {
    source: 'u7buy',
    collector_version: COLLECTOR_VERSION,
    collected_at: new Date().toISOString(),
    pet_count: targets.length,
    listing_count: listings.length,
    matched,
    skipped,
    listings,
  }

  const outPath = resolve(process.cwd(), opts.outputPath)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(feed, null, 2))
  console.log(`\nWrote ${listings.length} clean listings (${matched} matched / ${skipped} skipped) → ${opts.outputPath}`)
}

main().catch((err) => {
  console.error('\n❌ u7buy collector failed:', err.message)
  process.exit(1)
})
