/**
 * SAB correction — DB read/write around the SAB accuracy layer.
 *
 * Extracted verbatim from the old correct-sab-prices route, which is gone. The
 * callers are the runner (scripts/reprice.mjs, the scheduled path) and the
 * manual /api/cron/correct-prices route. Behaviour is unchanged.
 *
 * Recomputes: minimum-evidence suppression, cohort anchoring for thin samples,
 * empirically measured mutation multipliers, and the reputable cheapest/average
 * split. Writes sab_price_corrections + sab_mutation_price_multipliers and
 * reconciles today's price-history row.
 */

import { publishSabMarketEstimates } from './sab-publish'
import { loadSabRepriceInputs } from './sab-inputs'
import { selectAllByKey } from '@/lib/db/select-all-by-key'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { RepriceOptions, RepriceResult } from '@/lib/pricing/registry'
import type { PublishedPrice } from '@/lib/pricing/change-rule'
import {
  SAB_PIPELINE_LOCK,
  defaultHolder,
  withPipelineLock,
} from '@/lib/pricing/pipeline-lock'
import {
  keysNeedingRecompute,
  newestObservedByKey,
} from '@/lib/pricing/incremental'
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

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// isRetryableReadError moved to the shared keyset reader; re-exported for
// existing callers (src/lib/sab/expire-listings.ts).
export { isRetryableReadError } from '@/lib/db/select-all-by-key'

/**
 * A manual full reprice took 18 minutes from the owner's machine on 2026-09-19
 * and outlived the runner's own lifetime for this step several times over;
 * the TTL bounds a holder that dies without releasing, nothing more.
 */
const REPRICE_LOCK_TTL_SECONDS = 45 * 60

/**
 * Reprice SAB, holding the pipeline lock for the duration.
 *
 * 2026-09-19 20:04Z: a manual `--full` from the owner's machine overlapped the
 * scheduled crawl's import; the import died on a lock timeout with 10,837
 * listings crawled and not landed, and neither log named the other writer.
 * The lock makes the overlap explicit: whoever comes second queues (up to
 * lockWaitSeconds) behind a named holder, then fails with that name.
 */
export async function runSabCorrection(
  options: RepriceOptions = {},
): Promise<RepriceResult> {
  const admin = createServiceRoleClient()
  const waitSeconds =
    options.lockWaitSeconds ??
    Number(process.env.SAB_PIPELINE_LOCK_WAIT_SECONDS ?? 600)

  return withPipelineLock(
    admin as any,
    {
      name: SAB_PIPELINE_LOCK,
      holder: defaultHolder(options.full ? 'reprice-full' : 'reprice'),
      ttlSeconds: REPRICE_LOCK_TTL_SECONDS,
      waitSeconds: Number.isFinite(waitSeconds) ? waitSeconds : 600,
    },
    () => runSabCorrectionUnlocked(admin, options),
  )
}

