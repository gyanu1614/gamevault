/**
 * TiersClient renders the owner-reported cases right (2026-09-30): a Gold
 * seller whose 90-day window only qualifies for Bronze sees no "qualify for
 * bronze" line, real volume bars toward Diamond (never "0 / 0"), and
 * Unlimited offers rather than Bronze's number.
 */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as any).React = React
import { TiersClient } from './_TiersClient'
import type { RankConfig } from './_tiers-model'

const row = (tier: string, sort: number, o: Partial<RankConfig>): RankConfig => ({
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
  ...o,
})
const LADDER = [
  row('bronze', 1, { pre_moderation_listings: 3 }),
  row('silver', 2, { gmv_90d_min: 450, orders_90d_min: 5, positive_rating_min: 90, min_completion_rate: 90, discount_pts: 0.5 }),
  row('gold', 3, { gmv_90d_min: 2000, orders_90d_min: 20, positive_rating_min: 93, min_completion_rate: 95, discount_pts: 1 }),
  row('diamond', 4, { gmv_90d_min: 7500, orders_90d_min: 50, positive_rating_min: 96, min_completion_rate: 97, discount_pts: 1.5, banner_access: true }),
  row('legendary', 5, { gmv_90d_min: 20000, orders_90d_min: 100, positive_rating_min: 98, min_completion_rate: 98, discount_pts: 2, banner_access: true }),
]

const render = (p: Record<string, unknown>) =>
  renderToStaticMarkup(
    h(TiersClient as any, {
      ladder: LADDER,
      isSeller: true,
      currentTier: 'gold',
      eligibleTier: 'bronze',
      window: { gmv: 0, orders: 0, positivePct: null, completionPct: 100 },
      floorPct: 2,
      ...p,
    }),
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

describe('TiersClient', () => {
  it('Gold seller qualifying for Bronze: no downgrade line, real bars to Diamond', () => {
    const t = render({})
    expect(t).not.toMatch(/qualify for bronze/i)
    expect(t).toContain('Progress to Diamond')
    expect(t).toContain('$0 / $7,500')
    expect(t).not.toContain('0 / 0')
    expect(t).toContain('Unlimited Offers')
    expect(t).toContain('−1 pt Off Your Rate')
  })

  it('shows the upgrade notice only when the window qualifies for a higher rank', () => {
    expect(render({ currentTier: 'silver', eligibleTier: 'diamond' })).toContain('You qualify for Diamond')
  })

  it('buyers get the ladder and a way in, not a rank', () => {
    const t = render({ isSeller: false, currentTier: 'bronze', eligibleTier: 'bronze' })
    expect(t).toContain('Become a Seller')
    expect(t).not.toContain('Progress to')
  })

  it('the top rank has no next rank', () => {
    expect(render({ currentTier: 'legendary', eligibleTier: 'legendary' })).toContain('Top Rank Reached')
  })
})
