/**
 * Cash importer — Eldorado listings feed -> adopt_me_pet_values.cash_value_usd
 * ============================================================================
 * Raw marketplace medians are NOISY: mislabeled bundles, toys named after the
 * pet ("Shadow Dragon Ducky"), and troll prices sit in the same search results
 * as real listings. The collector already strips toys/bundles by title; here we
 * add two more defenses before trusting a number:
 *
 *   1. IQR outlier trim per (pet, variant) — drop points outside
 *      [Q1 - 1.5·IQR, Q3 + 1.5·IQR].
 *   2. Minimum sample count (default 3) — fewer stays an estimate.
 *   3. Ladder sanity — reject a lower-rank variant that prices ABOVE a higher
 *      one (Normal > Fly Ride = leftover mislabeled noise).
 *   4. Median of survivors; confidence from surviving count; is_estimated=false.
 *
 * A variant with too few clean samples keeps its existing derived/estimated
 * value untouched — we never overwrite a sensible estimate with a fluke.
 *
 *   node scripts/import-adoptme-cash.mjs [feed.json]          # dry run
 *   node scripts/import-adoptme-cash.mjs [feed.json] --write  # persist
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

const MIN_SAMPLES = Number(process.env.CASH_MIN_SAMPLES ?? 3)

// Ladder rank — higher = more valuable. Used to reject a variant whose median
// lands implausibly above a higher form.
const LADDER_RANK = { N: 0, F: 1, R: 1, FR: 2, NEON: 3, NFR: 4, MEGA: 5, MFR: 6 }

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base]
}

function trimOutliers(prices) {
  if (prices.length < 4) return [...prices].sort((a, b) => a - b)
  const sorted = [...prices].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  return sorted.filter((p) => p >= lo && p <= hi)
}

function median(sorted) {
  const n = sorted.length
  if (n === 0) return null
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

// Fraction of the cluster median below which a listing is treated as a fake and
// dropped. A $0.67 listing in a $300 cluster (0.2%) is a scam, not a deal.
const ABSURD_LOW_FRACTION = Number(process.env.CASH_ABSURD_LOW_FRACTION ?? 0.25)

/**
 * Drop listings priced absurdly below the cluster median — the fake-cheap scam
 * pattern. Uses the median as the reference (robust to the fakes themselves),
 * then removes anything below ABSURD_LOW_FRACTION × median. No-op for tiny
 * clusters (< 4) where a median isn't meaningful.
 */
function dropAbsurdLow(prices) {
  if (prices.length < 4) return [...prices]
  const sorted = [...prices].sort((a, b) => a - b)
  const med = median(sorted)
  if (med == null || med <= 0) return sorted
  const floor = med * ABSURD_LOW_FRACTION
  return sorted.filter((p) => p >= floor)
}

/**
 * The "cheapest you can realistically get it for" price — NOT the average.
 * A buyer cares about the low end of real listings. We use ~P10 of the
 * outlier-trimmed, title-confirmed prices, but guard small samples so one lucky
 * troll-low listing can't set the price:
 *   n >= 8  -> 10th percentile
 *   n 4-7   -> 2nd-lowest (skip the single cheapest, take the next)
 *   n <= 3  -> the minimum
 * `sorted` is already ascending and outlier-trimmed.
 */
function lowEndPrice(sorted) {
  const n = sorted.length
  if (n === 0) return null
  if (n >= 8) return quantile(sorted, 0.1)
  if (n >= 4) return sorted[1] // 2nd-lowest
  return sorted[0] // minimum
}

function confidenceFor(n) {
  if (n >= 25) return 'highly_accurate'
  if (n >= 10) return 'high'
  if (n >= 3) return 'medium'
  return 'low'
}

// The cash feeds to pool. Any that exist are merged; a single median is taken
// across ALL sources per pet+variant (one evaluated price, not per-source).
const DEFAULT_FEEDS = [
  'data/adopt-me-feeds/eldorado-cash-latest.json',
  'data/adopt-me-feeds/u7buy-cash-latest.json',
]

