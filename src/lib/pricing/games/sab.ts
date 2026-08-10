/**
 * SAB correction — DB read/write around the SAB accuracy layer.
 *
 * Extracted verbatim from the old correct-sab-prices route so both the unified
 * correct-prices cron and the legacy /api/cron/correct-sab-prices route can run
 * the exact same logic. Behaviour is unchanged.
 *
 * Recomputes: minimum-evidence suppression, cohort anchoring for thin samples,
 * empirically measured mutation multipliers, and the reputable cheapest/average
 * split. Writes sab_price_corrections + sab_mutation_price_multipliers and
 * reconciles today's price-history row.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  computeCorrections,
  measureMutationMultipliers,
  type BrainrotMeta,
  type SourcedPrice,
  type VariantEstimate,
  type ReputableListing,
} from '@/lib/sab/price-correction'

const PAGE_SIZE = 1000

/**
 * Negative cosmetic traits that make a brainrot LESS desirable and cheaper,
 * despite the same (or higher) income. "Taco" is such a trait on Dragon
 * Cannelloni — a $16 Taco listing is a different, uglier item than the clean
 * pet, so it must not set the clean pet's CHEAPEST (buyers would think they can
 * get a normal one for $16). Title-only on Eldorado (no structured attribute),
 * so matched by keyword. We do NOT delete these listings — they stay in the raw
 * data — they are just excluded from the reputable cheapest/market so the
 * headline price reflects a clean pet.
 */
const COSMETIC_TRAIT_RE = /\btaco\b/i

type CatalogRow = {
  brainrot_id: string
  mutation_id: string
  mutation_slug: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  confidence_label: string | null
  external_sample_size: number | null
  source_count: number | null
}

type BrainrotRow = {
  id: string
  rarity: string | null
  ingame_cost: number | string | null
  base_income_per_second: number | string | null
  obtainability: string | null
}

type EvidenceRow = {
  brainrot_id: string
  mutation_id: string
  unit_price_usd: number | string | null
  source_slug: string | null
}

type ReputableRow = {
  brainrot_id: string
  mutation_id: string
  unit_price_usd: number | string | null
  raw_payload: {
    seller_sales_count?: number | string | null
    title?: string | null
  } | null
  listing_status: string | null
  parse_status: string | null
  is_bundle: boolean | null
  is_account_listing: boolean | null
  is_inventory_listing: boolean | null
  is_duplicate: boolean | null
  is_outlier: boolean | null
  rejection_reason: string | null
}

