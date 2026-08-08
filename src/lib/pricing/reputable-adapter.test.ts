import { describe, expect, it } from 'vitest'

import {
  computeReputablePrices,
  groupReputableListings,
  priceGroupedListings,
  variantKey,
  type RawListing,
} from './reputable-adapter'

describe('groupReputableListings', () => {
  it('groups by item+variant and keeps only rows with price AND reviews', () => {
    const listings: RawListing[] = [
      { itemId: 'pet-a', variant: 'FR', priceUsd: 100, reviews: 500 },
      { itemId: 'pet-a', variant: 'FR', priceUsd: 110, reviews: 200 },
      { itemId: 'pet-a', variant: 'NEON', priceUsd: 300, reviews: 400 },
      // dropped: no reviews
      { itemId: 'pet-a', variant: 'FR', priceUsd: 90, reviews: null },
      // dropped: bad price
      { itemId: 'pet-a', variant: 'FR', priceUsd: 0, reviews: 500 },
    ]

    const grouped = groupReputableListings(listings)

    expect(grouped.get(variantKey('pet-a', 'FR'))).toHaveLength(2)
    expect(grouped.get(variantKey('pet-a', 'NEON'))).toHaveLength(1)
  })

  it('keeps different items separate even on the same variant', () => {
    const grouped = groupReputableListings([
      { itemId: 'pet-a', variant: 'FR', priceUsd: 100, reviews: 500 },
      { itemId: 'pet-b', variant: 'FR', priceUsd: 999, reviews: 500 },
    ])

    expect(grouped.size).toBe(2)
    expect(grouped.get(variantKey('pet-a', 'FR'))?.[0].priceUsd).toBe(100)
    expect(grouped.get(variantKey('pet-b', 'FR'))?.[0].priceUsd).toBe(999)
  })
})

describe('priceGroupedListings', () => {
  it('omits groups the engine rejects (single reputable listing)', () => {
    const grouped = groupReputableListings([
      { itemId: 'pet-a', variant: 'FR', priceUsd: 100, reviews: 500 },
    ])
    // One lone reputable listing is not a market → engine returns null → absent.
    expect(priceGroupedListings(grouped).size).toBe(0)
  })

  it('carries itemId + variant through onto the result', () => {
    const priced = computeReputablePrices([
      { itemId: 'pet-a', variant: 'FR', priceUsd: 100, reviews: 500 },
      { itemId: 'pet-a', variant: 'FR', priceUsd: 105, reviews: 300 },
    ])
    const result = priced.get(variantKey('pet-a', 'FR'))
    expect(result?.itemId).toBe('pet-a')
    expect(result?.variant).toBe('FR')
    expect(result?.cheapestUsd).toBe(100)
  })
})

describe('computeReputablePrices — matches the engine on real SAB shapes', () => {
  it('reproduces the Skibidi cheapest/average through the adapter', () => {
    // Same listings the engine test uses for Skibidi (cheapest 217.99).
    const priced = computeReputablePrices([
      { itemId: 'skibidi', variant: 'default', priceUsd: 217.99, reviews: 4771 },
      { itemId: 'skibidi', variant: 'default', priceUsd: 224, reviews: 1200 },
      { itemId: 'skibidi', variant: 'default', priceUsd: 224, reviews: 900 },
      { itemId: 'skibidi', variant: 'default', priceUsd: 230, reviews: 300 },
      { itemId: 'skibidi', variant: 'default', priceUsd: 249, reviews: 150 },
    ])
    const result = priced.get(variantKey('skibidi', 'default'))
    expect(result?.cheapestUsd).toBe(217.99)
    expect(result?.averageUsd).toBe(224)
  })

  it('ignores sub-100-review sellers when picking the cheapest', () => {
    const priced = computeReputablePrices([
      // A zero-rep $50 bait must not set the floor.
      { itemId: 'x', variant: 'default', priceUsd: 50, reviews: 3 },
      { itemId: 'x', variant: 'default', priceUsd: 200, reviews: 500 },
      { itemId: 'x', variant: 'default', priceUsd: 210, reviews: 400 },
    ])
    const result = priced.get(variantKey('x', 'default'))
    expect(result?.cheapestUsd).toBe(200)
  })
})
