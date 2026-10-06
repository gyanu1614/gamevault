import { describe, it, expect } from 'vitest'
import { bestSaving, buildPriceRows, cheapestUnitPrice, ourPriceFor, savingPct, type OurPrices } from './prices'
import { getCurrencyGuide } from './index'

const flex = (offers: { pricePerUnit: number; minQty: number; stock: number }[], granularity: 'unit' | 'thousand' | 'million' = 'unit'): OurPrices => ({
  kind: 'flexible',
  granularity,
  offers,
})

describe('ourPriceFor: flexible pages', () => {
  it('is the cheapest per-unit price × amount, rounded UP to the cent', () => {
    const ours = flex([
      { pricePerUnit: 0.006, minQty: 100, stock: 90_000 },
      { pricePerUnit: 0.0052, minQty: 100, stock: 93_000 },
    ])
    expect(ourPriceFor(1000, ours)).toBe(5.2)
    expect(ourPriceFor(270, ours)).toBe(1.41) // 1.404 → 1.41, never 1.40
  })

  it("respects the seller's minimum and stock: no offer that fits → null, never a guess", () => {
    const ours = flex([{ pricePerUnit: 0.005, minQty: 1000, stock: 5000 }])
    expect(ourPriceFor(500, ours)).toBeNull() // below the minimum
    expect(ourPriceFor(11_000, ours)).toBeNull() // above stock
    expect(ourPriceFor(2000, ours)).toBe(10)
  })

  it('works in the category granularity (price per 1K / per 1M)', () => {
    expect(ourPriceFor(5000, flex([{ pricePerUnit: 3.8, minQty: 1, stock: 500 }], 'thousand'))).toBe(19)
    expect(ourPriceFor(2_000_000, flex([{ pricePerUnit: 0.49, minQty: 2, stock: 1392 }], 'million'))).toBe(0.98)
    // 50 Tokens = 0.05K, under a 1K minimum.
    expect(ourPriceFor(50, flex([{ pricePerUnit: 0.0013, minQty: 1, stock: 330_000 }], 'thousand'))).toBeNull()
  })

  it('no offers, zero prices and sub-cent totals give null', () => {
    expect(ourPriceFor(1000, flex([]))).toBeNull()
    expect(ourPriceFor(1000, flex([{ pricePerUnit: 0, minQty: 1, stock: 10_000 }]))).toBeNull()
    expect(ourPriceFor(1, flex([{ pricePerUnit: 0.000001, minQty: 1, stock: 10 }]))).toBeNull()
    expect(ourPriceFor(1000, { kind: 'none' })).toBeNull()
  })
})

describe('ourPriceFor: bundle pages', () => {
  const bundles = [
    { id: 'b800', amount: 800 },
    { id: 'b2400', amount: 2400 },
    { id: 'crew', amount: 0 },
  ]
  it('is the cheapest in-stock Global/US offer for a bundle of exactly that amount', () => {
    const ours: OurPrices = {
      kind: 'bundle',
      bundles,
      offers: [
        { bundleId: 'b800', pricePerBundle: 14.99, stock: 1000, region: null },
        { bundleId: 'b800', pricePerBundle: 6.5, stock: 3, region: 'Turkey' }, // not comparable to a US price
        { bundleId: 'b800', pricePerBundle: 7.99, stock: 0, region: 'Global' }, // sold out
        { bundleId: 'b800', pricePerBundle: 8.49, stock: 2, region: 'Global' },
      ],
    }
    expect(ourPriceFor(800, ours)).toBe(8.49)
    expect(ourPriceFor(2400, ours)).toBeNull() // bundle exists, no seller
    expect(ourPriceFor(4500, ours)).toBeNull() // no such bundle
    expect(ourPriceFor(0, ours)).toBeNull()
  })
})

describe('savingPct', () => {
  it('only when real and positive, rounded down to the whole percent', () => {
    expect(savingPct(9.99, 5.2)).toBe(47) // 47.9 → 47
    expect(savingPct(8.99, 14.99)).toBeNull() // ours costs more
    expect(savingPct(9.99, 9.99)).toBeNull()
    expect(savingPct(10, 9.95)).toBeNull() // 0.5%: not worth claiming
    expect(savingPct(null, 5)).toBeNull() // Robux-priced pack
    expect(savingPct(9.99, null)).toBeNull() // no offer
  })
})

describe('buildPriceRows + bestSaving on the real fact sheets', () => {
  it('Roblox: every official row, our price only where an offer fits, app amounts kept', () => {
    const guide = getCurrencyGuide('roblox')!
    const rows = buildPriceRows(guide, flex([{ pricePerUnit: 0.0052, minQty: 1000, stock: 10_000 }]))
    expect(rows).toHaveLength(9)
    const by = Object.fromEntries(rows.map((r) => [r.amount, r]))
    expect(by[500].oursUsd).toBeNull()
    expect(by[500].savePct).toBeNull()
    expect(by[1000]).toMatchObject({ officialUsd: 9.99, appAmount: 800, oursUsd: 5.2, savePct: 47 })
    expect(by[11000].oursUsd).toBeNull() // over stock
    expect(bestSaving(rows)?.amount).toBeGreaterThanOrEqual(1000)
  })

  it('Robux-priced packs (Grow a Garden) never show a saving', () => {
    const guide = getCurrencyGuide('grow-a-garden')!
    const rows = buildPriceRows(guide, flex([{ pricePerUnit: 1, minQty: 1, stock: 1000 }], 'thousand'))
    expect(rows.every((r) => r.officialUsd === null && r.officialRobux != null && r.savePct === null)).toBe(true)
    expect(bestSaving(rows)).toBeNull()
  })

  it('no official prices (Tarkov) or no packs (Blade Ball) → no rows', () => {
    expect(buildPriceRows(getCurrencyGuide('escape-from-tarkov')!, flex([]))).toEqual([])
    expect(buildPriceRows(getCurrencyGuide('blade-ball')!, flex([]))).toEqual([])
  })

  it('when ours is dearer everywhere there is no best saving', () => {
    const guide = getCurrencyGuide('fortnite')!
    const rows = buildPriceRows(guide, {
      kind: 'bundle',
      bundles: [{ id: 'a', amount: 800 }],
      offers: [{ bundleId: 'a', pricePerBundle: 14.99, stock: 5, region: null }],
    })
    expect(rows.find((r) => r.amount === 800)).toMatchObject({ oursUsd: 14.99, savePct: null })
    expect(bestSaving(rows)).toBeNull()
  })
})

describe('cheapestUnitPrice', () => {
  it('quotes per 1K / 1M in the granularity, per 1,000 for single units', () => {
    expect(cheapestUnitPrice(flex([{ pricePerUnit: 0.49, minQty: 2, stock: 1392 }], 'million'))).toEqual({ usd: 0.49, per: 1_000_000 })
    expect(cheapestUnitPrice(flex([{ pricePerUnit: 0.0052, minQty: 100, stock: 9000 }]))?.per).toBe(1000)
  })
  it('ignores offers whose stock is below their own minimum, and bundle pages', () => {
    expect(cheapestUnitPrice(flex([{ pricePerUnit: 4.99, minQty: 100, stock: 1 }]))).toBeNull()
    expect(cheapestUnitPrice({ kind: 'bundle', bundles: [], offers: [] })).toBeNull()
  })
})
