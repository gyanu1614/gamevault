/**
 * Steal An Egg correction — the generic values_* pipeline with Steal an Egg's
 * policy (src/lib/pricing/games/values-pipeline.ts holds the shared code).
 *
 * Steal an Egg's one game-specific rule: pets are never priced. Only 1.5% of
 * live listings name a pet, so there is no evidence to price them — they are
 * catalogue pages that link to their source egg's price instead.
 */
import type { RepriceOptions, RepriceResult } from '@/lib/pricing/registry'
import { STEAL_AN_EGG_POLICY, runValuesPipelineCorrection } from './values-pipeline'

export {
  MAX_BELIEVABLE_STOCK,
  MIN_BELIEVABLE_UNIT_USD,
  MIN_EVIDENCE,
  STEAL_AN_EGG_POLICY,
  sameStoredPrice,
} from './values-pipeline'

export function runStealAnEggCorrection(
  gameSlug = 'steal-an-egg',
  options: RepriceOptions = {},
): Promise<RepriceResult> {
  return runValuesPipelineCorrection(gameSlug, options, STEAL_AN_EGG_POLICY)
}
