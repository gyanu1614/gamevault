/**
 * SAB price correction — the accuracy layer over the raw market estimates.
 *
 * The pipeline publishes whatever the scraped listings say. That is wrong in
 * three measurable ways (all numbers verified against production 2026-07-30):
 *
 *  1. NO MINIMUM EVIDENCE. 23 items publish a price derived from a single
 *     listing, and 53 of 423 rest on n<=2. An IQR fence around one point *is*
 *     that point, so a bait listing publishes unchallenged — Spyder Elephant,
 *     a 1T-cost OG, published at $9.98 off one listing while its peers sit
 *     near $293.
 *
 *  2. NO EXTERNAL ANCHOR. Nothing compares an item to comparable items, so
 *     there is no way to notice that a price is absurd for its class.
 *
 *  3. MUTATION PRICES ASSUME THE INCOME MULTIPLIER. Measured against 1,155
 *     well-sampled variant/default pairs, the market premium saturates around
 *     2.5-3.5x no matter how high income scales: Rainbow is a 10x income
 *     multiplier but only a ~3.0x price multiplier, Phantom 12x -> ~3.3x.
 *     Estimating a Rainbow as 10x the default overstates it roughly threefold.
 *
 * This module is pure and data-driven — every threshold is documented, and the
 * mutation multipliers are re-measured from live data on each run rather than
 * hardcoded, so they track the market as coverage improves. It deliberately
 * does NOT touch the hand-edited view chain (see the pricing system map): it
 * produces corrections that are stored alongside and merged at read time.
 *
 * Design rule throughout: never overwrite real evidence. Corrections apply to
 * THIN samples. A well-sampled price that disagrees with its cohort is treated
 * as a genuinely unusual item, not an error.
 */

/** Below this, a price is an estimate rather than a measurement. */
export const MIN_TRUSTED_SAMPLES = 3

/**
 * How far a thin estimate may sit from its anchor before being overridden.
 * 3x is deliberately loose — this catches "absurd", not "a bit off", so real
 * price dispersion survives.
 */
export const ANCHOR_FENCE_RATIO = 3

/** A cohort spans in-game costs within this factor either side of the item. */
export const COHORT_COST_BAND = 5

/** Minimum comparable items before a cohort median is trustworthy. */
export const MIN_COHORT_SIZE = 3

/** Minimum measured pairs before an empirical mutation multiplier is used. */
export const MIN_MULTIPLIER_PAIRS = 20

/**
 * Floor pricing — the "cheapest you can actually buy at" number.
 *
 * A marketplace value is more useful as a realistic FLOOR than as a fair
 * midpoint: a buyer wants the lowest real price, not the average. But the naive
 * "cheapest listing" is exactly the bait trap — a lone $0.50 or $9.98 shill
 * sets a price nobody can transact at (this is how Spyder Elephant published
 * $9.98 off one listing).
 *
 * So the floor is the lowest price that has SUPPORT: the cheapest value where a
 * cluster of at least FLOOR_MIN_CLUSTER listings sit within FLOOR_BAND_RATIO of
 * each other. One or two cheap outliers below that cluster are ignored. Only a
 * genuine cluster of near-identical cheap listings — real cheap floor, or
 * coordinated fraud that no price statistic can distinguish from one — moves it.
 */
export const FLOOR_MIN_CLUSTER = 3

/** Cheapest and Nth-cheapest of a supporting cluster must be within this. */
export const FLOOR_BAND_RATIO = 1.6

/**
 * Cluster-relative floor (point 5): a listing priced below this fraction of the
 * group median is a fake, not a deal — a $0.67 listing in a $300 cluster, or the
 * $44.88 pair Headless Horseman had against a $1000+ cluster. Dropped BEFORE the
 * supported-cluster search, so fake-cheap listings that dodge the seller/title
 * filters upstream still cannot set the floor.
 */
export const CLUSTER_FLOOR_RATIO = 0.25

/**
 * Observed marketplace price floor (p1 = $0.28 across 423 published prices).
 * Listings do not go below roughly this regardless of item value, so a model
 * predicting less than this is describing something the market cannot express.
 */
export const MARKET_PRICE_FLOOR_USD = 0.28

export type CorrectionReason =
  | 'floor'
  | 'trusted'
  | 'thin_sample_within_anchor'
  | 'thin_sample_anchored'
  | 'insufficient_evidence'
  | 'variant_anchored'

