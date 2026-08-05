/**
 * Reputable-seller pricing — the "what does a real buyer actually pay" model.
 *
 * The core insight the old floor missed: a marketplace price is only real if a
 * REPUTABLE seller is offering it. Eldorado exposes each seller's total review
 * count; a seller with thousands of completed orders (ratingCount) listing a
 * price is signal, a zero-review account is noise. Every wrong value we shipped
 * traced to trusting no-review listings — Skibidi $190 (real ~$218), Headless
 * $369 off $14-34 zero-review fakes (real ~$4000+).
 *
 * Two buyer-facing numbers, no range:
 *   CHEAPEST — the lowest price a reputable seller offers that is REASONABLE:
 *              not a fake-cheap bait, and not a lone low sitting far below the
 *              real cluster (a $849 Headless under a $4000-6600 cluster is a
 *              different/mispriced item, not the floor).
 *   AVERAGE  — the typical reputable price: the median of the cheapest handful
 *              of reputable listings (the "sells around here" band), robust to
 *              the long expensive tail.
 *
 * This module is pure and deterministic (no clock, no I/O) so it is fully
 * unit-tested against real observed prices.
 */

/** Minimum total reviews for a seller to count as reputable. */
export const REPUTABLE_MIN_REVIEWS = 100

/**
 * A reputable listing priced below this fraction of the reputable median is a
 * fake/bait, not a deal — a $0.25 listing against a $700 market. Dropped before
 * anything else. Kept loose (25%) so genuine cheap listings survive; only the
 * absurd get cut.
 */
export const FAKE_CHEAP_RATIO = 0.25

/**
 * The listing that SETS the cheapest must have support above it: the next
 * reputable listing up may be at most this multiple of it. A larger gap means
 * the low listing is isolated (a $849/$1000 Headless under a $4000+ cluster —
 * a mislabeled or wrong-tier item), so we advance to where the real cluster
 * begins. 2x is deliberately generous: it only skips a genuine chasm, not
 * ordinary dispersion.
 */
export const CHEAPEST_MAX_GAP = 2

/** How many of the cheapest reputable listings define the "average" band. */
export const AVERAGE_SAMPLE_SIZE = 5

export type ReputableListing = {
  priceUsd: number
  /** Seller's total review/order count (Eldorado userOrderInfo.ratingCount). */
  reviews: number
}

export type ReputablePrice = {
  cheapestUsd: number
  averageUsd: number
  /** Reputable listings considered (after the fake-cheap cut). */
  reputableCount: number
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function median(values: number[]): number | null {
  const sorted = values
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Compute the reputable cheapest + average for one variant's listings.
 *
 * Returns null when there is no reputable evidence at all (no 100+ review seller,
 * or all their listings are fake-cheap) — the item then shows "not enough data"
 * rather than a fabricated price.
 */
export function reputablePrice(
  listings: ReputableListing[],
): ReputablePrice | null {
  const reputable = listings
    .filter((l) => isFinitePositive(l.priceUsd) && l.reviews >= REPUTABLE_MIN_REVIEWS)
    .map((l) => l.priceUsd)
    .sort((a, b) => a - b)

  if (!reputable.length) return null

  // Drop fake-cheap baits: below FAKE_CHEAP_RATIO of the reputable median. Use
  // the median of the full reputable set so a cluster of baits can't drag the
  // reference down (median resists a low tail far better than the mean).
  const refMedian = median(reputable)
  if (refMedian == null) return null
  const sane = reputable.filter((p) => p >= refMedian * FAKE_CHEAP_RATIO)
  if (!sane.length) return null

  // CHEAPEST — walk up from the lowest sane price until we find one whose next
  // neighbour is within CHEAPEST_MAX_GAP. A lone low separated by a bigger gap
  // is skipped (Headless $849 under a $4000 cluster). If none qualifies (every
  // step is a chasm), the market is too scattered to trust a floor below the
  // top, so fall back to the last (highest) sane price — but that only happens
  // for pathological single-listing tails.
  let cheapestIndex = sane.length - 1
  for (let i = 0; i < sane.length - 1; i += 1) {
    if (sane[i + 1] <= sane[i] * CHEAPEST_MAX_GAP) {
      cheapestIndex = i
      break
    }
  }
  const cheapestUsd = sane[cheapestIndex]

  // AVERAGE — the typical reputable price: median of the AVERAGE_SAMPLE_SIZE
  // cheapest sane listings from the cheapest upward. Robust to the long
  // expensive tail (a handful of $2000+ listings can't move it), and always has
  // enough support because it's a fixed small count, not a percentage band.
  const band = sane.slice(cheapestIndex, cheapestIndex + AVERAGE_SAMPLE_SIZE)
  const averageUsd = median(band) ?? cheapestUsd

  return {
    cheapestUsd,
    averageUsd,
    reputableCount: sane.length,
  }
}
