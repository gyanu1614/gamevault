/**
 * Seller rank page model. Mirrors check_seller_tier_eligibility /
 * upgrade_all_seller_tiers (90-day window; ranks only go up).
 */
import { describe, expect, it } from 'vitest'
import {
  discountLabel,
  listingLimitLabel,
  nextRank,
  pendingUpgrade,
  perksFor,
  rankStatus,
  requirementsFor,
  sortLadder,
  type RankConfig,
} from './_tiers-model'

const cfg = (tier: string, sort: number, over: Partial<RankConfig> = {}): RankConfig => ({
  tier,
  display_name: tier[0].toUpperCase() + tier.slice(1),
  description: null,
  sort_order: sort,
  gmv_90d_min: 0,
  orders_90d_min: 0,
  positive_rating_min: null,
  min_completion_rate: null,
  discount_pts: 0,
  listing_limit: null,
  banner_access: false,
  pre_moderation_listings: 0,
  bulk_daily_cap: 50,
  ...over,
})

// The live ladder (seller_tier_config, 2026-09-30), deliberately out of order.
const LADDER = sortLadder([
  cfg('gold', 3, { gmv_90d_min: 2000, orders_90d_min: 20, positive_rating_min: 93, min_completion_rate: 95, discount_pts: 1 }),
  cfg('bronze', 1, { pre_moderation_listings: 3 }),
  cfg('legendary', 5, { gmv_90d_min: 20000, orders_90d_min: 100, positive_rating_min: 98, min_completion_rate: 98, discount_pts: 2, banner_access: true }),
  cfg('silver', 2, { gmv_90d_min: 450, orders_90d_min: 5, positive_rating_min: 90, min_completion_rate: 90, discount_pts: 0.5 }),
  cfg('diamond', 4, { gmv_90d_min: 7500, orders_90d_min: 50, positive_rating_min: 96, min_completion_rate: 97, discount_pts: 1.5, banner_access: true }),
])

describe('ladder', () => {
  it('sorts low → high', () => {
    expect(LADDER.map((t) => t.tier)).toEqual(['bronze', 'silver', 'gold', 'diamond', 'legendary'])
  })

  it('statuses around the current rank', () => {
    expect(['bronze', 'silver', 'gold', 'diamond', 'legendary'].map((t) => rankStatus(LADDER, t, 'gold'))).toEqual([
      'reached',
      'reached',
      'current',
      'next',
      'locked',
    ])
  })

  it('next rank, none at the top', () => {
    expect(nextRank(LADDER, 'gold')?.tier).toBe('diamond')
    expect(nextRank(LADDER, 'legendary')).toBeNull()
  })

  it('unknown current rank reads as the entry rank', () => {
    expect(rankStatus(LADDER, 'bronze', null)).toBe('current')
    expect(nextRank(LADDER, undefined)?.tier).toBe('silver')
  })
})

describe('pendingUpgrade', () => {
  it('only when the eligible rank is ABOVE the current one', () => {
    expect(pendingUpgrade(LADDER, 'silver', 'diamond')?.tier).toBe('diamond')
  })
  it('never a "qualify for bronze" while Gold (ranks never drop)', () => {
    expect(pendingUpgrade(LADDER, 'gold', 'bronze')).toBeNull()
  })
  it('nothing when equal', () => {
    expect(pendingUpgrade(LADDER, 'gold', 'gold')).toBeNull()
  })
})

describe('requirementsFor', () => {
  const diamond = LADDER[3]

  it('uses the 90-day facts, not the legacy all-time columns', () => {
    const rows = requirementsFor(diamond, { gmv: 1200, orders: 12, positivePct: 98, completionPct: 100 })
    expect(rows.map((r) => r.key)).toEqual(['volume', 'orders', 'positive', 'completion'])
    expect(rows.map((r) => r.met)).toEqual([false, false, true, true])
    expect(rows[0].value).toBe('$1,200')
    expect(rows[0].target).toBe('$7,500')
    expect(rows[0].progress).toBeCloseTo(0.16)
  })

  it('no reviews in the window passes the feedback bar (as the SQL does)', () => {
    const rows = requirementsFor(diamond, { gmv: 0, orders: 0, positivePct: null, completionPct: 100 })
    const positive = rows.find((r) => r.key === 'positive')!
    expect(positive.met).toBe(true)
    expect(positive.value).toBe('No Reviews Yet')
  })

  it('the entry rank has no requirements', () => {
    expect(requirementsFor(LADDER[0], { gmv: 0, orders: 0, positivePct: null, completionPct: 100 })).toEqual([])
  })

  it('progress is capped at 1', () => {
    const rows = requirementsFor(LADDER[1], { gmv: 9000, orders: 99, positivePct: 99, completionPct: 99 })
    expect(rows.every((r) => r.progress === 1 && r.met)).toBe(true)
  })
})

describe('labels', () => {
  it('discount', () => {
    expect(discountLabel(0)).toBe('Standard Rate')
    expect(discountLabel(1)).toBe('−1 pt')
    expect(discountLabel(0.5)).toBe('−0.5 pts')
    expect(discountLabel(1.5)).toBe('−1.5 pts')
  })

  it('listing limit: null is unlimited (never the entry rank\'s number)', () => {
    expect(listingLimitLabel(null)).toBe('Unlimited')
    expect(listingLimitLabel(20)).toBe('Up to 20')
  })
})

describe('perksFor', () => {
  it('lists the rank step, listings, review gate, bulk cap and banner', () => {
    const bronze = perksFor(LADDER[0]).map((p) => p.label)
    expect(bronze).toContain('First 3 Offers Reviewed')
    expect(bronze).not.toContain('Custom Shop Banner')
    const legendary = perksFor(LADDER[4]).map((p) => p.label)
    expect(legendary).toContain('Offers Go Live Instantly')
    expect(legendary).toContain('Custom Shop Banner')
  })
})