export type ConfidenceLabel = 'high' | 'medium' | 'low' | 'none'

export type BrainrotMeta = {
  brainrotId: string
  rarity: string | null
  ingameCost: number | null
  incomePerSecond: number | null
}

export type VariantEstimate = {
  brainrotId: string
  mutationId: string
  mutationSlug: string
  valueUsd: number | null
  lowUsd: number | null
  highUsd: number | null
  sampleCount: number
  sourceCount: number
  /**
   * A human checked this price. Never corrected — a reviewed number outranks
   * any statistical anchor, and silently overriding one would make manual
   * review pointless.
   */
  isReviewed?: boolean
  /**
   * The cleaned per-listing prices behind this variant (from
   * sab_market_clean_listing_evidence, already IQR-fenced). When present and
   * dense enough, the headline becomes the lowest SUPPORTED price rather than
   * the median — the "cheapest you can actually buy at". Optional so callers
   * that don't have listing-level data still get median-based corrections.
   */
  listingPrices?: number[]
  /**
   * The mutation's income multiplier — its rung on the value ladder (Default=1,
   * Gold=1.25 … Rainbow=10). Used only for the ladder sanity check (point 6):
   * a lower rung must not price implausibly above a higher one. Optional.
   */
  incomeMultiplier?: number
}

/**
 * Ladder tolerance: a lower-tier mutation may sit at most this many times above
 * a higher-tier one before it's treated as leftover mislabeled noise. Loose on
 * purpose — real mutation premiums are noisy, so this catches "absurd", not
 * "slightly out of order".
 */
export const LADDER_MAX_INVERSION_RATIO = 2

export type Correction = {
  brainrotId: string
  mutationId: string
  valueUsd: number | null
  lowUsd: number | null
  highUsd: number | null
  originalValueUsd: number | null
  reason: CorrectionReason
  confidence: ConfidenceLabel
  anchorUsd: number | null
  cohortSize: number
  sampleCount: number
  isAnchored: boolean
  isPublishable: boolean
}

const DEFAULT_MUTATION_SLUG = 'default'

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = sorted.length / 2
  return sorted.length % 2
    ? sorted[Math.floor(middle)]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Nearest-rank quantile, q in [0,1]. */
export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * q)),
  )
  return sorted[index]
}

/**
 * The lowest price with support — the realistic floor.
 *
 * Walks the sorted prices upward and returns the first value whose next
 * FLOOR_MIN_CLUSTER listings (itself included) fall within FLOOR_BAND_RATIO.
 * That is the cheapest point where enough sellers agree for the price to be
 * real. Lone cheap baits below the cluster are skipped over rather than shown.
 *
 * Returns null when no cluster qualifies (too few listings, or prices too
 * scattered to trust a floor) — the caller then falls back to the anchor logic,
 * so a thin or bait-heavy item never publishes a fabricated floor.
 */
export function lowestSupportedPrice(
  prices: number[],
  minCluster: number = FLOOR_MIN_CLUSTER,
  bandRatio: number = FLOOR_BAND_RATIO,
): number | null {
  const positive = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right)

  if (positive.length < minCluster) return null

  // Point 5: drop listings below CLUSTER_FLOOR_RATIO of the median before
  // looking for a supported cluster, so a knot of fake-cheap listings can't
  // form its own "cluster" beneath the real market.
  const groupMedian = median(positive)
  const sorted =
    isUsable(groupMedian) && groupMedian > 0
      ? positive.filter((price) => price >= groupMedian * CLUSTER_FLOOR_RATIO)
      : positive

  if (sorted.length < minCluster) return null

  for (let start = 0; start <= sorted.length - minCluster; start += 1) {
    const clusterLow = sorted[start]
    const clusterHigh = sorted[start + minCluster - 1]
    if (clusterHigh <= clusterLow * bandRatio) {
      return clusterLow
    }
  }

  return null
}

/**
 * Raise a displayed low so it never sits below the point-5 cluster floor of the
 * item's own listings. Keeps the range honest when the headline came from the
 * median blend rather than the floor branch.
 */
function clampLowToClusterFloor(
  low: number | null,
  listingPrices: number[] | undefined,
): number | null {
  if (!isUsable(low) || !listingPrices?.length) return low
  const groupMedian = median(
    listingPrices.filter((p) => Number.isFinite(p) && p > 0),
  )
  if (!isUsable(groupMedian)) return low
  const clusterFloor = groupMedian * CLUSTER_FLOOR_RATIO
  return low < clusterFloor ? roundCents(clusterFloor) : low
}

