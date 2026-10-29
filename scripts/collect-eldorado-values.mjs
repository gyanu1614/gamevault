#!/usr/bin/env node
/**
 * Generic Eldorado collector for games with STRUCTURED offers
 * (`eldorado-structured` normaliser; config in
 * src/lib/values/sources/eldorado-structured-games.ts).
 *
 * Walks the game's whole CustomItem category CHEAPEST-FIRST (price ascending),
 * 50 offers a page, one request every ≥1.5 s, deduplicating by offer id (a
 * price sort shifts while we walk, so the same offer can appear on two pages).
 * Writes a source-shaped feed; parsing and matching happen in the importer.
 *
 * A feed is marked `complete` only when the walk reached the last page with no
 * failed page. The importer refuses to retire listings from an incomplete feed.
 *
 * Requests go through the shared Eldorado client (scripts/lib/eldorado-http.mjs,
 * 2026-10-28/29): it paces, retries a 5xx twice, honours Retry-After on a 429,
 * and throws EldoradoBlockedError on the second block in a row. A failed page
 * is still skipped (→ incomplete); a block ends the walk at once with the feed
 * saved and marked `stopped_early`. This used to retry a 429 four times per
 * page (30-120 s apart) and then move on to the next page — into the block.
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
import { walkDone } from './lib/offers.mjs'
import { createEldoradoClient, isEldoradoBlocked } from './lib/eldorado-http.mjs'

const BASE_URL = 'https://www.eldorado.gg'
const PAGE_SIZE = 50

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
// Never faster than one request a second.
const DELAY_MS = Math.max(1000, Number(val('delay-ms', '1500')) || 1500)
const WRITE = flag('write')

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

async function main() {
  if (!GAME) throw new Error('--game=<slug> is required')
  const config = eldoradoStructuredConfig(GAME)
  if (!config) throw new Error(`no eldorado-structured config for "${GAME}"`)
  const out = val('out', `data/values-feeds/${GAME}/eldorado-latest.json`)

  // One client for the run: it is the pace (no sleeps in the loop below).
  const eldorado = createEldoradoClient({ minIntervalMs: DELAY_MS, jitterMs: 250 })
  const byId = new Map()
  const failedPages = []
  let recordCount = null
  let totalPages = null
  let pagesWalked = 0
  let reachedEnd = false
  let duplicates = 0
  let pageSize = 0
  let stoppedEarly = null
  const started = new Date().toISOString()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let data
    try {
      data = await eldorado.getJson(offersUrl(config, page))
    } catch (e) {
      console.error(`  ✗ page ${page}: ${e.message}`)
      if (isEldoradoBlocked(e)) {
        stoppedEarly = { reason: 'eldorado_blocked', at_page: page, pages_walked: pagesWalked, total_pages: totalPages, detail: e.message }
        break
      }
      failedPages.push(page)
      continue
    }
    pagesWalked += 1
    if (totalPages == null) {
      recordCount = data.recordCount ?? null
      totalPages = data.totalPages ?? null
      console.log(`${GAME} / Eldorado ${config.gameId}: ${recordCount} offers across ${totalPages} pages`)
    }
    const results = data.results ?? []
    if (!pageSize) pageSize = results.length
    for (const row of results) {
      const listing = extractEldoradoOffer(row, config)
      if (!listing) continue
      if (byId.has(listing.source_offer_id)) duplicates += 1
      byId.set(listing.source_offer_id, listing)
    }
    if (page % 25 === 0) console.log(`  page ${page}/${totalPages} — ${byId.size} offers`)
    // Past page 1's page count, keep going while pages are full: the list grew during the walk.
    if (walkDone({ page, totalPages, resultsLength: results.length, pageSize })) {
      reachedEnd = true
      break
    }
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
    stopped_early: stoppedEarly,
    eldorado_http: eldorado.stats(),
    started_at: started,
    collected_at: new Date().toISOString(),
    listings: [...byId.values()],
  }
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(feed))
  console.log(`collected ${feed.listings.length} unique offers (${duplicates} repeats) -> ${out}`)
  console.log(`  complete: ${complete}${failedPages.length ? `  failed pages: ${failedPages.join(',')}` : ''}`)

  if (stoppedEarly) {
    // The walk is cheapest-first over the whole category, and a write retires
    // every listing it did not see: a partial feed cannot be imported. The
    // importer below refuses it; yesterday's listings stay as they are.
    console.log(
      `::error::Eldorado throttled the ${GAME} crawl at page ${stoppedEarly.at_page}/${totalPages ?? '?'}; ` +
        'feed saved, nothing imported',
    )
  }

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
