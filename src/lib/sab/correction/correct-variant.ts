/**
 * correctVariant: one mutation's price, anchored on its corrected default × the measured multiplier.
 *
 * Split out of lib/sab/price-correction.ts (2026-10-20, files under ~400
 * lines); the design notes live in that module's header. Import from there.
 */
import {
  ANCHOR_FENCE_RATIO,
  MARKET_PRICE_FLOOR_USD,
  MIN_TRUSTED_SAMPLES,
  MUTATION_PREMIUM_CEILING_RATIO,
  MUTATION_PREMIUM_FLOOR_MULTIPLIER,
  type Correction,
  type MutationMultiplier,
  type VariantEstimate,
} from './config'
import {
  anchorDeviation,
  confidenceFor,
  isUsable,
  reputableFor,
  roundCents,
  variantFloor,
} from './primitives'

export function correctVariant(
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
