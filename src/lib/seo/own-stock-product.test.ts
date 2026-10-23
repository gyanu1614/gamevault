import { describe, expect, it } from 'vitest'
import { ownStockProduct } from './jsonld'

const base = { name: 'Bat Dragon', description: 'd', brand: 'Adopt Me', url: '/adopt-me/values/bat-dragon', image: null }

describe('ownStockProduct: offers only for what DropMarket really has', () => {
  it('no stock → no Product (an external market price is never an InStock offer)', () => {
    expect(ownStockProduct({ ...base, stock: null, offerPrices: [] })).toBeNull()
    expect(ownStockProduct({ ...base, stock: { total: 0, minPriceUsd: null }, offerPrices: [] })).toBeNull()
  })
  it('our listings → an AggregateOffer from our lowest to highest offer', () => {
    const p = ownStockProduct({ ...base, stock: { total: 3, minPriceUsd: 41.5 }, offerPrices: [41.5, 44, 52] }) as any
    expect(p.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 41.5, highPrice: 52, offerCount: 3, availability: 'https://schema.org/InStock' })
  })
  it('one listing → low = high', () => {
    const p = ownStockProduct({ ...base, stock: { total: 1, minPriceUsd: 9 }, offerPrices: [] }) as any
    expect([p.offers.lowPrice, p.offers.highPrice]).toEqual([9, 9])
  })
})
