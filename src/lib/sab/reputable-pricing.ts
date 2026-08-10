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

/**
 * Minimum total reviews for a seller to count as reputable — SCALED BY VALUE.
 * A fake on a $0.50 item costs a buyer 50 cents; a fake on a $5000 Headless
 * costs thousands, so the trust bar rises with the money at stake:
 *   < $100      → 200+ reviews  (an established shop)
 *   $100-$500   → 500+ reviews
 *   > $500      → 1000+ reviews (only the most-proven sellers set a headline)
 * The threshold is chosen from the item's own rough price (a first pass at the
 * base bar), then the set is re-filtered — see reputablePrice().
 */
export const REPUTABLE_MIN_REVIEWS = 200 // base tier (< $100)
export const REPUTABLE_MIN_REVIEWS_MID = 500 // $100-$500
export const REPUTABLE_MIN_REVIEWS_HIGH = 1000 // > $500
export const REPUTABLE_TIER_MID_USD = 100
export const REPUTABLE_TIER_HIGH_USD = 500

/** The review bar for a given item value. */
export function reviewBarForValue(valueUsd: number): number {
  if (valueUsd > REPUTABLE_TIER_HIGH_USD) return REPUTABLE_MIN_REVIEWS_HIGH
  if (valueUsd > REPUTABLE_TIER_MID_USD) return REPUTABLE_MIN_REVIEWS_MID
  return REPUTABLE_MIN_REVIEWS
}

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

/**
 * "Cheapest, but not a LONELY cheapest." The listing that sets the headline
 * price must have SUPPORT — at least one other reputable listing within this
 * multiple of it — so a single seller sitting alone at the bottom can't set a
 * fragile floor that jumps the moment they delist. If the lowest listing has no
 * neighbour within this ratio, we advance to the first one that does. This is
 * tighter than CHEAPEST_MAX_GAP (which only skips a huge chasm); this keeps the
 * headline anchored to a price a couple of sellers actually agree on.
 *
 * 1.4 = the cheapest and its supporter are within 40% (John Pork $260 with
 * $309/$320 above → $260 stands; a lone $200 under a $260-cluster → advance to
 * $260). Set at 1.4 not 1.3 because high-value items legitimately disperse more
 * at the bottom — Headless's real $4000 floor sits 1.37x under its $5489
 * supporter, and that $4000 must survive. Loose enough for genuine dispersion,
 * tight enough to reject a lone low sitting well under the cluster.
 */
export const CHEAPEST_SUPPORT_RATIO = 1.4

/** A cluster this small can't demand support — one listing IS the market. */
export const CHEAPEST_SUPPORT_MIN_CLUSTER = 3

/**
 * The support rule only applies AT/ABOVE this value. Below it, a low from a
 * reputable (200+ review) seller is trusted as the cheapest even if it sits
 * well under the next listing — cheap items legitimately have a wide low tail
 * ($0.60 vs $2 Boba Panda) and hiding the real floor there misleads buyers. The
 * lone-fake risk the support rule guards against is only material on expensive
 * items (a $849 bait under a $4000 Headless cluster).
 */
export const SUPPORT_MIN_VALUE_USD = 50

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
  const valid = listings.filter((l) => isFinitePositive(l.priceUsd))

  // PASS 1 — the base bar (200+) to estimate the item's value tier.
  const basePrices = valid
    .filter((l) => l.reviews >= REPUTABLE_MIN_REVIEWS)
    .map((l) => l.priceUsd)
    .sort((a, b) => a - b)
  if (basePrices.length < REPUTABLE_MIN_LISTINGS) return null

  // PASS 2 — pick the review bar from the rough value (the base-bar median),
  // then re-filter. A $5000 item now demands 1000+ review sellers; a $0.50 item
  // stays at 200+. USE CASE: if the higher bar leaves fewer than the minimum
  // listings (an expensive item few 1000-review sellers touch), step DOWN a tier
  // rather than show nothing — some reputable evidence beats none.
  const roughValue = median(basePrices) ?? basePrices[0]
  const tiers = [
    reviewBarForValue(roughValue),
    REPUTABLE_MIN_REVIEWS_MID,
    REPUTABLE_MIN_REVIEWS,
  ]
  let reputable: number[] = basePrices
  for (const bar of tiers) {
    const filtered = valid
      .filter((l) => l.reviews >= bar)
      .map((l) => l.priceUsd)
      .sort((a, b) => a - b)
    if (filtered.length >= REPUTABLE_MIN_LISTINGS) {
      reputable = filtered
      break
    }
  }

  if (reputable.length < REPUTABLE_MIN_LISTINGS) return null

  // Drop fake-cheap baits: below FAKE_CHEAP_RATIO of the reputable median. Use
  // the median of the full reputable set so a cluster of baits can't drag the
  // reference down (median resists a low tail far better than the mean).
  const refMedian = median(reputable)
  if (refMedian == null) return null
  const sane = reputable.filter((p) => p >= refMedian * FAKE_CHEAP_RATIO)
  if (!sane.length) return null

  // CHEAPEST — the lowest reputable price, with a support rule that ONLY applies
  // to higher-value items. The lone-low risk is real for expensive items (a fake
  // $849 under a $4000 Headless cluster) but HARMFUL for cheap ones: a $0.60
  // Boba Panda from a 5373-review seller is genuinely the cheapest, yet a support
  // rule would skip it to $2 just because its neighbour is far in ratio terms.
  // So: below SUPPORT_MIN_VALUE_USD, the lowest sane reputable price IS the
  // cheapest (a 200+ review seller at a low price is trusted). At/above it, a
  // lone low must have a neighbour within CHEAPEST_SUPPORT_RATIO or we advance.
  const highValue = (median(sane) ?? sane[0]) >= SUPPORT_MIN_VALUE_USD
  const requireSupport =
    highValue && sane.length >= CHEAPEST_SUPPORT_MIN_CLUSTER
  let cheapestIndex = 0
  if (requireSupport) {
    // High-value: the cheapest must have a close neighbour (else it's a lone
    // low we advance past). Fall back to the highest sane price if nothing
    // qualifies (pathological single-listing tail).
    cheapestIndex = sane.length - 1
    for (let i = 0; i < sane.length - 1; i += 1) {
      if (sane[i + 1] / sane[i] <= CHEAPEST_SUPPORT_RATIO) {
        cheapestIndex = i
        break
      }
    }
  }
  // Not high-value → index 0: the lowest sane reputable price. Fakes were
  // already removed by the fake-cheap cut, so a 200+ review seller's low price
  // is the real cheapest (Boba Panda $0.60 from 5373 reviews).
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