async function runSabCorrectionUnlocked(
  admin: ReturnType<typeof createServiceRoleClient>,
  options: RepriceOptions,
): Promise<RepriceResult> {
  const full = options.full === true
  const startedAt = new Date().toISOString()

  // ROUTE-014: refresh the evidence snapshot BEFORE reading it. The crawl
  // refreshes it at the end of every run, so this is the backstop for the case
  // where the last crawl's publish failed — and what makes a manual reprice
  // stand on its own. Refreshing first also means this run corrects against
  // current evidence rather than whatever the last successful crawl left
  // behind.
  //
  // Hard failure, deliberately: correcting prices from a stale snapshot would
  // publish wrong numbers silently, which is the exact failure mode that let the
  // values pages serve an Aug 13 snapshot for a month (ROUTE-010). Better to
  // fail the run and leave the previous corrections in place.
  const { data: evidenceRows, error: evidenceRefreshError } = await (
    admin as any
  ).rpc('sab_refresh_evidence_display')

  if (evidenceRefreshError) {
    throw new Error(
      `sab_refresh_evidence_display failed: ${evidenceRefreshError.message}`,
    )
  }

  const evidenceRefreshed = Number(evidenceRows ?? 0)
  console.log(`✅ sab_market_evidence_display refreshed: ${evidenceRefreshed} rows`)

  // The crawl no longer publishes (--no-publish); this run does, from the
  // evidence it just refreshed. Non-fatal by design — see sab-publish.ts.
  await publishSabMarketEstimates(admin as any)

  const {
    catalog,
    mutations,
    calculator,
    brainrots,
    evidence,
    rawListings,
    existingCorrections,
  } = await loadSabRepriceInputs(admin)

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

  // Canonical income per brainrot+mutation (M/s the real item earns). A listing
  // whose income tier sits meaningfully BELOW this is a weaker mislabeled item
  // and must not set the mutation's cheapest.
  const expectedIncomeByVariant = new Map<string, number>()
  for (const row of calculator) {
    const income = toNumber(row.calculated_income_per_second)
    if (income != null && income > 0) {
      expectedIncomeByVariant.set(`${row.brainrot_id}:${row.mutation_id}`, income)
    }
  }
  // A listing is IN TIER when its income band reaches at least this fraction of
  // the canonical income. 0.9 tolerates coarse band-label boundaries; a 0.75 B/s
  // listing against a 2.6 B/s canonical (band upper 0.999B < 0.9×2.6B=2.34B) is
  // out, while a same-tier or higher-tier listing stays in.
  const TIER_FLOOR_RATIO = 0.9

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
    if (COSMETIC_TRAIT_RE.test(row.payload_title ?? '')) continue
    // Skip listings OUTSIDE the item's canonical income tier — a genuinely weaker
    // item mislabeled under this mutation (a 0.75 B/s "Cyber" Dragon at $17 under
    // the real 2.6 B/s $34 Cyber). Prefer the collector's flag when the import
    // kept it; otherwise DERIVE the tier here from income_band vs the canonical
    // income (the import currently strips the flag, so this derivation is what
    // actually protects cheapest). Only a KNOWN below-tier listing is excluded;
    // when we can't judge (no canonical income, no band) the listing still counts,
    // so we never silently drop legitimate data.
    if (row.payload_canonical_band === 'false') continue
    const expectedIncome = expectedIncomeByVariant.get(
      `${row.brainrot_id}:${row.mutation_id}`,
    )
    const bandUpper = toNumber(row.payload_band_upper)
    if (
      expectedIncome != null &&
      bandUpper != null &&
      bandUpper < expectedIncome * TIER_FLOOR_RATIO
    ) {
      continue
    }
    const price = toNumber(row.unit_price_usd)
    if (price == null || price <= 0) continue
    const reviews = toNumber(row.payload_sales)
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

  // INCREMENTAL WRITES. Everything above this line ran over the FULL input set,
  // because cohort anchoring makes a thin item's price depend on its peers —
  // narrowing the input would change prices. Narrowing the output cannot: an
  // item whose listings have not moved recomputes to the value already stored.
  //
  // `--full` forces every row through (the backfill path).
  const previouslyComputed = new Map<string, string>(
    existingCorrections.map((row) => [
      `${row.brainrot_id}:${row.mutation_id}`,
      row.computed_at ?? '',
    ]),
  )
  const newestObserved = newestObservedByKey(rawListings)
  const needsWrite = full
    ? null
    : keysNeedingRecompute(newestObserved, previouslyComputed)

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

  const rowsToWrite = needsWrite
    ? rows.filter((row) =>
        needsWrite.has(`${row.brainrot_id}:${row.mutation_id}`),
      )
    : rows

  for (let index = 0; index < rowsToWrite.length; index += PAGE_SIZE) {
    const batch = rowsToWrite.slice(index, index + PAGE_SIZE)
    const { error } = await (admin as any)
      .from('sab_price_corrections')
      .upsert(batch, { onConflict: 'brainrot_id,mutation_id' })
    if (error) throw new Error(`upsert corrections: ${error.message}`)
  }

  // Report what the incremental gate actually did, and prove it kept up: right
  // after the writes, no priced key may still have evidence newer than its
  // computed_at. sab_count_unrepriced(0) is the same question the freshness
  // guard asks with a 1h grace; here, with no grace, the answer must be 0.
  // Non-zero means a listing landed DURING this run (the G2G cross-check, a
  // manual import) — the next run's gate picks it up, so warn, don't fail.
  // A silent zero-write run is the shape that hid the 2026-09-14 outage; a
  // number in the log is how it stays visible.
  const rowsWritten = rowsToWrite.length
  let unrepricedAfterWrite: number | null = null
  const { data: unrepricedCount, error: unrepricedError } = await (
    admin as any
  ).rpc('sab_count_unrepriced', { p_grace_seconds: 0 })
  if (unrepricedError) {
    console.warn(
      `sab_count_unrepriced after write failed: ${unrepricedError.message}`,
    )
  } else {
    unrepricedAfterWrite = Number(unrepricedCount ?? 0)
    if (unrepricedAfterWrite > 0) {
      console.warn(
        `⚠️ ${unrepricedAfterWrite} key(s) still have evidence newer than their ` +
          `price after this write — a listing landed mid-run; the next reprice ` +
          `covers it.`,
      )
    }
  }
  console.log(
    `✅ SAB corrections written: ${rowsWritten} of ${rows.length}` +
      `${full ? ' (full)' : ' (incremental)'}, ` +
      `unrepriced after write: ${unrepricedAfterWrite ?? 'unknown'}`,
  )

  // Prune rows for items that no longer exist in the catalogue at all.
  //
  // This USED to be `.lt('computed_at', startedAt)`, which was safe only while
  // every row was rewritten on every run. With incremental writes an untouched
  // row keeps its older computed_at and that predicate would DELETE it —
  // silently emptying the catalogue of everything that did not change. Prune by
  // identity instead: keep every key we priced this run, drop the rest.
  const livingKeys = new Set(
    corrections.map((c) => `${c.brainrotId}:${c.mutationId}`),
  )
  const orphaned = existingCorrections.filter(
    (row) => !livingKeys.has(`${row.brainrot_id}:${row.mutation_id}`),
  )
  for (const row of orphaned) {
    const { error: pruneError } = await (admin as any)
      .from('sab_price_corrections')
      .delete()
      .eq('brainrot_id', row.brainrot_id)
      .eq('mutation_id', row.mutation_id)
    if (pruneError) console.error('Failed to prune stale correction:', pruneError)
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

  // Materialize the display catalog from the fresh corrections. Every price page
  // reads sab_price_display (an indexed plain table) instead of recomputing the
  // heavy sab_public_price_catalog_corrected view per request. Runs here, off the
  // request path, once per crawl. Non-fatal: if it fails, pages fall back to the
  // previous snapshot (still correct, just a cycle old) rather than breaking.
  let displayRefreshed = 0
  const { data: displayCount, error: displayError } = await (admin as any).rpc(
    'sab_refresh_price_display',
  )
  if (displayError) {
    console.error('Failed to refresh sab_price_display:', displayError)
  } else {
    displayRefreshed = Number(displayCount ?? 0)
    console.log(`✅ sab_price_display refreshed: ${displayRefreshed} rows`)
  }

  // Everything the item pages display now (T1 publish step). Read back from
  // sab_price_display rather than built from `corrections`, because the
  // display is what the pages render (it also folds in the crawl's published
  // estimates). Headline numbers only — the low/high range is min/max of the
  // listings and jumps on every new outlier, so it never decides a rebuild.
  const publishedPrices = await sabPublishedPrices(admin)

  return {
    publishedPrices,
    evidence_refreshed: evidenceRefreshed,
    corrected: corrections.length,
    rows_written: rowsWritten,
    unrepriced_after_write: unrepricedAfterWrite,
    anchored,
    suppressed,
    multipliers: multiplierRows.length,
    history_reconciled: historyReconciled,
    tradeable_updated: tradeableUpdated,
    display_refreshed: displayRefreshed,
    breakdown: summary,
  }
}

type DisplayRow = {
  brainrot_slug: string | null
  mutation_slug: string | null
  market_value_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
}

const displayNumber = (v: number | string | null): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function sabPublishedPrices(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<PublishedPrice[]> {
  // Keyset on the primary key (brainrot_id, mutation_slug), not OFFSET.
  const rows = await selectAllByKey<DisplayRow>(admin, {
    table: 'sab_price_display',
    columns: 'brainrot_slug,mutation_slug,market_value_usd,cheapest_usd,average_usd',
    key: ['brainrot_id', 'mutation_slug'],
  })
  const out: PublishedPrice[] = []
  for (const r of rows) {
    if (!r.brainrot_slug) continue
    const market = displayNumber(r.market_value_usd)
    const cheapest = displayNumber(r.cheapest_usd)
    const average = displayNumber(r.average_usd)
    if (market == null && cheapest == null && average == null) continue
    out.push({
      itemSlug: r.brainrot_slug,
      variant: r.mutation_slug ?? 'default',
      prices: { market, cheapest, average },
    })
  }
  return out
}
