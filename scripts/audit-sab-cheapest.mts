/**
 * Full-catalog cheapest audit.
 * ============================================================================
 * Runs the reputable engine over EVERY brainrot's current active listings, for
 * the default variant AND every mutation, using the exact cron filter. For each
 * priced variant it prints the cheapest + the raw reputable prices that fed it,
 * and FLAGS anything that looks off so you can eyeball 500 brainrots fast:
 *
 *   LONE   cheapest sits >SUPPORT_RATIO under its next listing (should've been
 *          skipped — a support-rule miss)
 *   LADDER a mutation's cheapest is BELOW the default's (mutations cost more)
 *   THIN   priced off exactly the minimum listings (fragile)
 *   WIDE   cheapest→market spread > 2.5x (mixed tiers?)
 *
 *   npx tsx scripts/audit-sab-cheapest.mts               # summary + flags
 *   npx tsx scripts/audit-sab-cheapest.mts --all         # every priced variant
 *   npx tsx scripts/audit-sab-cheapest.mts --item skibidi # one brainrot, verbose
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  reputablePrice,
  CHEAPEST_SUPPORT_RATIO,
  REPUTABLE_MIN_LISTINGS,
  type ReputableListing,
} from '../src/lib/sab/reputable-pricing.ts'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {}
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const COSMETIC_RE = /\btaco\b/i
const PAGE = 1000
const WIDE_SPREAD = 2.5

const args = process.argv.slice(2)
const showAll = args.includes('--all')
const onlyItem = args.includes('--item')
  ? args[args.indexOf('--item') + 1]?.toLowerCase()
  : null

async function all<T>(table: string, cols: string, filter?: (q: any) => any) {
  const rows: T[] = []
  for (let p = 0; ; p++) {
    let q = (sb as any).from(table).select(cols)
    if (filter) q = filter(q)
    const { data, error } = await q.range(p * PAGE, p * PAGE + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

type Raw = {
  brainrot_id: string
  mutation_id: string
  unit_price_usd: number | string
  raw_payload: { seller_sales_count?: number | string; title?: string } | null
  listing_status: string
  parse_status: string
  is_bundle: boolean | null
  is_account_listing: boolean | null
  is_inventory_listing: boolean | null
  is_duplicate: boolean | null
  is_outlier: boolean | null
  rejection_reason: string | null
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function main() {
  const [brainrots, mutations, raw] = await Promise.all([
    all<{ id: string; name: string; slug: string }>(
      'sab_brainrots',
      'id,name,slug',
    ),
    all<{ id: string; slug: string }>('sab_mutations', 'id,slug'),
    all<Raw>(
      'sab_market_raw_listings',
      'brainrot_id,mutation_id,unit_price_usd,raw_payload,listing_status,parse_status,is_bundle,is_account_listing,is_inventory_listing,is_duplicate,is_outlier,rejection_reason',
      (q) => q.eq('listing_status', 'active'),
    ),
  ])

  const brById = new Map(brainrots.map((b) => [b.id, b]))
  const mutSlug = new Map(mutations.map((m) => [m.id, m.slug]))
  const defaultMutId = mutations.find((m) => m.slug === 'default')!.id

  // Group active, clean, reviewed listings by brainrot:mutation (cron filter).
  const byVariant = new Map<string, ReputableListing[]>()
  for (const r of raw) {
    if (r.parse_status !== 'matched') continue
    if (
      r.is_bundle ||
      r.is_account_listing ||
      r.is_inventory_listing ||
      r.is_duplicate ||
      r.is_outlier ||
      r.rejection_reason
    )
      continue
    if (COSMETIC_RE.test(r.raw_payload?.title ?? '')) continue
    const price = num(r.unit_price_usd)
    const reviews = num(r.raw_payload?.seller_sales_count)
    if (price == null || price <= 0 || reviews == null) continue
    const key = `${r.brainrot_id}:${r.mutation_id}`
    const list = byVariant.get(key) ?? []
    list.push({ priceUsd: price, reviews })
    byVariant.set(key, list)
  }

  let priced = 0
  const flags: string[] = []
  // Track default cheapest per brainrot for the ladder check.
  const defaultCheapest = new Map<string, number>()

  // First pass: defaults, so the ladder check has them.
  for (const [key, listings] of byVariant) {
    const [bid, mid] = key.split(':')
    if (mid !== defaultMutId) continue
    const p = reputablePrice(listings)
    if (p) defaultCheapest.set(bid, p.cheapestUsd)
  }

  const lines: string[] = []
  for (const [key, listings] of byVariant) {
    const [bid, mid] = key.split(':')
    const br = brById.get(bid)
    if (!br) continue
    if (onlyItem && !br.slug.includes(onlyItem) && !br.name.toLowerCase().includes(onlyItem))
      continue
    const p = reputablePrice(listings)
    if (!p) continue
    priced++

    const slug = mutSlug.get(mid) ?? '?'
    const sorted = [...listings.map((l) => l.priceUsd)].sort((a, b) => a - b)
    const label = `${br.name} · ${slug}`

    // FLAGS
    const itemFlags: string[] = []
    // LONE: is the cheapest well above the actual lowest listing? (support kicked in — good) —
    // OR is the printed cheapest STILL lone (support missed)? Check the neighbour.
    const ci = sorted.indexOf(p.cheapestUsd)
    if (ci >= 0 && ci < sorted.length - 1) {
      const ratio = sorted[ci + 1] / sorted[ci]
      if (ratio > CHEAPEST_SUPPORT_RATIO && sorted.length >= 3)
        itemFlags.push('LONE')
    }
    // LADDER: a mutation priced below the default.
    if (mid !== defaultMutId) {
      const dc = defaultCheapest.get(bid)
      if (dc != null && p.cheapestUsd < dc - 0.005) itemFlags.push('LADDER')
    }
    // THIN: exactly the minimum reputable listings.
    if (p.reputableCount <= REPUTABLE_MIN_LISTINGS) itemFlags.push('THIN')
    // WIDE: cheapest→market spread big (mixed tiers).
    if (p.averageUsd / p.cheapestUsd > WIDE_SPREAD) itemFlags.push('WIDE')

    const flagStr = itemFlags.length ? `  ⚠ ${itemFlags.join(',')}` : ''
    const row = `  ${label.padEnd(40)} cheapest $${p.cheapestUsd} · market $${p.averageUsd} · n=${p.reputableCount}${flagStr}`
    if (itemFlags.length) flags.push(`${row}\n      prices: ${JSON.stringify(sorted.slice(0, 10))}`)
    if (showAll || onlyItem) lines.push(row)
  }

  if (showAll || onlyItem) {
    lines.sort()
    console.log(lines.join('\n'))
    console.log('')
  }

  console.log(`\n=== AUDIT: ${priced} priced variants across the catalog ===`)
  console.log(`Flagged: ${flags.length}`)
  if (flags.length) {
    console.log('\n(LONE=support miss · LADDER=mutation<default · THIN=min listings · WIDE=spread>2.5x)\n')
    console.log(flags.slice(0, 60).join('\n'))
    if (flags.length > 60) console.log(`\n… and ${flags.length - 60} more flags`)
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message)
  process.exit(1)
})
