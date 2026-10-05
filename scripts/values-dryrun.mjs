#!/usr/bin/env node
/**
 * End-to-end DRY RUN of a values hub's data pipeline, with no database:
 *   feed (collector) → normaliser → catalogue/alias resolution (importer's
 *   planRawRows) → the pricing job's own pure decision (planValuesPrices with
 *   the game's policy) → a JSON report.
 *
 *   pnpm values:dryrun --game=murder-mystery-2
 *   → data/mm2-dryrun/<date>.json
 *
 * Options: --feed <path>  --catalogue <path>  --out <path>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { loadLocalCatalogue, planRawRows } from './lib/values-import.mjs'
import { MIN_EVIDENCE, planValuesPrices } from '../src/lib/pricing/games/values-pipeline.ts'
import { MM2_PRICING_POLICY } from '../src/lib/pricing/games/murder-mystery-2.ts'
import { reviewBarForValue } from '../src/lib/sab/reputable-pricing.ts'

const POLICIES = { 'murder-mystery-2': MM2_PRICING_POLICY }
const HIGH_TIER = new Set(['Godly', 'Ancient', 'Vintage', 'Unique', 'Chroma'])
const SAMPLES = ['harvester', 'gingerscope', 'chroma-travelers-gun', 'seer']

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

const quantiles = (xs, qs) => {
  const s = [...xs].sort((a, b) => a - b)
  return Object.fromEntries(qs.map((q) => [`p${Math.round(q * 100)}`, s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null]))
}

async function main() {
  const game = val('game', 'murder-mystery-2')
  const policy = POLICIES[game]
  if (!policy) throw new Error(`no pricing policy for ${game}`)
  const feedPath = val('feed', `data/values-feeds/${game}/eldorado-latest.json`)
  const feed = JSON.parse(await readFile(feedPath, 'utf8'))
  const catalogue = loadLocalCatalogue(game, val('catalogue') ?? undefined)
  const bySlug = new Map(catalogue.items.map((i) => [i.slug, i]))

  const plan = planRawRows({ game, listings: feed.listings, catalogue, observedAt: feed.collected_at })
  // The DB stores numeric(12,2); price what the job will read.
  const matched = plan.rows.filter((r) => r.parse_status === 'matched')
  const priceable = new Set(catalogue.items.map((i) => i.slug))
  const priced = planValuesPrices(
    matched.map((r) => ({ matched_item_id: r.matched_slug, price_usd: r.price_usd, seller_reviews: r.seller_reviews })),
    priceable,
    policy,
  )

  // Seller concentration: distinct sellers behind each item's reputable rows.
  const sellersBySlug = new Map()
  for (const r of matched) {
    if ((r.seller_reviews ?? 0) < 200) continue
    const set = sellersBySlug.get(r.matched_slug) ?? new Set()
    if (r.seller_ref) set.add(r.seller_ref)
    sellersBySlug.set(r.matched_slug, set)
  }
  const offersBySlug = new Map()
  for (const r of matched) offersBySlug.set(r.matched_slug, (offersBySlug.get(r.matched_slug) ?? 0) + 1)

  const pricedRows = priced.priced.map((p) => {
    const item = bySlug.get(p.itemId)
    return {
      slug: p.itemId,
      name: item?.name,
      type: item?.itemType,
      rarity: item?.rarity,
      base: item?.baseSlug ?? null,
      cheapest_usd: p.cheapestUsd,
      average_usd: p.averageUsd,
      reputable_listings: p.reputableCount,
      review_bar: reviewBarForValue(p.averageUsd),
      distinct_reputable_sellers: sellersBySlug.get(p.itemId)?.size ?? 0,
      listed_now: offersBySlug.get(p.itemId) ?? 0,
      range_usd: priced.spanByItem.get(p.itemId) ?? null,
    }
  })
  const launchable = pricedRows
  const highTier = launchable.filter((r) => HIGH_TIER.has(r.rarity))
  const avg = launchable.map((r) => r.average_usd)

  const report = {
    game,
    generated_at: new Date().toISOString(),
    feed: {
      path: feedPath,
      collected_at: feed.collected_at,
      complete: feed.complete,
      eldorado_record_count: feed.recordCount,
      pages_walked: feed.pagesWalked,
      unique_offers: feed.listings.length,
    },
    catalogue: {
      items: catalogue.items.length,
      chroma: catalogue.items.filter((i) => i.isChroma).length,
      by_rarity: catalogue.items.reduce((m, i) => ((m[i.rarity ?? 'unknown'] = (m[i.rarity ?? 'unknown'] ?? 0) + 1), m), {}),
      reviewed_aliases: catalogue.aliases.length,
    },
    matching: { ...plan.stats, unmatched_names: plan.unmatched.length },
    pricing: {
      policy,
      min_evidence: MIN_EVIDENCE,
      listings_priced_on: priced.listings.length,
      dropped_below_unit_floor: priced.droppedFakeCheap,
      placeholders_dropped: priced.placeholdersDropped,
      items_with_matched_listings: offersBySlug.size,
      suppressed_thin_evidence: priced.suppressed,
      launchable_items: launchable.length,
      launchable_high_tier: highTier.length,
      launchable_by_rarity: launchable.reduce((m, r) => ((m[r.rarity ?? 'unknown'] = (m[r.rarity ?? 'unknown'] ?? 0) + 1), m), {}),
      launchable_single_seller: launchable.filter((r) => r.distinct_reputable_sellers < 2).length,
      average_usd_quantiles: quantiles(avg, [0.25, 0.5, 0.75, 0.9]),
      items_ge_5_usd: avg.filter((x) => x >= 5).length,
      items_ge_50_usd: avg.filter((x) => x >= 50).length,
    },
    samples: SAMPLES.map((slug) => pricedRows.find((r) => r.slug === slug) ?? { slug, priced: false, listed_now: offersBySlug.get(slug) ?? 0, catalogue: !!bySlug.get(slug) }),
    most_expensive: [...launchable].sort((a, b) => b.average_usd - a.average_usd).slice(0, 15),
    unmatched_names: plan.unmatched.slice(0, 100),
  }

  const out = val('out', `data/${game === 'murder-mystery-2' ? 'mm2' : game}-dryrun/${new Date().toISOString().slice(0, 10)}.json`)
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ matching: report.matching, pricing: { ...report.pricing, policy: undefined }, samples: report.samples }, null, 2))
  console.log(`-> ${out}`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
