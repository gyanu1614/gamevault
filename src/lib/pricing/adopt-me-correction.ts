/**
 * Adopt Me price correction — the reputable-seller pass for Adopt Me.
 *
 * Adopt Me is simpler than SAB: no income multipliers, no cross-cohort
 * anchoring. Its pricing is exactly the shared reputable model — group the raw
 * listings by pet+variant, keep the clean/reputable ones, compute cheapest +
 * average — plus a ladder-sanity check (a lower form can't out-price a higher
 * one) that is Adopt Me-specific.
 *
 * Runs from the unified correct-prices cron. Pure over its inputs (the I/O — DB
 * read/write — lives in the cron) so the decision logic is unit-testable.
 */

import {
  computeReputablePrices,
  variantKey,
  type RawListing,
  type VariantReputablePrice,
} from './reputable-adapter'

/** Ladder rank — higher = more valuable form. Lower forms can't out-price. */
export const LADDER_RANK: Record<string, number> = {
  N: 0,
  F: 1,
  R: 1,
  FR: 2,
  NEON: 3,
  NFR: 4,
  MEGA: 5,
  MFR: 6,
}

/** A lower form priced above this multiple of the top form is mislabeled noise. */
const LADDER_TOLERANCE = 1.05

/** Confidence label from the reputable-listing count — mirrors the SQL helper. */
export function confidenceFor(count: number): string {
  if (count >= 25) return 'highly_accurate'
  if (count >= 10) return 'high'
  if (count >= 3) return 'medium'
  return 'low'
}

export type AdoptMeVariantCorrection = {
  petId: string
  variant: string
  cheapestUsd: number
  averageUsd: number
  reputableCount: number
  confidence: string
}

/**
 * Compute reputable corrections for one game's worth of Adopt Me raw listings.
 *
 * Input rows must already be cleanliness-filtered by the caller (active, not a
 * known-bad row). Returns one correction per pet+variant that has a reputable
 * price, AFTER dropping ladder violations. Pets/variants without reputable
 * evidence are simply absent — the caller leaves their existing estimate.
 */
export function correctAdoptMePrices(
  listings: RawListing[],
): AdoptMeVariantCorrection[] {
  const priced = computeReputablePrices(listings)

  // Regroup priced results by pet so the ladder check can compare a pet's own
  // forms against each other.
  const byPet = new Map<string, VariantReputablePrice[]>()
  for (const result of priced.values()) {
    const list = byPet.get(result.itemId)
    if (list) list.push(result)
    else byPet.set(result.itemId, [result])
  }

  const corrections: AdoptMeVariantCorrection[] = []

  for (const [petId, variants] of byPet) {
    // The top-ranked form present is the anchor; a lower form priced above it
    // (beyond tolerance) is mislabeled noise and dropped.
    const anchor = variants
      .filter((v) => LADDER_RANK[v.variant] != null)
      .sort((a, b) => LADDER_RANK[b.variant] - LADDER_RANK[a.variant])[0]

    for (const v of variants) {
      if (
        anchor &&
        LADDER_RANK[v.variant] != null &&
        LADDER_RANK[v.variant] < LADDER_RANK[anchor.variant] &&
        v.averageUsd > anchor.averageUsd * LADDER_TOLERANCE
      ) {
        // Ladder violation — skip (keeps existing estimate rather than publish
        // a lower form above a higher one).
        continue
      }

      corrections.push({
        petId,
        variant: v.variant,
        cheapestUsd: v.cheapestUsd,
        averageUsd: v.averageUsd,
        reputableCount: v.reputableCount,
        confidence: confidenceFor(v.reputableCount),
      })
    }
  }

  return corrections
}

export { variantKey }
