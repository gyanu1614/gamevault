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
 * Minimum reputable listings before a reputable price is trustworthy. ONE lone
 * listing is not a market — a single reputable seller dumping a removed item at
 * a random price sets a confident-looking wrong value (Tung Tung Tung Sahur,
 * removed from the game, showed $9,999 off one 10k-review listing). Requiring
 * two independent reputable sellers kills the single-listing phantoms (only 5
 * items sit at n=1) while keeping every genuine market (n>=2 items agree).
 */
export const REPUTABLE_MIN_LISTINGS = 2

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

/**
 * The "average" band only includes listings within this multiple of the
 * cheapest. Some items pool wildly different income tiers into one "default"
 * price (a 550M/s Headless at $4000 next to a 16B/s Headless at $9,999), which
 * would inflate a naive median-of-5. Capping the band to CHEAPEST × this keeps
 * the average anchored to the real cheapest cluster. 2x is loose enough that
 * genuine within-tier dispersion survives (Signore $709-899, Meowl $290-330 are
 * both well under 2x, untouched) but a tier jump is excluded (Headless: the
 * $9k+ high-B/s tier drops out of the $4000 base-tier average).
 */
export const AVERAGE_MAX_SPREAD = 2.0

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

  // One lone reputable listing is not a market — a single seller dumping a
  // removed/dead item at a random price would publish a confident wrong value.
  // Require at least REPUTABLE_MIN_LISTINGS; below that, return null and let the
  // caller fall through to the floor/anchor (or show "not enough data").
  if (reputable.length < REPUTABLE_MIN_LISTINGS) return null

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

  // AVERAGE — the typical reputable price: median of the cheapest sane listings
  // from the cheapest upward, capped BOTH by count (AVERAGE_SAMPLE_SIZE) and by
  // spread (within AVERAGE_MAX_SPREAD × cheapest). The count cap keeps it robust
  // to the long expensive tail; the spread cap stops a pooled higher income tier
  // (Headless $4000 base vs $9,999 high-B/s) from inflating it. Always includes
  // at least the cheapest itself.
  const spreadLimit = cheapestUsd * AVERAGE_MAX_SPREAD
  const band = sane
    .slice(cheapestIndex, cheapestIndex + AVERAGE_SAMPLE_SIZE)
    .filter((p) => p <= spreadLimit)
  const averageUsd = median(band.length ? band : [cheapestUsd]) ?? cheapestUsd

  return {
    cheapestUsd,
    averageUsd,
    reputableCount: sane.length,
  }
}
