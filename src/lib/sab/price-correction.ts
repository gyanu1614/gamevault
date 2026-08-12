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

import {
  reputablePrice,
  type ReputableListing,
} from './reputable-pricing'

export type { ReputableListing } from './reputable-pricing'

/** Below this, a price is an estimate rather than a measurement. */
export const MIN_TRUSTED_SAMPLES = 3

/**
 * Minimum clean listings required to PUBLISH any price at all, by rarity.
 *
 * The high-value rarities (OG, Secret) are where a wrong price hurts most and
 * where thin data is most dangerous — Spyder Elephant published $323 off a
 * SINGLE untradeable listing (14 exist, sold for Robux, no real cash market).
 * For those, one or two listings is not a market, so we require more before
 * showing anything; below it the item reads "not enough data" rather than a
 * fabricated number. Everything else keeps the base threshold.
 */
export const MIN_PUBLISH_SAMPLES_HIGH_VALUE = 5

/**
 * Above this published value, a high-value rarity needs cross-source support to
 * publish. Five listings from a SINGLE marketplace is not confirmation — it's
 * one seller-pool that no downstream statistic can distinguish from coordinated
 * or mispriced inventory. Headless Horseman published $8,999.99 off n=5 that
 * were all Eldorado (source_count=1), thrashing $89 -> $8,999 -> $7,499 day to
 * day. Real evidence at this price means at least two independent sources agree;
 * below that we suppress rather than publish a confident five-figure guess.
 */
export const HIGH_VALUE_MULTI_SOURCE_THRESHOLD_USD = 1000
export const MIN_SOURCES_HIGH_VALUE = 2

const HIGH_VALUE_RARITIES = new Set(['OG', 'Secret'])

function isHighValueRarity(rarity: string | null | undefined): boolean {
  return !!rarity && HIGH_VALUE_RARITIES.has(rarity)
}

export function minPublishSamples(rarity: string | null | undefined): number {
  return rarity && HIGH_VALUE_RARITIES.has(rarity)
    ? MIN_PUBLISH_SAMPLES_HIGH_VALUE
    : MIN_TRUSTED_SAMPLES
}

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
 * The cheapest listing that SETS the floor must have a close neighbour: the step
 * from it up to the next listing may be at most this fraction of its own price.
 *
 * Without this, the band-ratio window absorbs a lone low listing sitting in a
 * GAP just under the real cluster. Skibidi Toilet's listings were
 * [162.45, 191.02, 194.72, 198.09, ...]: the window [162.45, 191.02, 194.72]
 * spans only 1.20x (< 1.6), so 162.45 became the "floor" — but it is $29 (18%)
 * below the next listing while the 191-200 cluster is packed within a few
 * percent. That is one listing, not a floor. This rule requires the floor-setter
 * to be within FLOOR_STEP_RATIO of its neighbour (a real cluster member), so a
 * gap-separated lone low is skipped and the dense cluster above sets the floor.
 *
 * 0.10 (10%) is deliberately tight: genuine cheap clusters step in pennies
 * ([0.99, 1.00, 1.00] steps 1%), while an outlier gap is 15-60%. It is looser
 * than the band ratio because it governs a single adjacent step, not the whole
 * window.
 */
export const FLOOR_STEP_RATIO = 0.1

/**
 * Sources whose listings carry seller-trust signals (verified flag, account age)
 * and set the cheapest listing in ~91% of variants. Only these may SET a floor;
 * cheaper listings from unverifiable sources (G2G exposes no seller trust
 * data at all) can confirm a floor but not drag it below the trusted market.
 */
export const TRUSTED_FLOOR_SOURCES = new Set(['eldorado'])