type MutationRow = {
  slug: string
  income_multiplier: number | string | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function selectAll<T>(
  client: ReturnType<typeof createServiceRoleClient>,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await (client as any)
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

export async function runSabCorrection(): Promise<Record<string, unknown>> {
  const admin = createServiceRoleClient()
  const startedAt = new Date().toISOString()

  const [catalog, mutations, brainrots, evidence, rawListings] =
    await Promise.all([
      selectAll<CatalogRow>(
        admin,
        'sab_public_price_catalog',
        'brainrot_id,mutation_id,mutation_slug,market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,source_count',
      ),
      selectAll<MutationRow>(admin, 'sab_mutations', 'slug,income_multiplier'),
      selectAll<BrainrotRow>(
        admin,
        'sab_brainrots',
        'id,rarity,ingame_cost,base_income_per_second,obtainability',
      ),
      selectAll<EvidenceRow>(
        admin,
        'sab_market_clean_listing_evidence',
        'brainrot_id,mutation_id,unit_price_usd,source_slug',
      ),
      selectAll<ReputableRow>(
        admin,
        'sab_market_raw_listings',
        'brainrot_id,mutation_id,unit_price_usd,raw_payload,listing_status,parse_status,is_bundle,is_account_listing,is_inventory_listing,is_duplicate,is_outlier,rejection_reason',
      ),
    ])

  const multiplierBySlug = new Map<string, number>()
  for (const row of mutations) {
    const multiplier = toNumber(row.income_multiplier)
    if (multiplier != null) multiplierBySlug.set(row.slug, multiplier)
  }

  const pricesByVariant = new Map<string, number[]>()
  const sourcedByVariant = new Map<string, SourcedPrice[]>()
  for (const row of evidence) {
    const price = toNumber(row.unit_price_usd)
    if (price == null || price <= 0) continue
    const key = `${row.brainrot_id}:${row.mutation_id}`
    const list = pricesByVariant.get(key)
    if (list) list.push(price)
    else pricesByVariant.set(key, [price])

    if (row.source_slug) {
      const sourced = sourcedByVariant.get(key)
      const entry = { price, source: row.source_slug }
      if (sourced) sourced.push(entry)
      else sourcedByVariant.set(key, [entry])
    }
  }

  const reputableByVariant = new Map<string, ReputableListing[]>()
  for (const row of rawListings) {
    if (row.listing_status !== 'active') continue
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
    // Skip negative-cosmetic-trait listings (Taco): a cheaper, uglier item that
    // must not set the clean pet's cheapest. Kept in raw data, just not priced.
    if (COSMETIC_TRAIT_RE.test(row.raw_payload?.title ?? '')) continue
    const price = toNumber(row.unit_price_usd)
    if (price == null || price <= 0) continue
    const reviews = toNumber(row.raw_payload?.seller_sales_count)
    if (reviews == null || !Number.isFinite(reviews)) continue

    const key = `${row.brainrot_id}:${row.mutation_id}`
    const entry = { priceUsd: price, reviews }
    const list = reputableByVariant.get(key)
    if (list) list.push(entry)
    else reputableByVariant.set(key, [entry])
  }

  const metas: BrainrotMeta[] = brainrots.map((row) => ({
    brainrotId: row.id,
    rarity: row.rarity,
    ingameCost: toNumber(row.ingame_cost),
    incomePerSecond: toNumber(row.base_income_per_second),
    obtainability: row.obtainability,
  }))

  const variants: VariantEstimate[] = catalog.map((row) => ({
    brainrotId: row.brainrot_id,
    mutationId: row.mutation_id,
    mutationSlug: row.mutation_slug,
    valueUsd: toNumber(row.market_value_usd),
    lowUsd: toNumber(row.market_low_usd),
    highUsd: toNumber(row.market_high_usd),
    sampleCount: row.external_sample_size ?? 0,
    sourceCount: row.source_count ?? 0,
    isReviewed: row.confidence_label === 'reviewed',
    listingPrices:
      pricesByVariant.get(`${row.brainrot_id}:${row.mutation_id}`) ?? [],
    sourcedListingPrices:
      sourcedByVariant.get(`${row.brainrot_id}:${row.mutation_id}`) ??
      undefined,
    reputableListings:
      reputableByVariant.get(`${row.brainrot_id}:${row.mutation_id}`) ??
      undefined,
    incomeMultiplier: multiplierBySlug.get(row.mutation_slug) ?? undefined,
  }))

  const corrections = computeCorrections({ brainrots: metas, variants })
  const multipliers = measureMutationMultipliers(variants)

  const rows = corrections.map((correction) => ({
    brainrot_id: correction.brainrotId,
    mutation_id: correction.mutationId,
    value_usd: correction.valueUsd,
    low_usd: correction.lowUsd,
    high_usd: correction.highUsd,
    original_value_usd: correction.originalValueUsd,
    reason: correction.reason,
    confidence_label: correction.confidence,
    anchor_usd: correction.anchorUsd,
    cohort_size: correction.cohortSize,
    sample_count: correction.sampleCount,
    is_anchored: correction.isAnchored,
    is_publishable: correction.isPublishable,
    cheapest_usd: correction.cheapestUsd,
    average_usd: correction.averageUsd,
    computed_at: startedAt,
  }))

  for (let index = 0; index < rows.length; index += PAGE_SIZE) {
    const batch = rows.slice(index, index + PAGE_SIZE)
    const { error } = await (admin as any)
      .from('sab_price_corrections')
      .upsert(batch, { onConflict: 'brainrot_id,mutation_id' })
    if (error) throw new Error(`upsert corrections: ${error.message}`)
  }

  const { error: pruneError } = await (admin as any)
    .from('sab_price_corrections')
    .delete()
    .lt('computed_at', startedAt)
  if (pruneError) console.error('Failed to prune stale corrections:', pruneError)

  const multiplierRows = [...multipliers.entries()].map(
    ([mutation_slug, measured]) => ({
      mutation_slug,
      price_multiplier: Math.round(measured.multiplier * 1000) / 1000,
      pair_count: measured.pairCount,
      computed_at: startedAt,
    }),
  )

  if (multiplierRows.length) {
    const { error: multiplierError } = await (admin as any)
      .from('sab_mutation_price_multipliers')
      .upsert(multiplierRows, { onConflict: 'mutation_slug' })
    if (multiplierError) {
      console.error('Failed to upsert mutation multipliers:', multiplierError)
    }
  }

  const historyDate = startedAt.slice(0, 10)
  const historyRows = corrections
    .filter((c) => c.isPublishable && c.valueUsd != null)
    .map((correction) => ({
      brainrot_id: correction.brainrotId,
      mutation_id: correction.mutationId,
      history_date: historyDate,
      median_usd: correction.valueUsd,
      low_usd: correction.lowUsd ?? correction.valueUsd,
      high_usd: correction.highUsd ?? correction.valueUsd,
      confidence_label: correction.confidence,
    }))

  let historyReconciled = 0
  for (let index = 0; index < historyRows.length; index += PAGE_SIZE) {
    const batch = historyRows.slice(index, index + PAGE_SIZE)
    const { error } = await (admin as any)
      .from('sab_price_history')
      .upsert(batch, { onConflict: 'brainrot_id,mutation_id,history_date' })
    if (error) {
      console.error('Failed to reconcile SAB price history:', error)
      break
    }
    historyReconciled += batch.length
  }

  const summary = corrections.reduce<Record<string, number>>(
    (accumulator, correction) => {
      accumulator[correction.reason] =
        (accumulator[correction.reason] ?? 0) + 1
      return accumulator
    },
    {},
  )

  const suppressed = corrections.filter((c) => !c.isPublishable).length
  const anchored = corrections.filter((c) => c.isAnchored).length

  console.log(
    `✅ SAB corrections: ${corrections.length} rows, ${anchored} anchored, ${suppressed} suppressed`,
  )

  // Recompute the curated crawl set (is_tradeable) from the fresh corrections —
  // the collector crawls only these, so a rising item is picked up next cycle
  // and a dead one drops out, with no manual editing. Non-fatal: a stale flag
  // for one cycle is cosmetic next to the corrections that already landed.
  let tradeableUpdated = 0
  const { data: tradeableCount, error: tradeableError } = await (admin as any).rpc(
    'sab_recompute_tradeable',
  )
  if (tradeableError) {
    console.error('Failed to recompute is_tradeable:', tradeableError)
  } else {
    tradeableUpdated = Number(tradeableCount ?? 0)
  }

  return {
    corrected: corrections.length,
    anchored,
    suppressed,
    multipliers: multiplierRows.length,
    history_reconciled: historyReconciled,
    tradeable_updated: tradeableUpdated,
    breakdown: summary,
  }
}
