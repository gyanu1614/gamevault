import { describe, expect, it } from 'vitest'
import { currencyMarketPrice, itemMarketPrice, median, HINT_MIN_OFFERS } from './hint'

const NOW = new Date('2026-10-08T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

describe('median', () => {
  it('is the middle value of an odd list', () => {
    expect(median([5, 1, 3])).toBe(3)
  })
  it('is the mean of the two middle values of an even list', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
  it('is null for an empty list', () => {
    expect(median([])).toBeNull()
  })
})

describe('itemMarketPrice (values pricing)', () => {
  const base = { usd: 42, offers: 18, updatedAt: daysAgo(1), isEstimate: false }

  it('returns the market price, offer count and date when the data is solid', () => {
    expect(itemMarketPrice(base, NOW)).toEqual({ usd: 42, offers: 18, updatedAt: base.updatedAt })
  })

  it('hides when fewer than the minimum offers back the price', () => {
    expect(itemMarketPrice({ ...base, offers: HINT_MIN_OFFERS - 1 }, NOW)).toBeNull()
  })

  it('hides a price older than 14 days', () => {
    expect(itemMarketPrice({ ...base, updatedAt: daysAgo(15) }, NOW)).toBeNull()
  })

  it('hides a price with no date (freshness unknown)', () => {
    expect(itemMarketPrice({ ...base, updatedAt: null }, NOW)).toBeNull()
  })

  it('never shows an estimated (derived) price', () => {
    expect(itemMarketPrice({ ...base, isEstimate: true }, NOW)).toBeNull()
  })

  it('hides a missing or non-positive price', () => {
    expect(itemMarketPrice({ ...base, usd: null }, NOW)).toBeNull()
    expect(itemMarketPrice({ ...base, usd: 0 }, NOW)).toBeNull()
  })
})

describe('currencyMarketPrice (live DropMarket offers)', () => {
  const offer = (price: number, extra: Partial<{ stock: number; minQty: number; unlimited: boolean }> = {}) => ({
    price,
    stock: 1000,
    minQty: 1,
    unlimited: false,
    ...extra,
  })

  it('is the median per-unit price of the live offers, with the count', () => {
    expect(currencyMarketPrice([offer(3.5), offer(3.8), offer(4.2)])).toEqual({ usd: 3.8, offers: 3 })
  })

  it('keeps sub-cent per-unit prices (Robux per 1)', () => {
    expect(currencyMarketPrice([offer(0.0052), offer(0.0055), offer(0.006)])).toEqual({ usd: 0.0055, offers: 3 })
  })

  it('rounds the median to 4 decimals', () => {
    expect(currencyMarketPrice([offer(0.00521), offer(0.00552), offer(0.00553), offer(0.006)])?.usd).toBe(0.0055)
  })

  it('skips offers that cannot fill their own minimum', () => {
    const offers = [offer(1), offer(3.5), offer(3.8), offer(4.2, { stock: 5, minQty: 10 })]
    expect(currencyMarketPrice(offers)).toEqual({ usd: 3.5, offers: 3 })
  })

  it('counts unlimited-stock offers as in stock', () => {
    expect(currencyMarketPrice([offer(3, { stock: 0, unlimited: true }), offer(4), offer(5)])).toEqual({ usd: 4, offers: 3 })
  })

  it('hides when fewer than the minimum offers are live', () => {
    expect(currencyMarketPrice([offer(3.5), offer(3.8)])).toBeNull()
  })

  it('ignores zero or broken prices', () => {
    expect(currencyMarketPrice([offer(0), offer(Number.NaN), offer(3), offer(4)])).toBeNull()
  })
})
