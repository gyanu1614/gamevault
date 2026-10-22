/**
 * Statistics, floors, multipliers and cohorts the SAB price correction is built from.
 *
 * Split out of lib/sab/price-correction.ts (2026-10-20, files under ~400
 * lines); the design notes live in that module's header. Import from there.
 */
import { reputablePrice } from '../reputable-pricing'
import {
  CLUSTER_FLOOR_RATIO,
  COHORT_COST_BAND,
  DEFAULT_MUTATION_SLUG,
  FLOOR_BAND_RATIO,
  FLOOR_CLUSTER_MAX_LIFT,
  FLOOR_MIN_CLUSTER,
  FLOOR_STEP_RATIO,
  MIN_COHORT_SIZE,
  MIN_MULTIPLIER_PAIRS,
  MIN_TRUSTED_SAMPLES,
  MIN_TRUSTED_SOURCE_LISTINGS,
  TRUSTED_FLOOR_SOURCES,
  TRUSTED_FLOOR_UNDERCUT,
  type BrainrotMeta,
  type ConfidenceLabel,
  type MutationMultiplier,
  type SourcedPrice,
  type VariantEstimate,
} from './config'

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
export function variantFloor(variant: VariantEstimate): number | null {
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
export function reputableFor(
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
export function clampLowToClusterFloor(
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

export function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100
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
export function cohortPricesFor(
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
export function confidenceFor(
  sampleCount: number,
  sourceCount: number,
): ConfidenceLabel {
  if (sampleCount >= 10 && sourceCount >= 2) return 'high'
  if (sampleCount >= MIN_TRUSTED_SAMPLES) return 'medium'
  return 'low'
}

/** Ratio distance from an anchor, direction-agnostic (2x and 0.5x are equal). */
export function anchorDeviation(value: number, anchor: number): number {
  return value >= anchor ? value / anchor : anchor / value
}
