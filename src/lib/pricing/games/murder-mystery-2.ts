/**
 * Murder Mystery 2 correction — the generic values_* pipeline with MM2's
 * policy. Same shared reputable model as every game: a value needs >= 3
 * listings from 200+-review sellers (the engine raises the bar to 500 / 1000
 * reviews for $100+ / $500+ items when enough such sellers exist), and is
 * published only through the shared change rule.
 *
 * MM2-specific, each with its reason:
 *  - Weapons AND pets are priced (all kind='item'); sets (kind='bundle') wait
 *    for phase 2's title matching.
 *  - Placeholder highs are trimmed (>10x the next reputable listing), as for
 *    Adopt Me: high-tier items have few listings, so one shop's out-of-stock
 *    price would otherwise become the value.
 *  - $0.01 unit floor: a VIP-server listing prices at $0.00001 × 5.3M stock;
 *    real commons clear at ~$0.05.
 *  - Chroma is its own item row (chroma-fang → fang), so every price here is
 *    the 'default' variant.
 */
import type { RepriceOptions, RepriceResult } from '@/lib/pricing/registry'
import { PLACEHOLDER_HIGH_RATIO } from '@/lib/pricing/reputable-adapter'
import { runValuesPipelineCorrection, type ValuesPricingPolicy } from './values-pipeline'

export const MM2_GAME_SLUG = 'murder-mystery-2'

export const MM2_PRICING_POLICY: ValuesPricingPolicy = Object.freeze({
  unpricedKinds: ['bundle'],
  minUnitUsd: 0.01,
  placeholderHighRatio: PLACEHOLDER_HIGH_RATIO,
  sourceCount: 1, // Eldorado only; G2G answers 403.
})

export function runMurderMystery2Correction(options: RepriceOptions = {}): Promise<RepriceResult> {
  return runValuesPipelineCorrection(MM2_GAME_SLUG, options, MM2_PRICING_POLICY)
}