function readFeedIfExists(path) {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const explicit = args.filter((a) => !a.startsWith('--'))
  const feedPaths = explicit.length ? explicit : DEFAULT_FEEDS

  const feeds = feedPaths.map(readFeedIfExists).filter(Boolean)
  if (!feeds.length) {
    console.error('No cash feeds found. Run a collector first.')
    process.exit(1)
  }

  const totalListings = feeds.reduce((n, f) => n + (f.listing_count ?? f.listings.length), 0)
  console.log(
    `Cash importer — pooling ${feeds.length} source(s): ${feeds.map((f) => `${f.source}(${f.listings.length})`).join(', ')}`,
  )
  console.log(`  ${totalListings} listings total · min samples=${MIN_SAMPLES}  ${write ? 'MODE: --write' : 'MODE: dry run'}\n`)

  // Pool prices from ALL feeds, grouped by pet -> variant. DEDUP identical
  // (seller + title + price) copies so one seller spamming N identical listings
  // (the classic fake pattern) counts ONCE, not N times.
  const byPet = new Map() // slug -> Map(variant -> number[])
  const seen = new Set()
  let deduped = 0
  for (const feed of feeds) {
    for (const l of feed.listings) {
      const key = `${l.sellerId ?? '?'}|${(l.title ?? '').trim().toLowerCase()}|${l.priceUsd}`
      if (seen.has(key)) {
        deduped++
        continue
      }
      seen.add(key)
      const m = byPet.get(l.slug) ?? new Map()
      const arr = m.get(l.variant) ?? []
      arr.push(l.priceUsd)
      m.set(l.variant, arr)
      byPet.set(l.slug, m)
    }
  }
  if (deduped) console.log(`  (deduped ${deduped} identical seller/title/price copies)\n`)

  const { data: pets } = await sb.from('adopt_me_pets').select('id,slug')
  const idBySlug = new Map((pets ?? []).map((p) => [p.slug, p.id]))

  let priced = 0
  let tooFew = 0
  let rejected = 0
  const nowIso = new Date().toISOString()

  for (const [slug, variantMap] of byPet) {
    const petId = idBySlug.get(slug)
    if (!petId) continue

    // 1. Median each variant after (a) a cluster-relative floor that drops any
    //    listing priced absurdly below the cluster median — a $0.67 listing in a
    //    $300 cluster is a fake, not a deal — then (b) an IQR outlier trim, then
    //    (c) the low-end price of what survives.
    const computed = new Map() // variant -> { value, n, raw }
    for (const [variant, rawPrices] of variantMap) {
      const clean = dropAbsurdLow(rawPrices)
      const kept = trimOutliers(clean)
      const med = lowEndPrice(kept)
      if (kept.length < MIN_SAMPLES || med == null) {
        tooFew++
        continue
      }
      computed.set(variant, {
        value: Math.round(med * 100) / 100,
        n: kept.length,
        raw: rawPrices.length,
      })
    }

    // 2. Ladder sanity — drop a lower-rank variant priced above the top one.
    const anchor = [...computed.entries()]
      .filter(([v]) => LADDER_RANK[v] != null)
      .sort((a, b) => LADDER_RANK[b[0]] - LADDER_RANK[a[0]])[0]
    if (anchor) {
      for (const [variant, info] of [...computed.entries()]) {
        if (LADDER_RANK[variant] < LADDER_RANK[anchor[0]] && info.value > anchor[1].value * 1.05) {
          computed.delete(variant)
          rejected++
          console.log(`  !! ${slug}/${variant} rejected ($${info.value} > ${anchor[0]} $${anchor[1].value})`)
        }
      }
    }

    // 3. Persist survivors.
    for (const [variant, info] of computed) {
      const confidence = confidenceFor(info.n)
      const label = `  ${write ? 'OK' : 'dry'} ${slug}/${variant}`.padEnd(34)
      if (!write) {
        console.log(label, `n=${info.raw}->${info.n}  $${info.value}  ${confidence}`)
        priced++
        continue
      }
      const { error } = await sb
        .from('adopt_me_pet_values')
        .update({
          cash_value_usd: info.value,
          listings_tracked: info.n,
          confidence,
          is_estimated: false,
          last_priced_at: nowIso,
        })
        .eq('pet_id', petId)
        .eq('variant', variant)
      if (error) console.error(`  XX ${slug}/${variant}: ${error.message}`)
      else {
        console.log(label, `n=${info.raw}->${info.n}  $${info.value}  ${confidence}`)
        priced++
      }
    }
  }

  console.log(
    `\n${write ? 'Priced' : 'Would price'}: ${priced} pet-variants. ` +
      `${tooFew} too few samples, ${rejected} rejected (ladder). Untouched variants keep their estimate.`,
  )
  if (!write) console.log('Re-run with --write to persist.')
}

main().catch((err) => {
  console.error('\n❌ Cash importer failed:', err.message)
  process.exit(1)
})
