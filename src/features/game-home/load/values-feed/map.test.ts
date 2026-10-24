import { describe, it, expect } from 'vitest'
import { fromAdoptMe, fromGeneric, fromSab } from './map'

describe('values feed mappers', () => {
  it('Adopt Me: the Fly Ride form carries the trend, value and its label; only pets with a page link', () => {
    const [pet, noPage] = fromAdoptMe([
      {
        slug: 'frost-dragon',
        name: 'Frost Dragon',
        rarity: 'legendary',
        imageUrl: '/f.png',
        topTradeValue: 0,
        demandRank: null,
        hasPage: true,
        isNew: true,
        values: { FR: { variant: 'FR', tradeValue: null, cashUsd: 89.99, cheapestUsd: 80, averageUsd: 89.99, isEstimated: false, confidence: 'high', trendPct: 6.8 } },
      },
      { slug: 'x', name: 'X', rarity: 'common', imageUrl: null, topTradeValue: 0, demandRank: null, hasPage: false, values: {} },
    ] as never)
    expect(pet).toEqual({
      slug: 'frost-dragon',
      name: 'Frost Dragon',
      imageUrl: '/f.png',
      href: '/adopt-me/values/frost-dragon',
      isNew: true,
      trendPct: 6.8,
      trendLabel: 'FR',
      valueUsd: 89.99,
    })
    expect(noPage).toMatchObject({ href: null, isNew: false, trendPct: null, trendLabel: null, valueUsd: null })
  })

  it('Steal a Brainrot: average price first, its value page, numeric strings parsed', () => {
    const [b] = fromSab([{ slug: 'tung', name: 'Tung', image_url: '/t.png', average_usd: null, display_price_usd: '12.5', trendPct: -3, isNew: false }] as never)
    expect(b).toEqual({ slug: 'tung', name: 'Tung', imageUrl: '/t.png', href: '/steal-a-brainrot/values/tung', isNew: false, trendPct: -3, trendLabel: null, valueUsd: 12.5 })
  })

  it('generic: passes the row through, market price first', () => {
    const [r] = fromGeneric([{ slug: 'harvester', name: 'Harvester', imageUrl: null, href: '/murder-mystery-2/values/harvester', trendPct: 2.1, marketUsd: 7, cheapestUsd: 6, isNew: true }] as never)
    expect(r).toEqual({ slug: 'harvester', name: 'Harvester', imageUrl: null, href: '/murder-mystery-2/values/harvester', isNew: true, trendPct: 2.1, trendLabel: null, valueUsd: 7 })
  })
})
