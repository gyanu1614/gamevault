/**
 * computeCorrections: the two-pass correction over every variant, plus the mutation ladder.
 *
 * Split out of lib/sab/price-correction.ts (2026-10-20, files under ~400
 * lines); the design notes live in that module's header. Import from there.
 */
import {
  DEFAULT_MUTATION_SLUG,
  LADDER_MAX_INVERSION_RATIO,
  MIN_TRUSTED_SAMPLES,
  type Correction,
  type CorrectionInput,
  type VariantEstimate,
} from './config'
import { isUsable, measureMutationMultipliers } from './primitives'
import { correctDefault } from './correct-default'
import { correctVariant } from './correct-variant'

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