function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Measure what the market actually pays for each mutation, as a multiple of
 * the same Brainrot's default price.
 *
 * Only pairs where BOTH sides are well-sampled count, so the measurement isn't
 * polluted by the thin estimates this module exists to correct. The median is
 * used rather than the mean because the ratio distribution has a long right
 * tail (a handful of variants trade at 10x+).
 */
export type MutationMultiplier = {
  /** Market premium as a multiple of the same Brainrot's default price. */
  multiplier: number
  /** Well-sampled variant/default pairs behind the measurement. */
  pairCount: number
}

export function measureMutationMultipliers(
  variants: VariantEstimate[],
): Map<string, MutationMultiplier> {
  const byBrainrot = new Map<string, VariantEstimate[]>()

  for (const variant of variants) {
    const list = byBrainrot.get(variant.brainrotId)
    if (list) list.push(variant)
    else byBrainrot.set(variant.brainrotId, [variant])
  }

  const ratios = new Map<string, number[]>()

  for (const group of byBrainrot.values()) {
    const base = group.find((v) => v.mutationSlug === DEFAULT_MUTATION_SLUG)

    if (
      !base ||
      base.sampleCount < MIN_TRUSTED_SAMPLES ||
      !isUsable(base.valueUsd)
    ) {
      continue
    }

    for (const variant of group) {
      if (
        variant.mutationSlug === DEFAULT_MUTATION_SLUG ||
        variant.sampleCount < MIN_TRUSTED_SAMPLES ||
        !isUsable(variant.valueUsd)
      ) {
        continue
      }

      const ratio = variant.valueUsd / base.valueUsd
      const list = ratios.get(variant.mutationSlug)
      if (list) list.push(ratio)
      else ratios.set(variant.mutationSlug, [ratio])
    }
  }

  const multipliers = new Map<string, MutationMultiplier>()

  for (const [slug, values] of ratios) {
    if (values.length < MIN_MULTIPLIER_PAIRS) continue
    const value = median(values)
    if (isUsable(value)) {
      multipliers.set(slug, { multiplier: value, pairCount: values.length })
    }
  }

  return multipliers
}

/**
 * Comparable items, in descending order of how comparable they are:
 *
 *   1. same rarity AND similar in-game cost — the tightest peer group
 *   2. same rarity, any cost — coarser, but rarity alone carries real signal
 *   3. similar in-game cost, ANY rarity — the last resort, and the only one
 *      available to Epic/Rare/Common, which have zero well-sampled members of
 *      their own rarity. Cost is the game's own valuation, so an item costing
 *      roughly X trades near other items costing roughly X regardless of tier.
 *
 * A coarse anchor still beats no anchor; only when all three fail do we admit
 * we don't know.
 */
function cohortPricesFor(
  target: BrainrotMeta,
  wellSampled: { meta: BrainrotMeta; valueUsd: number }[],
): number[] {
  const others = wellSampled.filter(
    (candidate) => candidate.meta.brainrotId !== target.brainrotId,
  )

  const withinCostBand = (candidate: { meta: BrainrotMeta }) => {
    const cost = candidate.meta.ingameCost
    if (!isUsable(cost) || !isUsable(target.ingameCost)) return false
    return (
      cost >= target.ingameCost / COHORT_COST_BAND &&
      cost <= target.ingameCost * COHORT_COST_BAND
    )
  }

  if (target.rarity) {
    const sameRarity = others.filter(
      (candidate) => candidate.meta.rarity === target.rarity,
    )

    const banded = sameRarity.filter(withinCostBand)
    if (banded.length >= MIN_COHORT_SIZE) {
      return banded.map((candidate) => candidate.valueUsd)
    }

    if (sameRarity.length >= MIN_COHORT_SIZE) {
      return sameRarity.map((candidate) => candidate.valueUsd)
    }
  }

  const costPeers = others.filter(withinCostBand)
  if (costPeers.length >= MIN_COHORT_SIZE) {
    return costPeers.map((candidate) => candidate.valueUsd)
  }

  return []
}