/**
 * A cross-source listing may only lower the floor below the trusted-source floor
 * if it sits within this fraction of it — a genuinely cheaper real deal. Deeper
 * undercuts are treated as unverifiable and clamped to TRUSTED_FLOOR_UNDERCUT ×
 * the trusted floor.
 *
 * Strawberry Elephant published $614.09 off a G2G cluster ($614/$620/$630) that
 * undercut the verified Eldorado market ($700+) by 12% — no seller trust data
 * exists to validate it, so it should not set the price. Dragon Cannelloni's
 * $16.70 G2G listing sits 7% under Eldorado's $17.99 and IS kept (a plausible
 * real deal). 0.92 (8%) is the knee that separates the two: measured against all
 * 1821 live variant groups it corrects 53 items strictly UPWARD, 0 downward, and
 * leaves the 96% of groups where Eldorado is already the cheapest untouched.
 */
export const TRUSTED_FLOOR_UNDERCUT = 0.92

/** Minimum trusted-source listings before the trusted-source floor rule applies. */
export const MIN_TRUSTED_SOURCE_LISTINGS = 3

/**
 * Cluster-relative floor (point 5): a listing priced below this fraction of the
 * group median is a fake, not a deal — a $0.67 listing in a $300 cluster, or the
 * $44.88 pair Headless Horseman had against a $1000+ cluster. Dropped BEFORE the
 * supported-cluster search, so fake-cheap listings that dodge the seller/title
 * filters upstream still cannot set the floor.
 */
export const CLUSTER_FLOOR_RATIO = 0.25

/**
 * If the cheapest supported cluster sits more than this multiple above the
 * cheapest surviving listing, the listings are too scattered to trust a floor —
 * there are real cheaper listings the cluster ignores. Bail to the cohort
 * anchor instead of publishing an inflated high-cluster price.
 */
export const FLOOR_CLUSTER_MAX_LIFT = 3

/**
 * Observed marketplace price floor (p1 = $0.28 across 423 published prices).
 * Listings do not go below roughly this regardless of item value, so a model
 * predicting less than this is describing something the market cannot express.
 */
export const MARKET_PRICE_FLOOR_USD = 0.28

export type CorrectionReason =
  | 'reputable'
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
  /**
   * Whether the item can still be obtained in-game. When 'unobtainable' the item
   * was removed/retired (Tung Tung Tung Sahur), so any listing is someone
   * dumping a dead item at a random price — not a real tradeable market. We
   * suppress the price rather than publish a confident phantom value.
   */
  obtainability?: string | null
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
   * The same per-listing prices tagged with their marketplace source. When
   * present, the floor is computed source-trust-aware (lowestSupportedPriceBySource):
   * only a trusted source may SET the floor, so an unverifiable cheap cluster
   * (G2G) can't drag the price below the verified market. Falls back to
   * the plain `listingPrices` floor when absent or when trusted evidence is thin.
   */
  sourcedListingPrices?: SourcedPrice[]
  /**
   * Per-listing price + seller review count, for the reputable-seller pricing
   * model (reputable-pricing.ts). When present with enough reputable evidence,
   * this becomes the PRIMARY price: value = the reputable Average, plus a
   * separate cheapest. A price is real only if a reputable seller (100+ reviews)
   * offers it — this is the strongest signal we have and outranks the older
   * floor logic, which stays as the fallback for sources without review data.
   */
  reputableListings?: ReputableListing[]
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

/**
 * A mutation with a real premium (multiplier at least this) must not price
 * BELOW its own default — a Radioactive costs MORE than the base, always. When
 * scraped listings say otherwise it's thin noise from throwaway accounts (the
 * Skibidi Radioactive case: reputable sellers list it at $494-899, but a knot
 * of 1-14-day accounts listed $22-70, and the floor took the noise). Below the
 * default, we fall back to the measured default x premium estimate and flag it
 * low confidence rather than publish an impossible number.
 */
export const MUTATION_PREMIUM_FLOOR_MULTIPLIER = 1.5

/**
 * How far above its measured `default × premium` a mutation may be priced before
 * it's treated as bad data. A mutation more than this multiple above the premium
 * estimate is almost always thin/incomplete listings that missed the cheap real
 * market (Cursed Skibidi: $916 off 3 high-only listings vs a ~$570 expected
 * premium and a $325-360 real market). Loose (2x) so genuine dispersion above
 * the estimate survives — this catches "absurd", not "a bit high".
 */
