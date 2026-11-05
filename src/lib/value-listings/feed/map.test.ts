import { describe, it, expect } from 'vitest'
import { fromAdoptMe, fromGeneric, fromSab, withMarketItems } from './map'
import type { ValuesFeed } from './types'

describe('values feed mappers', () => {
  it('Adopt Me: the Fly Ride form carries the trend, value and its label; only pets with a page link', () => {
    const [pet, noPage] = fromAdoptMe([
      {
        slug: 'frost-dragon',
        name: 'Frost Dragon',
        rarity: 'legendary',
        imageUrl: '/f.png',
        topTradeValue: 0,
        demandRank: 3,
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
      rarityKey: 'legendary',
      itemType: null,
      isNew: true,
      trendPct: 6.8,
      trendLabel: 'FR',
      valueUsd: 89.99,
      popularRank: 3,
    })
    expect(noPage).toMatchObject({ href: null, isNew: false, trendPct: null, trendLabel: null, valueUsd: null, popularRank: null })
  })

  it('Steal a Brainrot: average price first, its value page, numeric strings parsed', () => {
    const [b] = fromSab([{ slug: 'tung', name: 'Tung', rarity: 'Secret', image_url: '/t.png', average_usd: null, display_price_usd: '12.5', trendPct: -3, isNew: false }] as never)
    expect(b).toEqual({ slug: 'tung', name: 'Tung', imageUrl: '/t.png', href: '/steal-a-brainrot/values/tung', rarityKey: 'Secret', itemType: null, isNew: false, trendPct: -3, trendLabel: null, valueUsd: 12.5, popularRank: null })
  })

  it('generic: passes the row through, market price first', () => {
    const [r] = fromGeneric([{ slug: 'harvester', name: 'Harvester', rarity: 'Godly', itemType: 'knife', imageUrl: null, href: '/murder-mystery-2/values/harvester', trendPct: 2.1, marketUsd: 7, cheapestUsd: 6, isNew: true }] as never)
    expect(r).toEqual({ slug: 'harvester', name: 'Harvester', imageUrl: null, href: '/murder-mystery-2/values/harvester', rarityKey: 'Godly', itemType: 'knife', isNew: true, trendPct: 2.1, trendLabel: null, valueUsd: 7, popularRank: null })
  })
})

describe('withMarketItems', () => {
  const pet = { slug: 'parrot', name: 'Parrot', imageUrl: '/p.png', href: '/adopt-me/values/parrot', rarityKey: 'legendary', itemType: null, isNew: false, trendPct: 3, trendLabel: 'FR', valueUsd: 50, popularRank: 2 }
  const feed = { items: [pet], stock: { 'crystal-egg': 2 }, buyHref: {}, minPrice: { 'crystal-egg': 4 }, forms: {}, categorySlug: 'buy-items' } as unknown as ValuesFeed

  it('no eggs in the catalogue: the same feed, so the page shows no types', () => {
    expect(withMarketItems(feed, [{ slug: 'parrot', name: 'Parrot' }])).toBe(feed)
  })

  it('types the pets and adds the eggs and potions with no rarity, value page or value', () => {
    const out = withMarketItems(feed, [
      { slug: 'parrot', name: 'Parrot' },
      { slug: 'crystal-egg', name: 'Crystal Egg', imageUrl: '/e.png', popularRank: 3, kind: 'egg' },
      { slug: 'fly-potion', name: 'Fly Potion', kind: 'potion' },
    ])
    expect(out.items.map((i) => [i.slug, i.itemType])).toEqual([['parrot', 'Pets'], ['crystal-egg', 'Eggs'], ['fly-potion', 'Potions']])
    expect(out.items[1]).toMatchObject({ imageUrl: '/e.png', popularRank: 3, rarityKey: null, href: null, valueUsd: null, isNew: false })
    expect(out.items[2].imageUrl).toBeNull()
    expect(out.stock).toEqual(feed.stock)
  })
})
