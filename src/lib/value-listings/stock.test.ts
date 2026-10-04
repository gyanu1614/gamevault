import { describe, it, expect } from 'vitest'
import { aggregateStock, otherVariants, pickSimilarItems } from './stock'

describe('aggregateStock', () => {
  it('groups live listings by item and variant with the cheapest unit price', () => {
    const map = aggregateStock([
      { itemSlug: 'bat-dragon', variant: 'neon', unitPriceUsd: 40 },
      { itemSlug: 'bat-dragon', variant: 'neon', unitPriceUsd: 35.5 },
      { itemSlug: 'bat-dragon', variant: null, unitPriceUsd: 30 },
      { itemSlug: 'parrot', variant: 'fly-ride', unitPriceUsd: 54.99 },
    ])
    expect(map.get('bat-dragon')).toEqual({
      total: 3,
      minPriceUsd: 30,
      byVariant: { neon: { count: 2, minPriceUsd: 35.5 } },
    })
    expect(map.get('parrot')?.total).toBe(1)
    expect(map.get('owl')).toBeUndefined()
  })

  it('ignores rows without a usable price', () => {
    const map = aggregateStock([{ itemSlug: 'x', variant: null, unitPriceUsd: Number.NaN }])
    expect(map.get('x')).toBeUndefined()
  })
})

describe('otherVariants', () => {
  it('lists the listed variants except the chosen one, cheapest first', () => {
    const stock = aggregateStock([
      { itemSlug: 'd', variant: 'gold', unitPriceUsd: 5 },
      { itemSlug: 'd', variant: 'default', unitPriceUsd: 1 },
      { itemSlug: 'd', variant: 'diamond', unitPriceUsd: 9 },
    ]).get('d')!
    expect(otherVariants(stock, 'diamond')).toEqual([
      { variant: 'default', count: 1, minPriceUsd: 1 },
      { variant: 'gold', count: 1, minPriceUsd: 5 },
    ])
  })
})

describe('pickSimilarItems', () => {
  const catalog = [
    { slug: 'target', name: 'Target', rarity: 'secret', valueUsd: 10 },
    { slug: 'same-rarity-close', name: 'A', rarity: 'secret', valueUsd: 12 },
    { slug: 'same-rarity-far', name: 'B', rarity: 'secret', valueUsd: 500 },
    { slug: 'other-rarity-close', name: 'C', rarity: 'mythic', valueUsd: 10.5 },
    { slug: 'no-stock', name: 'D', rarity: 'secret', valueUsd: 10 },
  ]
  const inStock = new Set(['same-rarity-close', 'same-rarity-far', 'other-rarity-close', 'target'])

  it('keeps only items with stock, same rarity first, then nearest value', () => {
    expect(pickSimilarItems('target', catalog, (s) => inStock.has(s), 4).map((i) => i.slug)).toEqual([
      'same-rarity-close',
      'same-rarity-far',
      'other-rarity-close',
    ])
  })

  it('respects the limit', () => {
    expect(pickSimilarItems('target', catalog, (s) => inStock.has(s), 1)).toHaveLength(1)
  })
})