export const MUTATION_PREMIUM_CEILING_RATIO = 2.5

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
  /**
   * Reputable-seller pricing (reason === 'reputable'): the lowest and typical
   * price among sellers with 100+ reviews. cheapestUsd is the buyer-facing
   * "lowest", averageUsd feeds the headline valueUsd. Null on every other path
   * (the older floor/anchor logic doesn't produce a reputable split).
   */
  cheapestUsd: number | null
  averageUsd: number | null
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

  // Find the cheapest SUPPORTED cluster — the lowest price that (a) has its next
  // (minCluster) listings within bandRatio AND (b) sits within FLOOR_STEP_RATIO
  // of its immediate neighbour. Both are required: the band ratio keeps the
  // whole window tight, and the step ratio keeps the FLOOR-SETTER from being a
  // lone low listing separated by a gap from the real cluster above it
  // (Skibidi Toilet: [162.45, 191.02, 194.72, ...] — the window is tight enough
  // but 162.45 is 18% under its neighbour, so it is one listing, not a floor).
  //
  // When the cheapest member fails the step test, we do NOT reject the window —
  // we advance past that lone low and let the dense cluster above set the floor.
  let clusterLow: number | null = null
  for (let start = 0; start <= positive.length - minCluster; start += 1) {
    const windowTight =
      positive[start + minCluster - 1] <= positive[start] * bandRatio
    if (!windowTight) continue

    // The floor-setter must have a close neighbour. A large step from this
    // listing to the next is the lone-outlier signature; skip it. The 1e-9
    // epsilon keeps an EXACTLY-FLOOR_STEP_RATIO step inside the bound despite
    // binary-float error ((1.1-1.0)/1.0 === 0.10000000000000009 > 0.1).
    //
    // `neighbour` is the next listing up. For any minCluster >= 2 it is inside
    // the window and always defined; the `undefined` guard only matters if a
    // caller passes minCluster === 1 (none does today), where a lone listing has
    // no neighbour to support it and must not set a floor.
    const neighbour = positive[start + 1]
    if (neighbour === undefined) continue
    const stepToNeighbour = (neighbour - positive[start]) / positive[start]
    if (stepToNeighbour > FLOOR_STEP_RATIO + 1e-9) continue

    clusterLow = positive[start]
    break
  }

  if (clusterLow == null) return null

  // Point 5 (bait below the cluster): listings priced far below the supported
  // cluster are fakes, not deals — a $0.67 or $44.88 knot beneath a real
  // cluster. They sit BELOW clusterLow by construction (the cluster is the
  // cheapest supported price), so they never set the floor. Nothing more to do:
  // clusterLow already ignores them.
  //
  // Reliability guard (scattered high-only market): if the cheapest supported
  // cluster is itself far ABOVE the cheapest real listing, there are genuine
  // cheaper listings the cluster ignores and the market is too scattered to
  // trust a floor (Headless Horseman: lone $1000/$4000, cluster only at
  // $8999-9999 → floor $8999 is absurd). Bail to the cohort anchor.
  //
  // We distinguish the two: a fake-cheap listing is a LONE outlier well below
  // the cluster; a real cheaper listing has company or sits within reach. If
  // there are 2+ listings below clusterLow / FLOOR_CLUSTER_MAX_LIFT, those are
  // a real cheaper tier the cluster is wrongly skipping → bail.
  const cheaperReal = positive.filter(
    (price) => price < clusterLow! / FLOOR_CLUSTER_MAX_LIFT,
  )
  // A single lone cheap listing is bait (ignore); two or more is a real tier.
  if (cheaperReal.length >= 2) return null

  return clusterLow
}

/** A single market listing tagged with the source it came from. */
export type SourcedPrice = {
  price: number
  /** Marketplace slug, e.g. 'eldorado' | 'g2g'. */
  source: string
}

