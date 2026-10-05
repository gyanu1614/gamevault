/**
 * Adopt Me catalog DRY RUN — which pets qualify for the values hub?
 * ============================================================================
 * Owner rule (2026-10-04): list a pet only when ANY of its variants has a real
 * reputable cash price above $1. This script answers "which ones?" WITHOUT
 * 791 per-pet searches and WITHOUT touching the database:
 *
 *   1. adoptmevalues.app — every list page (/values, /values/page/2 …) until a
 *      page has no cards → the full catalog (name, slug, rarity, image).
 *   2. Eldorado — ONE paged crawl of the whole Adopt Me "Pets" item type,
 *      cheapest first, cleaned with the SAME rules as the daily cash collector
 *      (scripts/lib/adoptme-eldorado.mjs) and grouped by the structured
 *      Item name.
 *   3. Pricing — the production Adopt Me pricer (correctAdoptMePrices: the
 *      shared reputable engine + ladder sanity) over each pet's listings.
 *      Qualifies = max over variants of the reputable CHEAPEST > --min-usd.
 *   4. Images — HEAD each catalog image (paced, in parallel with the crawl;
 *      different host).
 *   5. The live catalog — adopt_me_pets read with the public ANON key (GET
 *      only), to flag already-in-DB pets.
 *
 * Writes ONLY local files:
 *   data/adopt-me-catalog-dryrun/<date>.json   full report (+ summary)
 *   data/adopt-me-catalog-dryrun/<date>.csv    one row per catalog pet
 *   data/adopt-me-catalog-dryrun/eldorado-crawl-<date>.json  compact crawl cache
 *
 * Run with tsx (the pricer is app TypeScript):
 *   pnpm adoptme:catalog:dryrun
 *   pnpm adoptme:catalog:dryrun --crawl-cache data/adopt-me-catalog-dryrun/eldorado-crawl-2026-10-04.json
 *   pnpm adoptme:catalog:dryrun --skip-images --min-usd 1
 *   pnpm adoptme:catalog:dryrun --crawl-cache <crawl.json> --image-cache <report.json>   # no network to Eldorado / the CDN
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { correctAdoptMePrices } from '../src/lib/pricing/adopt-me-correction.ts'
import { fetchCatalogPages, BROWSER_UA } from './lib/adoptmevalues-catalog.mjs'
import { crawlEldoradoPets, eldoradoKeyFor, normalizeName } from './lib/adoptme-eldorado.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadEnv() {
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

function parseArgs(argv) {
  const o = {
    minUsd: 1,
    catalogDelayMs: 1500,
    eldoradoDelayMs: 1000,
    imageDelayMs: 1000,
    eldoradoMaxPages: 2000,
    catalogMaxPages: 30,
    crawlCache: null,
    imageCache: null,
    skipImages: false,
    outDir: 'data/adopt-me-catalog-dryrun',
    date: new Date().toISOString().slice(0, 10),
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--min-usd') o.minUsd = Number(argv[++i])
    else if (a === '--catalog-delay-ms') o.catalogDelayMs = Number(argv[++i])
    else if (a === '--delay-ms') o.eldoradoDelayMs = Number(argv[++i])
    else if (a === '--image-delay-ms') o.imageDelayMs = Number(argv[++i])
    else if (a === '--max-pages') o.eldoradoMaxPages = Number(argv[++i])
    else if (a === '--catalog-max-pages') o.catalogMaxPages = Number(argv[++i])
    else if (a === '--crawl-cache') o.crawlCache = argv[++i]
    else if (a === '--image-cache') o.imageCache = argv[++i]
    else if (a === '--skip-images') o.skipImages = true
    else if (a === '--out-dir') o.outDir = argv[++i]
    else if (a === '--date') o.date = argv[++i]
  }
  // Politeness floor: never faster than 1 request/second per host.
  o.catalogDelayMs = Math.max(1000, o.catalogDelayMs)
  o.eldoradoDelayMs = Math.max(1000, o.eldoradoDelayMs)
  o.imageDelayMs = Math.max(1000, o.imageDelayMs)
  return o
}

/** Live catalog via the public anon key — GET only, paged, never prints keys. */
async function loadDbPets() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.log('  (no NEXT_PUBLIC_SUPABASE_URL / ANON key — already-in-DB column will be null)')
    return null
  }
  const sb = createClient(url, anon, { auth: { persistSession: false } })
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('adopt_me_pets')
      .select('id,slug,name,is_active,has_page,image_url')
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`adopt_me_pets read: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function headImage(url) {
  if (!url) return { ok: false, status: null }
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': BROWSER_UA } })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, status: `error: ${err.message}` }
  }
}

async function checkImages(pets, delayMs) {
  const out = new Map()
  for (let i = 0; i < pets.length; i += 1) {
    if (i > 0) await sleep(delayMs)
    out.set(pets[i].slug, await headImage(pets[i].image_url))
    if ((i + 1) % 100 === 0) console.log(`  images ${i + 1}/${pets.length}`)
  }
  return out
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100
}

function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  console.log('Adopt Me catalog DRY RUN (no DB writes, local report only)')
  console.log(`  min-usd=${opts.minUsd} eldorado-delay=${opts.eldoradoDelayMs}ms images=${!opts.skipImages}\n`)

  // 1. Catalog (all list pages).
  console.log('adoptmevalues.app catalog:')
  const catalog = await fetchCatalogPages({
    maxPages: opts.catalogMaxPages,
    delayMs: opts.catalogDelayMs,
    log: (m) => console.log(m),
  })
  const unknownRarity = catalog.pets.filter((p) => !p.rarity)
  console.log(`  ${catalog.pets.length} pets over ${catalog.pages} pages (stopped: ${catalog.stoppedBy})`)
  if (unknownRarity.length) {
    console.log(`  ⚠️  ${unknownRarity.length} with unknown rarity (reported, not imported): ` +
      unknownRarity.map((p) => `${p.name} [${p.rarity_raw}]`).join(', '))
  }

  // 2 + 4 in parallel: the Eldorado crawl and the image HEADs hit different hosts.
  const dbPetsPromise = loadDbPets()
  // --image-cache <report.json>: reuse HEAD results from an earlier report
  // (same URLs); only pets missing from it are checked.
  const cachedImages = new Map()
  if (opts.imageCache) {
    const prev = JSON.parse(await readFile(resolve(process.cwd(), opts.imageCache), 'utf8'))
    for (const p of prev.pets ?? []) {
      if (p.image_ok != null) cachedImages.set(p.slug, { url: p.image_url, ok: p.image_ok, status: p.image_status })
    }
  }
  const imagesPromise = opts.skipImages
    ? Promise.resolve(null)
    : checkImages(
        catalog.pets.filter((p) => cachedImages.get(p.slug)?.url !== p.image_url),
        opts.imageDelayMs,
      ).then((fresh) => {
        const all = new Map()
        for (const p of catalog.pets) {
          const c = cachedImages.get(p.slug)
          if (c && c.url === p.image_url) all.set(p.slug, { ok: c.ok, status: c.status })
        }
        for (const [slug, v] of fresh) all.set(slug, v)
        return all
      })

  let crawl
  if (opts.crawlCache) {
    console.log(`\nEldorado: reusing crawl cache ${opts.crawlCache}`)
    const cached = JSON.parse(await readFile(resolve(process.cwd(), opts.crawlCache), 'utf8'))
    crawl = { ...cached, byName: new Map(Object.entries(cached.byName)) }
  } else {
    console.log('\nEldorado: one paged crawl of the Adopt Me Pets category (cheapest first)…')
    const started = Date.now()
    crawl = await crawlEldoradoPets({
      delayMs: opts.eldoradoDelayMs,
      maxPages: opts.eldoradoMaxPages,
      log: (m) => console.log(m),
    })
    crawl.durationSec = Math.round((Date.now() - started) / 1000)
    const cachePath = resolve(process.cwd(), opts.outDir, `eldorado-crawl-${opts.date}.json`)
    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, JSON.stringify({ ...crawl, byName: Object.fromEntries(crawl.byName) }))
    console.log(`  crawl cached → ${cachePath}`)
  }
  console.log(
    `  ${crawl.pagesFetched} pages, ${crawl.uniqueOffers ?? '?'}/${crawl.recordCount} offers, ${crawl.byName.size} distinct pets, ` +
      `${crawl.duplicates} seam duplicates, ${crawl.errors.length} page errors, stopped: ${crawl.stoppedBy}` +
      (crawl.durationSec ? `, ${crawl.durationSec}s` : ''),
  )

  // 3. Price every Eldorado pet group with the production pricer.
  const rawListings = []
  for (const [key, group] of crawl.byName) {
    for (const l of group.listings) {
      rawListings.push({ itemId: key, variant: l.variant, priceUsd: l.priceUsd, reviews: l.reviews })
    }
  }
  const corrections = correctAdoptMePrices(rawListings)
  const pricedByKey = new Map()
  for (const c of corrections) {
    const list = pricedByKey.get(c.petId) ?? []
    list.push(c)
    pricedByKey.set(c.petId, list)
  }

  const [dbPets, images] = await Promise.all([dbPetsPromise, imagesPromise])
  const dbBySlug = new Map((dbPets ?? []).map((p) => [p.slug, p]))
  const dbByName = new Map((dbPets ?? []).map((p) => [normalizeName(p.name), p]))

  // 5. One row per catalog pet.
  const catalogKeys = new Set()
  const rows = catalog.pets.map((pet) => {
    const key = eldoradoKeyFor(pet.name)
    catalogKeys.add(key)
    const group = crawl.byName.get(key)
    const priced = (pricedByKey.get(key) ?? []).slice().sort((a, b) => b.cheapestUsd - a.cheapestUsd)
    const best = priced[0] ?? null
    const db = dbBySlug.get(pet.slug) ?? dbByName.get(normalizeName(pet.name)) ?? null
    const img = images?.get(pet.slug) ?? null
    return {
      name: pet.name,
      slug: pet.slug,
      rarity: pet.rarity,
      rarity_raw: pet.rarity_raw,
      image_url: pet.image_url,
      image_ok: img ? img.ok : null,
      image_status: img ? img.status : null,
      eldorado_item_name: group?.itemName ?? null,
      eldorado_offers: group?.offers ?? 0,
      clean_listings: group?.listings.length ?? 0,
      reputable_variants: priced.length,
      best_variant: best?.variant ?? null,
      best_cheapest_usd: best ? round2(best.cheapestUsd) : null,
      best_average_usd: best ? round2(best.averageUsd) : null,
      best_reputable_count: best?.reputableCount ?? 0,
      variants: Object.fromEntries(
        priced.map((c) => [c.variant, { cheapest: round2(c.cheapestUsd), average: round2(c.averageUsd), n: c.reputableCount }]),
      ),
      qualifies: Boolean(best && best.cheapestUsd > opts.minUsd && pet.rarity),
      in_db: dbPets ? Boolean(db) : null,
      db_slug: db?.slug ?? null,
      db_is_active: db ? Boolean(db.is_active) : null,
      db_has_page: db ? Boolean(db.has_page) : null,
      trade_values: pet.trade_values,
    }
  })

  // Eldorado pets the catalog doesn't know (name drift or not on adoptmevalues).
  const eldoradoOnly = [...crawl.byName.entries()]
    .filter(([key]) => !catalogKeys.has(key))
    .map(([key, g]) => {
      const priced = (pricedByKey.get(key) ?? []).sort((a, b) => b.cheapestUsd - a.cheapestUsd)
      return {
        eldorado_item_name: g.itemName,
        offers: g.offers,
        clean_listings: g.listings.length,
        best_variant: priced[0]?.variant ?? null,
        best_cheapest_usd: priced[0] ? round2(priced[0].cheapestUsd) : null,
        would_qualify: Boolean(priced[0] && priced[0].cheapestUsd > opts.minUsd),
      }
    })
    .sort((a, b) => b.offers - a.offers)

  // DB pets not on the catalog (renamed / removed upstream).
  const catalogSlugs = new Set(catalog.pets.map((p) => p.slug))
  const dbOnly = (dbPets ?? [])
    .filter((p) => !catalogSlugs.has(p.slug) && !catalogKeys.has(eldoradoKeyFor(p.name)))
    .map((p) => ({ slug: p.slug, name: p.name, is_active: p.is_active, has_page: p.has_page }))

  const qualifying = rows.filter((r) => r.qualifies)
  const summary = {
    generated_at: new Date().toISOString(),
    min_usd: opts.minUsd,
    rule: 'qualifies = some variant has a reputable CHEAPEST > min_usd (production pricer: reputable engine + ladder sanity)',
    source_pets: catalog.pets.length,
    source_pages: catalog.pages,
    unknown_rarity: unknownRarity.map((p) => ({ name: p.name, slug: p.slug, rarity_raw: p.rarity_raw })),
    eldorado: {
      pages_fetched: crawl.pagesFetched,
      offers_reported: crawl.recordCount,
      unique_offers: crawl.uniqueOffers ?? null,
      distinct_pets: crawl.byName.size,
      seam_duplicates: crawl.duplicates,
      page_errors: crawl.errors.length,
      stopped_by: crawl.stoppedBy,
      duration_sec: crawl.durationSec ?? null,
      rejected: crawl.rejected,
      clean_listings: rawListings.length,
    },
    no_eldorado_match: rows.filter((r) => !r.eldorado_item_name).length,
    qualifying: qualifying.length,
    qualifying_in_db: qualifying.filter((r) => r.in_db).length,
    qualifying_new: qualifying.filter((r) => r.in_db === false).length,
    in_db_not_qualifying: rows.filter((r) => r.in_db && !r.qualifies).map((r) => r.slug),
    db_pets: dbPets?.length ?? null,
    db_only: dbOnly,
    images_checked: images ? images.size : 0,
    broken_images_all: images ? rows.filter((r) => r.image_ok === false).length : null,
    broken_images_qualifying: images ? qualifying.filter((r) => r.image_ok === false).map((r) => r.slug) : null,
    fairy_bat_dragon: rows.find((r) => r.slug === 'fairy-bat-dragon') ?? null,
    eldorado_only_qualifying: eldoradoOnly.filter((e) => e.would_qualify).length,
  }

  const outDir = resolve(process.cwd(), opts.outDir)
  await mkdir(outDir, { recursive: true })
  const jsonPath = resolve(outDir, `${opts.date}.json`)
  const csvPath = resolve(outDir, `${opts.date}.csv`)
  await writeFile(jsonPath, JSON.stringify({ summary, pets: rows, eldorado_only: eldoradoOnly }, null, 2))
  const cols = [
    'name', 'slug', 'rarity', 'image_url', 'image_ok', 'best_variant', 'best_cheapest_usd',
    'best_average_usd', 'best_reputable_count', 'eldorado_offers', 'clean_listings', 'qualifies', 'in_db',
    'db_has_page',
  ]
  const csv = [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')))
    .join('\n')
  await writeFile(csvPath, csv + '\n')

  console.log('\n── Summary ──')
  console.log(`  source pets           ${summary.source_pets}`)
  console.log(`  qualify (> $${opts.minUsd})        ${summary.qualifying}`)
  console.log(`    already in DB       ${summary.qualifying_in_db}`)
  console.log(`    new                 ${summary.qualifying_new}`)
  console.log(`  in DB, not qualifying ${summary.in_db_not_qualifying.length}`)
  console.log(`  no Eldorado match     ${summary.no_eldorado_match}`)
  console.log(`  broken images         ${summary.broken_images_all} (qualifying: ${summary.broken_images_qualifying?.length ?? '—'})`)
  const fbd = summary.fairy_bat_dragon
  console.log(
    `  Fairy Bat Dragon      ${fbd ? `${fbd.qualifies ? 'QUALIFIES' : 'does not qualify'} — best ${fbd.best_variant ?? '—'} $${fbd.best_cheapest_usd ?? '—'}, in DB: ${fbd.in_db}` : 'not in source'}`,
  )
  console.log(`\nWrote ${jsonPath}\n      ${csvPath}`)
}

main().catch((err) => {
  console.error('\n❌ Dry run failed:', err.message)
  process.exit(1)
})
