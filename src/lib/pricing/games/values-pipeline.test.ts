/**
 * The generic values_* pricing decision (planValuesPrices) and the MM2
 * registration. Pure: the same function the dry-run script runs.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: vi.fn() }))
vi.mock('@/lib/pricing/games/sab', () => ({ runSabCorrection: vi.fn() }))
vi.mock('@/lib/pricing/games/adopt-me', () => ({ runAdoptMeCorrection: vi.fn() }))

import { MIN_EVIDENCE, STEAL_AN_EGG_POLICY, planValuesPrices } from './values-pipeline'
import { MM2_GAME_SLUG, MM2_PRICING_POLICY } from './murder-mystery-2'
import { PLACEHOLDER_HIGH_RATIO } from '@/lib/pricing/reputable-adapter'
import { findPricingGame, pricingGameKeys } from '@/lib/pricing/registry'
import { priceChangeRule } from '@/lib/pricing/config'
import { DEFAULT_PRICE_CHANGE_RULE } from '@/lib/pricing/change-rule'

const row = (item: string, price: number, reviews: number | null = 500) => ({
  matched_item_id: item,
  price_usd: price,
  seller_reviews: reviews,
})

describe('MM2 pricing registration', () => {
  it('is in the registry under its page slug, so `pnpm reprice --game=murder-mystery-2` works', () => {
    expect(pricingGameKeys()).toContain('murder-mystery-2')
    expect(findPricingGame('murder-mystery-2')?.gameSlug).toBe(MM2_GAME_SLUG)
  })

  it('uses the shared change rule (no per-game override)', () => {
    expect(priceChangeRule(MM2_GAME_SLUG, {})).toEqual(DEFAULT_PRICE_CHANGE_RULE)
  })

  it('MM2 policy: pets priced, sets not yet, placeholder trim on, $0.01 floor', () => {
    expect(MM2_PRICING_POLICY.unpricedKinds).toEqual(['bundle'])
    expect(MM2_PRICING_POLICY.placeholderHighRatio).toBe(PLACEHOLDER_HIGH_RATIO)
    expect(MM2_PRICING_POLICY.minUnitUsd).toBe(0.01)
    // Steal an Egg keeps its own rules unchanged.
    expect(STEAL_AN_EGG_POLICY.unpricedKinds).toEqual(['pet'])
    expect(STEAL_AN_EGG_POLICY.placeholderHighRatio).toBeNull()
  })
})

describe('planValuesPrices', () => {
  const priceable = new Set(['harvester', 'seer', 'thin'])

  it('needs MIN_EVIDENCE reputable listings — thinner evidence publishes nothing', () => {
    expect(MIN_EVIDENCE).toBe(3)
    const plan = planValuesPrices([row('thin', 5), row('thin', 5.2)], priceable, MM2_PRICING_POLICY)
    expect(plan.priced).toEqual([])
    const ok = planValuesPrices([row('thin', 5), row('thin', 5.2), row('thin', 5.4)], priceable, MM2_PRICING_POLICY)
    expect(ok.priced).toHaveLength(1)
    expect(ok.priced[0]).toMatchObject({ itemId: 'thin', variant: 'default', reputableCount: 3, cheapestUsd: 5 })
  })

  it('listings from sellers under 200 reviews never set a price', () => {
    const plan = planValuesPrices([row('seer', 0.3, 50), row('seer', 0.31, 120), row('seer', 0.32, 199)], priceable, MM2_PRICING_POLICY)
    expect(plan.priced).toEqual([])
  })

  it('drops a placeholder high (>10x the next) under the MM2 policy, keeps it under Steal an Egg\'s', () => {
    const rows = [row('harvester', 7.2), row('harvester', 7.4), row('harvester', 7.6), row('harvester', 9999)]
    const mm2 = planValuesPrices(rows, priceable, MM2_PRICING_POLICY)
    expect(mm2.placeholdersDropped).toBe(1)
    expect(mm2.spanByItem.get('harvester')).toEqual({ low: 7.2, high: 7.6 })
    const sae = planValuesPrices(rows, priceable, STEAL_AN_EGG_POLICY)
    expect(sae.placeholdersDropped).toBe(0)
    expect(sae.spanByItem.get('harvester')?.high).toBe(9999)
  })

  it('counts sub-floor bait and rows for unpriceable items instead of losing them silently', () => {
    const plan = planValuesPrices(
      [row('seer', 0.00001), row('not-priceable', 3), { matched_item_id: null, price_usd: 1, seller_reviews: 500 }],
      priceable,
      MM2_PRICING_POLICY,
    )
    expect(plan.droppedFakeCheap).toBe(1)
    expect(plan.skippedUnpriceable).toBe(2)
    expect(plan.listings).toEqual([])
  })

  it('never divides by a quantity: the unit price is the listed price', () => {
    const plan = planValuesPrices([row('seer', 0.3), row('seer', 0.3), row('seer', 0.3)], priceable, MM2_PRICING_POLICY)
    expect(plan.priced[0].cheapestUsd).toBe(0.3)
  })
})