/**
 * Confidence from the SURVIVING clean sample count (honesty rule, point on
 * confidence tiers). The display collapses to three words — "Highly Accurate"
 * (high), "Accurate" (medium), "Low Accuracy" (low) — so the spec's four rungs
 * map as: >=10 clean samples → high, >=3 → medium, else low. A second source
 * agreeing is required for the top tier, since cross-source agreement is the
 * strongest signal a price is real.
 */
function confidenceFor(
  sampleCount: number,
  sourceCount: number,
): ConfidenceLabel {
  if (sampleCount >= 10 && sourceCount >= 2) return 'high'
  if (sampleCount >= MIN_TRUSTED_SAMPLES) return 'medium'
  return 'low'
}

/** Ratio distance from an anchor, direction-agnostic (2x and 0.5x are equal). */
function anchorDeviation(value: number, anchor: number): number {
  return value >= anchor ? value / anchor : anchor / value
}

export type CorrectionInput = {
  brainrots: BrainrotMeta[]
  variants: VariantEstimate[]
}

/**
 * Produce a correction for every variant.
 *
 * Two passes, because the second depends on the first: defaults are anchored
 * against comparable items, then non-default mutations are anchored against
 * their own CORRECTED default times the measured mutation multiplier. That
 * cascade is what fixes a Spyder Elephant Radioactive — both the base and the
 * multiplier were wrong, and correcting the base alone would still leave it
 * roughly 3x high.
 */
export function computeCorrections(input: CorrectionInput): Correction[] {
  const metaById = new Map(input.brainrots.map((b) => [b.brainrotId, b]))
  const multipliers = measureMutationMultipliers(input.variants)

  const defaults = input.variants.filter(
    (v) => v.mutationSlug === DEFAULT_MUTATION_SLUG,
  )

  // The reference set every cohort is drawn from: real measurements only.
  const wellSampled = defaults
    .filter((v) => v.sampleCount >= MIN_TRUSTED_SAMPLES && isUsable(v.valueUsd))
    .map((v) => ({ meta: metaById.get(v.brainrotId)!, valueUsd: v.valueUsd! }))
    .filter((entry) => Boolean(entry.meta))

  const corrections: Correction[] = []
  const correctedDefaults = new Map<string, number>()

  for (const variant of defaults) {
    const meta = metaById.get(variant.brainrotId)
    const correction = correctDefault(variant, meta, wellSampled)
    corrections.push(correction)

    if (correction.isPublishable && isUsable(correction.valueUsd)) {
      correctedDefaults.set(variant.brainrotId, correction.valueUsd)
    }
  }

  for (const variant of input.variants) {
    if (variant.mutationSlug === DEFAULT_MUTATION_SLUG) continue
    corrections.push(
      correctVariant(variant, correctedDefaults, multipliers),
    )
  }

  return enforceMutationLadder(corrections, input.variants)
}

/**
 * Ladder sanity (point 6): within a Brainrot, a lower-tier mutation must not
 * price implausibly above a higher-tier one. When it does, the lower rung's
 * price is leftover mislabeled noise — suppress it rather than publish an
 * out-of-order value that makes the whole mutation list look untrustworthy.
 *
 * "Higher tier" is the income multiplier (Default < Gold < … < Rainbow). We
 * compare each mutation against the cheapest higher rung and drop it only if it
 * exceeds that by more than LADDER_MAX_INVERSION_RATIO — loose enough to leave
 * genuine premium noise alone.
 */