/**
 * Source-trust-aware floor. The plain lowestSupportedPrice() trusts every source
 * equally, so a tight cluster of cheap listings from a marketplace that exposes
 * NO seller-trust data (G2G) can set the price below the verified market
 * — Strawberry Elephant published $614 off a G2G cluster while the verified
 * Eldorado floor was $700+.
 *
 * The rule:
 *   1. If there are at least MIN_TRUSTED_SOURCE_LISTINGS listings from a trusted
 *      source, compute the TRUSTED floor from those alone.
 *   2. The published floor may then be lowered by cheaper cross-source listings
 *      only down to trustedFloor × TRUSTED_FLOOR_UNDERCUT — a genuinely-cheaper
 *      real deal (Dragon Cannelloni's 7%-under G2G listing survives), never an
 *      unverifiable deep undercut (Strawberry's 12%-under G2G is clamped up).
 *   3. Without enough trusted listings, fall back to the plain all-source floor.
 *
 * Returns null on the same conditions as lowestSupportedPrice (no supported
 * cluster / too scattered), so callers keep their existing null handling.
 */
export function lowestSupportedPriceBySource(
  listings: SourcedPrice[],
  trustedSources: Set<string> = TRUSTED_FLOOR_SOURCES,
): number | null {
  const usable = listings.filter(
    (l) => Number.isFinite(l.price) && l.price > 0,
  )
  const allPrices = usable.map((l) => l.price)
  const trustedPrices = usable
    .filter((l) => trustedSources.has(l.source))
    .map((l) => l.price)

  // Not enough trusted evidence → plain all-source floor (unchanged behaviour).
  if (trustedPrices.length < MIN_TRUSTED_SOURCE_LISTINGS) {
    return lowestSupportedPrice(allPrices)
  }

  const trustedFloor = lowestSupportedPrice(trustedPrices)
  // Trusted listings exist but form no supported cluster (scattered / too few
  // after clustering): don't invent a floor from unverifiable sources.
  if (trustedFloor == null) return null

  // A cross-source listing may pull the floor down only to within the undercut
  // band. Drop anything cheaper than that before searching the all-source floor,
  // so a deep unverifiable undercut can't set the price, but a real near-floor
  // deal still can.
  const undercutLimit = trustedFloor * TRUSTED_FLOOR_UNDERCUT
  const eligible = allPrices.filter((price) => price >= undercutLimit)
  const blendedFloor = lowestSupportedPrice(eligible)

  // The floor is the cheapest SUPPORTED eligible price, but never below the
  // undercut limit (a lone real deal at the limit is honoured; nothing goes
  // under the verified market by more than the band).
  if (blendedFloor == null) return trustedFloor
  return Math.max(blendedFloor, undercutLimit)
}

/**
 * The floor for a variant, source-trust-aware when the sourced listings are
 * present and falling back to the plain all-source floor otherwise. Single place
 * both the default and variant floor branches read, so the trust rule applies
 * uniformly.
 */
function variantFloor(variant: VariantEstimate): number | null {
  if (variant.sourcedListingPrices?.length) {
    return lowestSupportedPriceBySource(variant.sourcedListingPrices)
  }
  return lowestSupportedPrice(variant.listingPrices ?? [])
}

/**
 * Reputable-seller cheapest + average for a variant, or null when we hold no
 * reputable listings (no 100+ review seller). Thin wrapper so both the default
 * and variant branches share one call site.
 *
 * `minPriceUsd` (mutation branch only) is the value-ladder floor — a premium
 * mutation can't legitimately cost less than its own default, so listings below
 * it are dropped BEFORE pricing. That advances the cheapest to the first real
 * at-or-above-floor listing instead of replacing the whole reputable result with
 * an anchored estimate (the old premiumSanityEstimate behaviour, which threw away
 * a correct $34 cheapest and published a $59 anchor). Default branch passes no
 * floor, so nothing is dropped.
 */
