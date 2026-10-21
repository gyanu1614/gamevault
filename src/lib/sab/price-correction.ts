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
 *
 * Split into lib/sab/correction/* (2026-10-20, files under ~400 lines); this
 * module re-exports the public API.
 */

export type { ReputableListing } from './reputable-pricing'

export type {
  BrainrotMeta,
  ConfidenceLabel,
  Correction,
  CorrectionInput,
  CorrectionReason,
  MutationMultiplier,
  SourcedPrice,
  VariantEstimate,
} from './correction/config'
export {
  ANCHOR_FENCE_RATIO,
  CLUSTER_FLOOR_RATIO,
  COHORT_COST_BAND,
  FLOOR_BAND_RATIO,
  FLOOR_CLUSTER_MAX_LIFT,
  FLOOR_MIN_CLUSTER,
  FLOOR_STEP_RATIO,
  HIGH_VALUE_MULTI_SOURCE_THRESHOLD_USD,
  LADDER_MAX_INVERSION_RATIO,
  MARKET_PRICE_FLOOR_USD,
  MIN_COHORT_SIZE,
  MIN_MULTIPLIER_PAIRS,
  MIN_PUBLISH_SAMPLES_HIGH_VALUE,
  MIN_SOURCES_HIGH_VALUE,
  MIN_TRUSTED_SAMPLES,
  MIN_TRUSTED_SOURCE_LISTINGS,
  MUTATION_PREMIUM_CEILING_RATIO,
  MUTATION_PREMIUM_FLOOR_MULTIPLIER,
  TRUSTED_FLOOR_SOURCES,
  TRUSTED_FLOOR_UNDERCUT,
  minPublishSamples,
} from './correction/config'
export {
  lowestSupportedPrice,
  lowestSupportedPriceBySource,
  measureMutationMultipliers,
  median,
  quantile,
} from './correction/primitives'
export { computeCorrections } from './correction/compute'