function enforceMutationLadder(
  corrections: Correction[],
  variants: VariantEstimate[],
): Correction[] {
  const multiplierByVariant = new Map(
    variants.map((v) => [
      `${v.brainrotId}:${v.mutationId}`,
      v.incomeMultiplier ?? null,
    ]),
  )

  // Group publishable, priced corrections by Brainrot with their tier AND
  // sample count — the sample count is what decides which side of an inversion
  // is the noise.
  const byBrainrot = new Map<
    string,
    { correction: Correction; multiplier: number; samples: number }[]
  >()

  for (const correction of corrections) {
    if (!correction.isPublishable || !isUsable(correction.valueUsd)) continue
    const multiplier = multiplierByVariant.get(
      `${correction.brainrotId}:${correction.mutationId}`,
    )
    if (!isUsable(multiplier)) continue
    const list = byBrainrot.get(correction.brainrotId)
    const entry = { correction, multiplier, samples: correction.sampleCount }
    if (list) list.push(entry)
    else byBrainrot.set(correction.brainrotId, [entry])
  }

  const suppress = new Set<Correction>()

  for (const group of byBrainrot.values()) {
    for (const entry of group) {
      // NEVER suppress a well-sampled price on ladder grounds. A price backed by
      // real listings is evidence, not noise — if it disagrees with the ladder,
      // the ladder assumption (mutation X always costs more than Y) is what's
      // wrong, not the measurement. Only THIN estimates can be ladder-noise.
      // (This is the Skibidi bug: an 11-sample $224 default was being nuked by a
      // $70 estimated higher-tier mutation.)
      if (entry.samples >= MIN_TRUSTED_SAMPLES) continue

      // Compare a thin LOWER tier only against a WELL-SAMPLED higher tier — a
      // noisy neighbour can't be the yardstick. If this thin low-tier estimate
      // sits implausibly above a trusted higher tier, it's the noise: drop it.
      let trustedHigher: number | null = null
      for (const other of group) {
        if (other.multiplier <= entry.multiplier) continue
        if (other.samples < MIN_TRUSTED_SAMPLES) continue
        const value = other.correction.valueUsd!
        if (trustedHigher == null || value < trustedHigher) {
          trustedHigher = value
        }
      }

      if (
        trustedHigher != null &&
        entry.correction.valueUsd! > trustedHigher * LADDER_MAX_INVERSION_RATIO
      ) {
        suppress.add(entry.correction)
      }
    }
  }

  if (!suppress.size) return corrections

  return corrections.map((correction) =>
    suppress.has(correction)
      ? {
          ...correction,
          valueUsd: null,
          lowUsd: null,
          highUsd: null,
          reason: 'insufficient_evidence',
          confidence: 'none',
          isPublishable: false,
        }
      : correction,
  )
}

