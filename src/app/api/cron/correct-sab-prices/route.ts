/**
 * Daily SAB price correction cron.
 *
 * Recomputes the accuracy layer that sits over the raw market estimates:
 * minimum-evidence suppression, cohort anchoring for thin samples, and the
 * empirically measured mutation price multipliers. Results land in
 * sab_price_corrections / sab_mutation_price_multipliers, which
 * sab_public_price_catalog_corrected merges over the raw catalog.
 *
 * Why a cron rather than computing at read time: anchoring an item needs the
 * whole catalog (its cohort), so doing it per request would mean loading 3.4k
 * rows on every page render. Cohorts move slowly; daily is ample.
 *
 * Scheduled at 10:00 UTC (see vercel.json) — after the 09:23 UTC market import
 * lands, so each run corrects that morning's fresh data.
 *
 * Idempotent: safe to re-run at any time, and re-running after a failed run
 * fully repairs the table.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  computeCorrections,
  measureMutationMultipliers,
  type BrainrotMeta,
  type SourcedPrice,
  type VariantEstimate,
  type ReputableListing,
} from '@/lib/sab/price-correction'

// No fallback — fail closed so a missing secret can't be triggered with a
// known default token.
const CRON_SECRET = process.env.CRON_SECRET

const PAGE_SIZE = 1000

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
  /** Eldorado ratingCount — total seller reviews; the reputable gate. */
  seller_sales_count: number | null
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

/**
 * PostgREST caps a plain select at 1000 rows and returns the truncated set
 * WITHOUT an error — silently corrupting a whole-catalog computation. Always
 * page.
 */
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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    const startedAt = new Date().toISOString()

    // Read the PUBLISHED catalog, not the raw estimate view: this layer must
    // correct what users actually see, which already prefers verified prices.
    // Also read the cleaned per-listing evidence — the IQR-fenced individual
    // prices behind each variant — so the floor ("cheapest you can actually buy
    // at") can be computed from real listings rather than the median blend.
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
        'id,rarity,ingame_cost,base_income_per_second',
      ),
      selectAll<EvidenceRow>(
        admin,
        'sab_market_clean_listing_evidence',
        'brainrot_id,mutation_id,unit_price_usd,source_slug',
      ),
      // Active raw listings carry the per-seller review count (seller_sales_count
      // = Eldorado ratingCount) that the reputable-pricing model gates on. The
      // clean evidence view doesn't expose it, so read the raw listings directly.
      selectAll<ReputableRow>(
        admin,
        'sab_market_raw_listings',
        'brainrot_id,mutation_id,unit_price_usd,seller_sales_count,listing_status,parse_status,is_bundle,is_account_listing,is_inventory_listing,is_duplicate,is_outlier,rejection_reason',
      ),
    ])

    // Mutation slug → income multiplier, the value-ladder ordering for the
    // ladder sanity check.
    const multiplierBySlug = new Map<string, number>()
    for (const row of mutations) {
      const multiplier = toNumber(row.income_multiplier)
      if (multiplier != null) multiplierBySlug.set(row.slug, multiplier)
    }

    // Group cleaned listing prices by (brainrot, mutation) so each variant can
    // read its own floor candidates in O(1). Keep both a plain price list (for
    // the range clamp and the fallback floor) and a source-tagged list, so the
    // floor can be computed source-trust-aware — an unverifiable cheap cluster
    // (G2G/Itemku) must not set the price below the verified Eldorado market.
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

    // Group ACTIVE, clean raw listings that carry a seller review count into
    // {price, reviews} per variant — the input to the reputable-pricing model.
    // Only listings that pass the same cleanliness filters the evidence view
    // applies (active, matched, not bundle/account/dupe/outlier/rejected) count,
    // so a fake/bundle can't slip in through this path. Listings without a review
    // count (G2G/Itemku, or pre-collector-rerun Eldorado rows) are simply
    // omitted — the variant then falls back to the source-trust floor.
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
      const price = toNumber(row.unit_price_usd)
      if (price == null || price <= 0) continue
      const reviews = row.seller_sales_count
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

    // Upsert everything, then drop rows this run didn't touch. Doing it in that
    // order means a partial failure leaves the previous corrections in place
    // rather than briefly exposing uncorrected prices.
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
      // Reputable-seller split — the buyer-facing cheapest + average. Null on
      // non-reputable paths; both surface on the value pages and the bot.
      cheapest_usd: correction.cheapestUsd,
      average_usd: correction.averageUsd,
      computed_at: startedAt,
    }))

    for (let index = 0; index < rows.length; index += PAGE_SIZE) {
      const batch = rows.slice(index, index + PAGE_SIZE)
      const { error } = await (admin as any)
        .from('sab_price_corrections')
        .upsert(batch, { onConflict: 'brainrot_id,mutation_id' })

      if (error) {
        console.error('Failed to upsert SAB price corrections:', error)
        return NextResponse.json(
          { error: 'Failed to write corrections', details: error.message },
          { status: 500 },
        )
      }
    }

    const { error: pruneError } = await (admin as any)
      .from('sab_price_corrections')
      .delete()
      .lt('computed_at', startedAt)

    if (pruneError) {
      // Stale rows are merged over prices that no longer exist in the catalog,
      // so this is worth surfacing — but the fresh corrections did land.
      console.error('Failed to prune stale corrections:', pruneError)
    }

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
        console.error(
          'Failed to upsert mutation multipliers:',
          multiplierError,
        )
      }
    }

    // Reconcile TODAY's price-history row with the corrected value.
    //
    // sab_capture_price_history() reads the RAW catalog, so the 06:00 snapshot
    // records uncorrected numbers. That is how Spyder Elephant ended up showing
    // a $292.65 headline above a trend chart plotted from $9.98 — the price
    // moved and its own history didn't follow. This job runs after that
    // snapshot, so it can restate the same day with the number users are
    // actually shown.
    //
    // ONLY today. Earlier days are left alone: those rows record what the site
    // displayed at the time, and rewriting them would turn a price history into
    // a work of fiction.
    const historyDate = startedAt.slice(0, 10)

    const historyRows = corrections
      .filter((correction) => correction.isPublishable && correction.valueUsd != null)
      .map((correction) => ({
        brainrot_id: correction.brainrotId,
        mutation_id: correction.mutationId,
        history_date: historyDate,
        median_usd: correction.valueUsd,
        // NOT NULL columns: fall back to the median when a correction carries
        // no range (a single-point range is what n=1 looks like anyway).
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
        // Non-fatal: the catalog corrections already landed, and a stale trend
        // chart is a cosmetic problem next to a wrong headline price.
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

    return NextResponse.json({
      success: true,
      corrected: corrections.length,
      anchored,
      suppressed,
      multipliers: multiplierRows.length,
      history_reconciled: historyReconciled,
      breakdown: summary,
    })
  } catch (error: any) {
    console.error('Unexpected error in correct-sab-prices cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
