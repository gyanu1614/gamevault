/**
 * SAB price-drift monitor.
 * ============================================================================
 * Independent check that the PUBLISHED reputable cheapest still matches what the
 * reputable engine computes from the CURRENT active listings. Catches drift from
 * any cause — a late import, a second writer, a logic regression, a missed cron
 * run — instead of relying on someone eyeballing a product page (which is how
 * the Elefanto Frigo $259.99-vs-$248 staleness was found).
 *
 * Writes nothing. Reports the count of drifted items + the worst offenders, and
 * exits non-zero when any drift is found (so CI / a cron can alert on it).
 *
 * Uses the SAME filter the correction cron applies (active + matched + not
 * bundle/account/dupe/outlier/rejected + has reviews + not Taco), so the check
 * and the computer can't disagree by construction.
 *
 *   node scripts/check-sab-price-drift.mjs            # report + exit code
 *   node scripts/check-sab-price-drift.mjs --top 20   # show more offenders
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { reputablePrice } from '../src/lib/sab/reputable-pricing.ts'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {
    // CI supplies env vars directly.
  }
}
loadEnv()

const COSMETIC_TRAIT_RE = /\btaco\b/i
const PAGE_SIZE = 1000
/** How far apart stored vs recomputed cheapest may be before it's "drift". */
const DRIFT_TOLERANCE_USD = 0.01

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function toNumber(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function selectAll(table, columns, filter) {
  const rows = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    let q = sb.from(table).select(columns)
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

async function main() {
  const topN = Number(
    process.argv.includes('--top')
      ? process.argv[process.argv.indexOf('--top') + 1]
      : 12,
  )

  // Current published reputable corrections.
  const corrections = await selectAll(
    'sab_price_corrections',
    'brainrot_id,mutation_id,cheapest_usd,reason',
    (q) => q.eq('reason', 'reputable'),
  )

  // All active raw listings, grouped by variant with the cron's exact filter.
  const rawListings = await selectAll(
    'sab_market_raw_listings',
    'brainrot_id,mutation_id,unit_price_usd,raw_payload,listing_status,parse_status,is_bundle,is_account_listing,is_inventory_listing,is_duplicate,is_outlier,rejection_reason',
    (q) => q.eq('listing_status', 'active'),
  )

  const byVariant = new Map()
  for (const row of rawListings) {
    if (row.parse_status !== 'matched') continue
    if (
      row.is_bundle ||
      row.is_account_listing ||
      row.is_inventory_listing ||
      row.is_duplicate ||
      row.is_outlier ||
      row.rejection_reason
    ) {
      continue
    }
    if (COSMETIC_TRAIT_RE.test(row.raw_payload?.title ?? '')) continue
    const price = toNumber(row.unit_price_usd)
    if (price == null || price <= 0) continue
    const reviews = toNumber(row.raw_payload?.seller_sales_count)
    if (reviews == null) continue
    const key = `${row.brainrot_id}:${row.mutation_id}`
    const list = byVariant.get(key) ?? []
    list.push({ priceUsd: price, reviews })
    byVariant.set(key, list)
  }

  const drift = []
  for (const c of corrections) {
    const key = `${c.brainrot_id}:${c.mutation_id}`
    const fresh = reputablePrice(byVariant.get(key) ?? [])
    // A published reputable row whose current listings no longer yield a
    // reputable price (all sold/vanished) is also drift worth surfacing.
    const freshCheapest = fresh?.cheapestUsd ?? null
    const stored = toNumber(c.cheapest_usd)
    if (
      freshCheapest == null ||
      stored == null ||
      Math.abs(freshCheapest - stored) > DRIFT_TOLERANCE_USD
    ) {
      drift.push({
        brainrot_id: c.brainrot_id,
        mutation_id: c.mutation_id,
        stored,
        fresh: freshCheapest,
      })
    }
  }

  console.log(
    `Checked ${corrections.length} reputable items · ${drift.length} drifted (stored cheapest ≠ recomputed).`,
  )

  if (drift.length) {
    // Name the worst offenders (largest absolute gap first).
    const ids = [...new Set(drift.map((d) => d.brainrot_id))]
    const names = new Map()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await sb
        .from('sab_brainrots')
        .select('id,name')
        .in('id', ids.slice(i, i + 200))
      for (const r of data ?? []) names.set(r.id, r.name)
    }
    const ranked = drift
      .map((d) => ({
        ...d,
        gap: Math.abs((d.fresh ?? 0) - (d.stored ?? 0)),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, topN)
    console.log(`\nWorst ${ranked.length}:`)
    for (const d of ranked) {
      const name = names.get(d.brainrot_id) ?? d.brainrot_id
      console.log(
        `  ${String(name).padEnd(26)} stored $${d.stored} → should be ${d.fresh == null ? 'no reputable price' : `$${d.fresh}`}`,
      )
    }
    console.log(
      '\nDrift means the published cheapest is stale — re-run correct-prices?game=sab.',
    )
    process.exitCode = 1
  } else {
    console.log('✅ No drift — every published cheapest matches current listings.')
  }
}

main().catch((error) => {
  console.error('Drift check failed:', error.message)
  process.exit(2)
})