function correctDefault(
  variant: VariantEstimate,
  meta: BrainrotMeta | undefined,
  wellSampled: { meta: BrainrotMeta; valueUsd: number }[],
): Correction {
  const base = {
    brainrotId: variant.brainrotId,
    mutationId: variant.mutationId,
    originalValueUsd: variant.valueUsd,
    sampleCount: variant.sampleCount,
  }

  const cohort = meta ? cohortPricesFor(meta, wellSampled) : []
  const anchor = median(cohort)

  // A human-reviewed price wins outright — never second-guess a manual check,
  // and don't drop it to a scraped floor.
  if (variant.isReviewed && isUsable(variant.valueUsd)) {
    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: variant.lowUsd,
      highUsd: variant.highUsd,
      reason: 'trusted',
      confidence: 'high',
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Well-sampled: prefer the lowest SUPPORTED price — the cheapest a buyer can
  // actually transact at — over the median midpoint. Only when there are enough
  // clustered listings to trust a floor; otherwise fall through to the median.
  if (variant.sampleCount >= MIN_TRUSTED_SAMPLES && isUsable(variant.valueUsd)) {
    const floor = lowestSupportedPrice(variant.listingPrices ?? [])

    if (isUsable(floor)) {
      return {
        ...base,
        valueUsd: roundCents(floor),
        // Keep the real spread. The low end is now the floor itself; the high
        // end stays the median-blend's high so the range still shows headroom.
        lowUsd: roundCents(floor),
        highUsd: variant.highUsd ?? variant.valueUsd,
        reason: 'floor',
        confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
        anchorUsd: anchor,
        cohortSize: cohort.length,
        isAnchored: false,
        isPublishable: true,
      }
    }

    // No trustworthy floor (too few/too-scattered listings): the median blend
    // is still real evidence, so publish it as before — but never advertise a
    // low below the point-5 cluster floor, so the displayed range can't quote a
    // fake-cheap listing the price itself rejected.
    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: clampLowToClusterFloor(variant.lowUsd, variant.listingPrices),
      highUsd: variant.highUsd,
      reason: 'trusted',
      confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Thin, and nothing comparable to check it against: publishing a number here
  // is how $9.98 ends up on a 1T-cost item. Say "no data" instead.
  if (!isUsable(anchor)) {
    return {
      ...base,
      valueUsd: null,
      lowUsd: null,
      highUsd: null,
      reason: 'insufficient_evidence',
      confidence: 'none',
      anchorUsd: null,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: false,
    }
  }

  const withinFence =
    isUsable(variant.valueUsd) &&
    anchorDeviation(variant.valueUsd, anchor) <= ANCHOR_FENCE_RATIO

  if (withinFence) {
    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: variant.lowUsd,
      highUsd: variant.highUsd,
      reason: 'thin_sample_within_anchor',
      confidence: 'low',
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Thin AND absurd for its class. Take the cohort as the headline number, but
  // stretch the range to also cover the original listing: with n<=2 we cannot
  // actually rule out that the listing was right and the item is unusual, and
  // a range that hides that possibility overstates what we know.
  const value = Math.max(MARKET_PRICE_FLOOR_USD, anchor)
  const spread = [
    quantile(cohort, 0.25) ?? value,
    quantile(cohort, 0.75) ?? value,
    ...(isUsable(variant.valueUsd) ? [variant.valueUsd] : []),
  ]

  return {
    ...base,
    valueUsd: roundCents(value),
    lowUsd: roundCents(Math.max(MARKET_PRICE_FLOOR_USD, Math.min(...spread))),
    highUsd: roundCents(Math.max(...spread)),
    reason: 'thin_sample_anchored',
    confidence: 'low',
    anchorUsd: anchor,
    cohortSize: cohort.length,
    isAnchored: true,
    isPublishable: true,
  }
}

function correctVariant(
  variant: VariantEstimate,
  correctedDefaults: Map<string, number>,
  multipliers: Map<string, MutationMultiplier>,
): Correction {
  const base = {
    brainrotId: variant.brainrotId,
    mutationId: variant.mutationId,
    originalValueUsd: variant.valueUsd,
    sampleCount: variant.sampleCount,
  }

  const defaultValue = correctedDefaults.get(variant.brainrotId)
  const multiplier = multipliers.get(variant.mutationSlug)?.multiplier
  const anchor =
    isUsable(defaultValue) && isUsable(multiplier)
      ? defaultValue * multiplier
      : null

  if (variant.isReviewed && isUsable(variant.valueUsd)) {
    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: variant.lowUsd,
      highUsd: variant.highUsd,
      reason: 'trusted',
      confidence: 'high',
      anchorUsd: anchor,
      cohortSize: 0,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Well-sampled mutation: same floor-first preference as defaults. Mutations
  // usually have too few listings for a floor to qualify, in which case this
  // falls through to the median blend.
  if (variant.sampleCount >= MIN_TRUSTED_SAMPLES && isUsable(variant.valueUsd)) {
    const floor = lowestSupportedPrice(variant.listingPrices ?? [])

    if (isUsable(floor)) {
      return {
        ...base,
        valueUsd: roundCents(floor),
        lowUsd: roundCents(floor),
        highUsd: variant.highUsd ?? variant.valueUsd,
        reason: 'floor',
        confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
        anchorUsd: anchor,
        cohortSize: 0,
        isAnchored: false,
        isPublishable: true,
      }
    }

    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: variant.lowUsd,
      highUsd: variant.highUsd,
      reason: 'trusted',
      confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
      anchorUsd: anchor,
      cohortSize: 0,
      isAnchored: false,
      isPublishable: true,
    }
  }

  if (!isUsable(anchor)) {
    return {
      ...base,
      valueUsd: null,
      lowUsd: null,
      highUsd: null,
      reason: 'insufficient_evidence',
      confidence: 'none',
      anchorUsd: null,
      cohortSize: 0,
      isAnchored: false,
      isPublishable: false,
    }
  }

  const withinFence =
    isUsable(variant.valueUsd) &&
    anchorDeviation(variant.valueUsd, anchor) <= ANCHOR_FENCE_RATIO

  if (withinFence) {
    return {
      ...base,
      valueUsd: variant.valueUsd,
      lowUsd: variant.lowUsd,
      highUsd: variant.highUsd,
      reason: 'thin_sample_within_anchor',
      confidence: 'low',
      anchorUsd: anchor,
      cohortSize: 0,
      isAnchored: false,
      isPublishable: true,
    }
  }

  const value = Math.max(MARKET_PRICE_FLOOR_USD, anchor)

  return {
    ...base,
    valueUsd: roundCents(value),
    lowUsd: null,
    highUsd: null,
    reason: 'variant_anchored',
    confidence: 'low',
    anchorUsd: anchor,
    cohortSize: 0,
    isAnchored: true,
    isPublishable: true,
  }
}
