#!/usr/bin/env node
/**
 * Generic Eldorado collector for games with STRUCTURED offers
 * (`eldorado-structured` normaliser; config in
 * src/lib/values/sources/eldorado-structured-games.ts).
 *
 * Walks the game's whole CustomItem category CHEAPEST-FIRST (price ascending),
 * 50 offers a page, 1.5 s between pages, deduplicating by offer id (a price
 * sort shifts while we walk, so the same offer can appear on two pages).
 * Writes a source-shaped feed; parsing and matching happen in the importer.
 *
 * A feed is marked `complete` only when the walk reached the last page with no
 * failed page. The importer refuses to retire listings from an incomplete feed.
 *
 *   pnpm values:eldorado --game=murder-mystery-2                 # 3-page sample
 *   pnpm values:eldorado --game=murder-mystery-2 --crawl         # every page (~293, ~8 min)
 *   pnpm values:eldorado --game=murder-mystery-2 --crawl --write # + import (CI / --env)
 *
 * Options: --max-pages N  --delay-ms 1500  --out <path>  --env=local|prod [--yes]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { eldoradoStructuredConfig } from '../src/lib/values/sources/eldorado-structured-games.ts'
import { extractEldoradoOffer } from '../src/lib/values/normalisers/eldorado-structured.ts'

const BASE_URL = 'https://www.eldorado.gg'
const PAGE_SIZE = 50
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)

const GAME = val('game')
const CRAWL = flag('crawl')
const MAX_PAGES = Number(val('max-pages', CRAWL ? '1000' : '3'))
const DELAY_MS = Number(val('delay-ms', '1500'))
const WRITE = flag('write')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function offersUrl(config, pageIndex) {
  const u = new URL('/api/v1/item-management/offers', BASE_URL)
  u.searchParams.set('gameId', config.gameId)
  u.searchParams.set('category', config.category)
  u.searchParams.set('offerSortingCriterion', 'Price')
  u.searchParams.set('isAscending', 'true')
  u.searchParams.set('pageIndex', String(pageIndex))
  u.searchParams.set('pageSize', String(PAGE_SIZE))
  // Populates userOrderInfo.ratingCount = seller reviews (the reputable gate).
  u.searchParams.set('includeDeliveryMedians', 'true')
  return u.toString()
}

async function fetchPage(config, pageIndex) {
  let lastError = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(offersUrl(config, pageIndex), {
        headers: { accept: 'application/json', 'user-agent': UA },
      })
      if (res.status === 429) {
        lastError = new Error('HTTP 429')
        await sleep(30_000 * attempt)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastError = e
      await sleep(5_000 * attempt)
    }
  }
  throw new Error(`page ${pageIndex}: ${lastError?.message ?? 'failed'}`)
}

async function main() {
  if (!GAME) throw new Error('--game=<slug> is required')
  const config = eldoradoStructuredConfig(GAME)
  if (!config) throw new Error(`no eldorado-structured config for "${GAME}"`)
  const out = val('out', `data/values-feeds/${GAME}/eldorado-latest.json`)

  const byId = new Map()
  const failedPages = []
  let recordCount = null
  let totalPages = null
  let pagesWalked = 0
  let reachedEnd = false
  let duplicates = 0
  const started = new Date().toISOString()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let data
    try {
      data = await fetchPage(config, page)
    } catch (e) {
      console.error(`  ✗ ${e.message}`)
      failedPages.push(page)
      await sleep(DELAY_MS)
      continue
    }
    pagesWalked += 1
    if (totalPages == null) {
      recordCount = data.recordCount ?? null
      totalPages = data.totalPages ?? null
      console.log(`${GAME} / Eldorado ${config.gameId}: ${recordCount} offers across ${totalPages} pages`)
    }
    const results = data.results ?? []
    for (const row of results) {
      const listing = extractEldoradoOffer(row, config)
      if (!listing) continue
      if (byId.has(listing.source_offer_id)) duplicates += 1
      byId.set(listing.source_offer_id, listing)
    }
    if (page % 25 === 0) console.log(`  page ${page}/${totalPages} — ${byId.size} offers`)
    if (!results.length || (totalPages != null && page >= totalPages)) {
      reachedEnd = true
      break
    }
    await sleep(DELAY_MS)
  }

  const complete =
    reachedEnd &&
    failedPages.length === 0 &&
    totalPages != null &&
    pagesWalked >= Math.floor(totalPages * config.minCompleteShare)

  const feed = {
    source: 'eldorado',
    gameSlug: GAME,
    gameId: config.gameId,
    sort: 'price-asc',
    complete,
    recordCount,
    totalPages,
    pagesWalked,
    failedPages,
    duplicatesSeen: duplicates,
    started_at: started,
    collected_at: new Date().toISOString(),
    listings: [...byId.values()],
  }
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(feed))
  console.log(`collected ${feed.listings.length} unique offers (${duplicates} repeats) -> ${out}`)
  console.log(`  complete: ${complete}${failedPages.length ? `  failed pages: ${failedPages.join(',')}` : ''}`)

  if (WRITE) {
    const { importEldoradoFeed } = await import('./lib/values-import.mjs')
    await importEldoradoFeed({ game: GAME, feed, env: val('env'), yes: flag('yes'), write: true })
  } else {
    console.log('No --write: nothing imported. Run scripts/import-eldorado-values.mjs on the feed to see matches.')
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
