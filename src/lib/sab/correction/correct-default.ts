/**
 * correctDefault: one brainrot's default (unmutated) price, anchored against its cohort.
 *
 * Split out of lib/sab/price-correction.ts (2026-10-20, files under ~400
 * lines); the design notes live in that module's header. Import from there.
 */
import {
  ANCHOR_FENCE_RATIO,
  HIGH_VALUE_MULTI_SOURCE_THRESHOLD_USD,
  MARKET_PRICE_FLOOR_USD,
  MIN_SOURCES_HIGH_VALUE,
  MIN_TRUSTED_SAMPLES,
  isHighValueRarity,
  minPublishSamples,
  type BrainrotMeta,
  type Correction,
  type VariantEstimate,
} from './config'
import {
  anchorDeviation,
  clampLowToClusterFloor,
  cohortPricesFor,
  confidenceFor,
  isUsable,
  lowestSupportedPrice,
  median,
  quantile,
  reputableFor,
  roundCents,
  variantFloor,
} from './primitives'

export function correctDefault(
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