function reputableFor(
  variant: VariantEstimate,
  minPriceUsd?: number | null,
): ReturnType<typeof reputablePrice> {
  const listings = variant.reputableListings
  if (!listings?.length) return null
  const floored =
    isUsable(minPriceUsd)
      ? listings.filter((l) => l.priceUsd >= minPriceUsd * 0.95)
      : listings
  if (!floored.length) return null
  return reputablePrice(floored)
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
  // sample count — the sample count decides which side of an inversion is noise.
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
      if (entry.samples >= MIN_TRUSTED_SAMPLES) continue

      // Compare a thin LOWER tier only against a WELL-SAMPLED higher tier — a
      // noisy neighbour can't be the yardstick.
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
    // Reputable split is null on every non-reputable path; the reputable branch
    // sets both. Spread into every return so the Correction type is satisfied.
    cheapestUsd: null,
    averageUsd: null,
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

  // Reputable-seller pricing — the strongest signal, so it outranks everything
  // below (including unobtainable suppression). A price is real only if a seller
  // with 100+ reviews offers it; the model returns the reputable Cheapest and
  // the typical Average. The headline value is the Average (what it usually
  // sells for); cheapest rides alongside.
  //
  // This runs BEFORE the unobtainable check on purpose: an item can be
  // unobtainable IN-GAME yet have a thriving RESALE market (Bacuru and Egguru —
  // no longer dropped, but 23 reputable sellers actively list it at $0.50).
  // When reputable sellers are actively trading it, the market is real
  // regardless of obtainability. Only sources without review data (G2G)
  // fall through to the source-trust floor below.
  const reputable = reputableFor(variant)
  if (reputable) {
    return {
      ...base,
      valueUsd: roundCents(reputable.averageUsd),
      lowUsd: roundCents(reputable.cheapestUsd),
      highUsd: variant.highUsd ?? roundCents(reputable.averageUsd),
      cheapestUsd: roundCents(reputable.cheapestUsd),
      averageUsd: roundCents(reputable.averageUsd),
      reason: 'reputable',
      confidence: confidenceFor(reputable.reputableCount, variant.sourceCount),
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Removed / unobtainable items with NO reputable market — any listing is
  // someone dumping a dead item at a random price (Tung Tung Tung Sahur, removed
  // from the game, showed $9,999 off one listing). Publish nothing rather than a
  // confident phantom value. A human-reviewed price already returned above, and
  // an actively-traded unobtainable item took the reputable branch above; this
  // only suppresses the scraped price for genuinely dead items.
  if (meta?.obtainability === 'unobtainable') {
    return {
      ...base,
      valueUsd: null,
      lowUsd: null,
      highUsd: null,
      reason: 'insufficient_evidence',
      confidence: 'none',
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: false,
    }
  }

  // Rarity-aware minimum evidence: for the HIGH-VALUE rarities (OG/Secret) a
  // handful of listings is not a market. Below the raised threshold, publish
  // NOTHING — not even a cohort-anchored estimate — because a green price on a
  // 1-listing OG (Spyder Elephant: 14 exist, Robux-only, untradeable) reads as
  // real. This is STRICTER than the normal thin-sample handling below and only
  // applies to the high-value rarities; lower rarities keep the existing
  // anchor-at-n=1 behaviour (a wrong $2 estimate on a common item is low-stakes).
  const publishMin = minPublishSamples(meta?.rarity)
  if (publishMin > MIN_TRUSTED_SAMPLES && variant.sampleCount < publishMin) {
    return {
      ...base,
      valueUsd: null,
      lowUsd: null,
      highUsd: null,
      reason: 'insufficient_evidence',
      confidence: 'none',
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: false,
    }
  }

  // Cross-source requirement for expensive high-value items: passing the sample
  // gate is not enough when every listing comes from ONE marketplace. A
  // five-figure OG confirmed by a single source (Headless Horseman: n=5, all
  // Eldorado) is the same unconfirmed-market failure as a 1-listing item — the
  // listing count just makes it look safer than it is. Require a second source
  // before publishing above the money threshold; otherwise suppress.
  if (
    isHighValueRarity(meta?.rarity) &&
    isUsable(variant.valueUsd) &&
    (variant.valueUsd as number) >= HIGH_VALUE_MULTI_SOURCE_THRESHOLD_USD &&
    variant.sourceCount < MIN_SOURCES_HIGH_VALUE
  ) {
    return {
      ...base,
      valueUsd: null,
      lowUsd: null,
      highUsd: null,
      reason: 'insufficient_evidence',
      confidence: 'none',
      anchorUsd: anchor,
      cohortSize: cohort.length,
      isAnchored: false,
      isPublishable: false,
    }
  }

  // Well-sampled: prefer the lowest SUPPORTED price — the cheapest a buyer can
  // actually transact at — over the median midpoint. Only when there are enough
  // clustered listings to trust a floor; otherwise fall through to the median.
  if (variant.sampleCount >= MIN_TRUSTED_SAMPLES && isUsable(variant.valueUsd)) {
    const floor = variantFloor(variant)

    if (isUsable(floor)) {
      return {
        ...base,
        valueUsd: roundCents(floor),
        // Keep the real spread. The low end is now the floor itself; the high
        // end stays the median-blend's high so the range still shows headroom.
        // Clamp high to at least the floor: the floor raises the headline, and
        // the upstream catalog view coalesces a collapsed high to the point
        // value, so an unclamped high can land BELOW the floor and invert the
        // displayed range (lowUsd > highUsd).
        lowUsd: roundCents(floor),
        highUsd: roundCents(Math.max(floor, variant.highUsd ?? variant.valueUsd)),
        reason: 'floor',
        confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
        anchorUsd: anchor,
        cohortSize: cohort.length,
        isAnchored: false,
        isPublishable: true,
      }
    }

    // No trustworthy floor AND no reputable seller. Prefer the cheapest
    // SUPPORTED price (a cluster the market agrees on) over the median midpoint,
    // so a genuinely cheap item shows what a buyer actually pays instead of a
    // fabricated middle (Noobini Pizzanini: tight [2.06,2.94,6.69,6.99] → $2.06,
    // not the $4.97 median). But use lowestSupportedPrice, NOT a raw minimum, so
    // a lone bait-low ([1,8,40,120] → $1) can never set the value; when no
    // cluster is supportable we keep the median blend as before. Never advertise
    // a low below the point-5 cluster floor either.
    const supportedLow = lowestSupportedPrice(variant.listingPrices ?? [])
    const honestValue =
      isUsable(supportedLow) && supportedLow <= (variant.valueUsd ?? Infinity)
        ? supportedLow
        : variant.valueUsd
    return {
      ...base,
      valueUsd: roundCents(honestValue),
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
    // Reputable split is null on every non-reputable path; the reputable branch
    // sets both. Spread into every return so the Correction type is satisfied.
    cheapestUsd: null,
    averageUsd: null,
  }

  const defaultValue = correctedDefaults.get(variant.brainrotId)
  const multiplier = multipliers.get(variant.mutationSlug)?.multiplier
  const anchor =
    isUsable(defaultValue) && isUsable(multiplier)
      ? defaultValue * multiplier
      : null

  // A premium mutation's scraped price is IMPLAUSIBLE when it's far from what
  // the measured premium predicts — either well BELOW its own default (a
  // Radioactive can't cost less than the base) or far ABOVE default × premium
  // (Cursed Skibidi showed $916 = 5.6× default off 3 high-only listings, when
  // the measured Cursed premium is ~3.5× → ~$570 expected; the real market was
  // $325-360). Both are thin/incomplete data. Substitute the measured
  // default × premium estimate, flagged low confidence. Returns null when the
  // value is plausible or we can't judge it (no default / no measured premium).
  const premiumSanityEstimate = (value: number | null): Correction | null => {
    if (
      !isUsable(value) ||
      !isUsable(defaultValue) ||
      !isUsable(anchor) ||
      !isUsable(multiplier) ||
      multiplier <= 1
    ) {
      return null
    }
    // A mutation with ANY real premium (multiplier > 1) must not price below its
    // own default — Gold Strawberry showed $38.99 (a cluster of 4 mispriced
    // Eldorado listings) against a $676 default, i.e. 6% of the base for a 1.25×
    // item. The below-default rule therefore applies to every premium mutation.
    const belowDefault = value < defaultValue * 0.95
    // The above-ceiling rule only makes sense for a MEANINGFUL premium: a 1.25×
    // Gold has no reliable ceiling to overshoot, so restrict it to >=1.5× where
    // anchor × CEILING is a real bound (this preserves the original behaviour for
    // the ceiling side while opening the floor side to Gold/low-premium mutations).
    const aboveCeiling =
      multiplier >= MUTATION_PREMIUM_FLOOR_MULTIPLIER &&
      value > anchor * MUTATION_PREMIUM_CEILING_RATIO
    if (!belowDefault && !aboveCeiling) return null
    return {
      ...base,
      valueUsd: roundCents(anchor),
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

  // Reputable-seller pricing for the mutation — IDENTICAL primacy and treatment
  // to defaults: when reputable sellers (value-tiered review bar) are actively
  // listing this mutation, their real CHEAPEST is the price, published untouched.
  // The one legitimate ladder rule (a premium mutation can't cost below its own
  // default) is enforced by dropping sub-default listings BEFORE pricing (the
  // `anchor` floor into reputableFor), which advances the cheapest to the first
  // real at-or-above-floor listing — NOT by replacing a correct cheapest with an
  // anchored estimate. This is the fix for Cyber/Radioactive Dragon Cannelloni,
  // where premiumSanityEstimate was overriding a real $34/$32.90 floor with a
  // fabricated $59/$42 anchor. This branch is checked FIRST (before the
  // isReviewed/anchor fallbacks) so real listings always win.
  //
  // The ladder floor is the mutation's own DEFAULT value (not default×multiplier):
  // a premium mutation legitimately can't cost less than the base item, but it
  // absolutely CAN cost less than the multiplier estimate (that estimate is only a
  // rough prior). Flooring at default×multiplier would wrongly drop the real $34
  // Cyber cheapest just because $34 < $18×2. Floor at the default itself.
  const reputable = reputableFor(variant, defaultValue)
  if (reputable) {
    return {
      ...base,
      valueUsd: roundCents(reputable.averageUsd),
      lowUsd: roundCents(reputable.cheapestUsd),
      highUsd: variant.highUsd ?? roundCents(reputable.averageUsd),
      cheapestUsd: roundCents(reputable.cheapestUsd),
      averageUsd: roundCents(reputable.averageUsd),
      reason: 'reputable',
      confidence: confidenceFor(reputable.reputableCount, variant.sourceCount),
      anchorUsd: anchor,
      cohortSize: 0,
      isAnchored: false,
      isPublishable: true,
    }
  }

  // Hand-trusted raw catalog value (no reputable listings to override it).
  // Fallback only: reputable evidence, when present, already won above.
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
    const floor = variantFloor(variant)

    if (isUsable(floor)) {
      // A premium mutation floored below its default is noise, not a deal.
      const overridden = premiumSanityEstimate(floor)
      if (overridden) return overridden
      return {
        ...base,
        valueUsd: roundCents(floor),
        lowUsd: roundCents(floor),
        // Clamp high to at least the floor so a collapsed upstream high (view
        // coalesces it to the point value) can't invert the displayed range.
        highUsd: roundCents(Math.max(floor, variant.highUsd ?? variant.valueUsd)),
        reason: 'floor',
        confidence: confidenceFor(variant.sampleCount, variant.sourceCount),
        anchorUsd: anchor,
        cohortSize: 0,
        isAnchored: false,
        isPublishable: true,
      }
    }

    const overridden = premiumSanityEstimate(variant.valueUsd)
    if (overridden) return overridden
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
    // Even a thin within-fence value must respect the ladder: a premium mutation
    // priced below its own default is impossible, not a deal (Gold at $3 vs a $4
    // default). Substitute the default × premium anchor when it is.
    const overridden = premiumSanityEstimate(variant.valueUsd)
    if (overridden) return overridden
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
