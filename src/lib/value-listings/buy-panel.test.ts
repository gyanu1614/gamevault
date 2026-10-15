import { describe, it, expect } from 'vitest'
import { buyPanel } from './buy-panel'

// Owner, 2026-10-14: a big "$258" market price above "Buy From $289.99" makes
// our offer read as overpriced — the first number seen becomes the reference.
// The hero now leads with the price you can buy at HERE; the market price is a
// small reference under it, with the saving when we are under it.
describe('buyPanel', () => {
  const market = { marketUsd: 290, cheapestUsd: 283 }

  it('leads with our price when the variant is listed, market as the reference', () => {
    expect(buyPanel({ kind: 'in_stock', ourUsd: 289.99, count: 1, ...market })).toEqual({
      label: 'On DropMarket',
      usd: 289.99,
      from: false,
      reference: { label: 'Market Price', usd: 290 },
      saveUsd: null,
    })
  })

  it('says "from" when several of our offers stand behind the price', () => {
    expect(buyPanel({ kind: 'in_stock', ourUsd: 289.99, count: 3, ...market }).from).toBe(true)
  })

  it('shows the saving only when we are clearly under market (2%+)', () => {
    expect(buyPanel({ kind: 'in_stock', ourUsd: 249, count: 1, ...market }).saveUsd).toBe(41)
    expect(buyPanel({ kind: 'in_stock', ourUsd: 286, count: 1, ...market }).saveUsd).toBeNull()
    expect(buyPanel({ kind: 'in_stock', ourUsd: 310, count: 1, ...market }).saveUsd).toBeNull()
  })

  it('falls back to the cheapest as the market reference when there is no typical price', () => {
    expect(buyPanel({ kind: 'in_stock', ourUsd: 10, count: 1, marketUsd: null, cheapestUsd: 12 }).reference).toEqual({
      label: 'Market Price',
      usd: 12,
    })
  })

  it('heads with the TYPICAL market price (not the cheapest) when we have none of this variant', () => {
    for (const kind of ['other_variants', 'none'] as const) {
      expect(buyPanel({ kind, ourUsd: 674, count: 2, ...market })).toEqual({
        label: 'Market Price',
        usd: 290,
        from: false,
        reference: null, // $283 is within the gap: no near-duplicate number
        saveUsd: null,
      })
    }
  })

  it('adds the cheapest under the market price when it is meaningfully lower', () => {
    expect(buyPanel({ kind: 'none', ourUsd: null, count: 0, marketUsd: 290, cheapestUsd: 200 }).reference).toEqual({
      label: 'Cheapest',
      usd: 200,
    })
  })

  it('labels a cheapest-only price honestly, and leaves no price to the caller', () => {
    expect(buyPanel({ kind: 'none', ourUsd: null, count: 0, marketUsd: null, cheapestUsd: 12 })).toMatchObject({
      label: 'Cheapest Price',
      usd: 12,
    })
    expect(buyPanel({ kind: 'none', ourUsd: null, count: 0, marketUsd: null, cheapestUsd: null }).usd).toBeNull()
  })

  it('takes a game label for the market number (Adopt Me "Cash Value")', () => {
    expect(buyPanel({ kind: 'none', ourUsd: null, count: 0, marketUsd: 5, cheapestUsd: null, marketLabel: 'Cash Value' }).label).toBe(
      'Cash Value',
    )
  })
})
