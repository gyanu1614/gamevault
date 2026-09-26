#!/usr/bin/env node
/**
 * Steal An Egg — Eldorado collector (gameId=452).
 *
 * Differs from the SAB collector in one structural way: SAB's offers carry
 * `tradeEnvironmentValues` we can filter and trust, so it queries per item.
 * Steal An Egg carries NO structured attributes at all (0/400 sampled live),
 * so this pages the whole category and resolves items from TITLES via the
 * normaliser. There is no per-item query to make.
 *
 * Read-only by default: it writes a JSON feed and prints a report. Pass
 * --write to upsert into values_raw_listings (service role, owner-run).
 *
 * Usage:
 *   node scripts/collect-eldorado-sae.mjs --max-pages 8            (dry run)
 *   node scripts/collect-eldorado-sae.mjs --max-pages 40 --write
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = 'https://www.eldorado.gg'
const GAME_ID = '452'
const SOURCE = 'eldorado'
const PAGE_SIZE = 50
/** ~1 req/s measured safe against Eldorado; no rate limiting hit at 9 pages. */
const PACING_MS = 1100

const args = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i === -1 ? d : args[i + 1]
}
const MAX_PAGES = Number(arg('max-pages', '8'))
const WRITE = args.includes('--write')
const OUT = arg('out', 'data/sae-market-feeds/eldorado-latest.json')

function offersUrl(pageIndex) {
  const u = new URL('/api/v1/item-management/offers', BASE_URL)
  u.searchParams.set('gameId', GAME_ID)
  u.searchParams.set('category', 'CustomItem')
  u.searchParams.set('pageIndex', String(pageIndex))
  u.searchParams.set('pageSize', String(PAGE_SIZE))
  u.searchParams.set('useMinPurchasePrice', 'false')
  // As in the SAB collector: without this the API returns a stale,
  // relevance-ranked slice that misses the actual cheapest listings.
  u.searchParams.set('useOfferAttributeSearch', 'true')
  u.searchParams.set('usePopularItems', 'false')
  // Required for seller review counts (userOrderInfo.ratingCount) — the
  // reputable model's second input. Without it every listing is unpriceable.
  u.searchParams.set('includeDeliveryMedians', 'true')
  u.searchParams.set('usePerGameScore', 'true')
  return u.toString()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(pageIndex) {
  const res = await fetch(offersUrl(pageIndex), {
    headers: {
      accept: 'application/json',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`Eldorado page ${pageIndex}: HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const collected = []
  let recordCount = null
  let totalPages = null

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchPage(page)
    if (recordCount == null) {
      recordCount = data.recordCount
      totalPages = data.totalPages
      console.log(`Steal An Egg / Eldorado: ${recordCount} listings across ${totalPages} pages`)
    }
    for (const row of data.results ?? []) {
      const o = row.offer ?? {}
      collected.push({
        source: SOURCE,
        source_offer_id: o.id,
        title: o.offerTitle ?? '',
        price_usd: o.pricePerUnitInUSD?.amount ?? null,
        quantity_available: o.quantity ?? null,
        // ratingCount is the seller's total review count.
        seller_reviews:
          row.userOrderInfo?.ratingCount ??
          row.userOrderInfo?.feedbackScore ??
          null,
        observed_at: new Date().toISOString(),
      })
    }
    if (page >= (totalPages ?? 1)) break
    await sleep(PACING_MS)
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    JSON.stringify(
      { source: SOURCE, gameId: GAME_ID, recordCount, totalPages, collected_at: new Date().toISOString(), listings: collected },
      null,
      2,
    ),
  )

  const withReviews = collected.filter((l) => l.seller_reviews != null).length
  const withPrice = collected.filter((l) => l.price_usd != null && l.price_usd > 0).length
  console.log(`collected ${collected.length} listings -> ${OUT}`)
  console.log(`  with a price        : ${withPrice}`)
  console.log(`  with seller reviews : ${withReviews} (the reputable model needs these)`)

  if (WRITE) {
    console.log('\n--write given: upserting into values_raw_listings…')
    const { writeListings } = await import('./lib/sae-write.mjs')
    await writeListings(collected)
  } else {
    console.log('\nDry run (no DB writes). Pass --write to persist.')
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
