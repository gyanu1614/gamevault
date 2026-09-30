/** Items grid ordering: best offer (cheapest in stock) pinned first by default. */
import { describe, expect, it } from 'vitest'
import { bestOfferId, sortOffers } from './_itemsSort'
import type { ItemOffer } from './_itemsTypes'

const offer = (id: string, price: number, extra: Partial<ItemOffer> = {}): ItemOffer =>
  ({
    id,
    pricePerUnit: price,
    stock: 5,
    isUnlimited: false,
    recommended: 50,
    seller: { ratingPercent: null, sales: 0 },
    ...extra,
  }) as unknown as ItemOffer

describe('bestOfferId', () => {
  it('is the cheapest offer that is in stock', () => {
    expect(bestOfferId([offer('a', 5), offer('b', 1, { stock: 0 }), offer('c', 2)])).toBe('c')
  })
  it('counts unlimited stock as in stock', () => {
    expect(bestOfferId([offer('a', 5), offer('b', 1, { stock: null, isUnlimited: true })])).toBe('b')
  })
  it('is null with fewer than two offers to compare', () => {
    expect(bestOfferId([offer('a', 5)])).toBeNull()
  })
})

describe('sortOffers', () => {
  const list = [
    offer('hi-rec', 9, { recommended: 99 }),
    offer('cheap', 1, { recommended: 10 }),
    offer('mid', 4, { recommended: 60 }),
  ]

  it('recommended: best offer first, the rest by recommended score', () => {
    expect(sortOffers(list, 'recommended').map((o) => o.id)).toEqual(['cheap', 'hi-rec', 'mid'])
  })

  it('an explicit sort is honoured as-is (no pin)', () => {
    expect(sortOffers(list, 'price-desc').map((o) => o.id)).toEqual(['hi-rec', 'mid', 'cheap'])
  })

  it('does not mutate its input', () => {
    const copy = [...list]
    sortOffers(list, 'recommended')
    expect(list).toEqual(copy)
  })
})
