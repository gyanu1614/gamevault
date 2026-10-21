/**
 * Thresholds, defaults and types of the SAB price correction (every value documented).
 *
 * Split out of lib/sab/price-correction.ts (2026-10-20, files under ~400
 * lines); the design notes live in that module's header. Import from there.
 */
import { type ReputableListing } from '../reputable-pricing'

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

export function isHighValueRarity(rarity: string | null | undefined): boolean {
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

export const DEFAULT_MUTATION_SLUG = 'default'

export type CorrectionInput = {
  brainrots: BrainrotMeta[]
  variants: VariantEstimate[]
}

/** A single market listing tagged with the source it came from. */
export type SourcedPrice = {
  price: number
  /** Marketplace slug, e.g. 'eldorado' | 'g2g'. */
  source: string
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
