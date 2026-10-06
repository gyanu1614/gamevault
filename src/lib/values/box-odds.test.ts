import { describe, expect, it } from 'vitest'
import {
  drawsForChance,
  expectedDraws,
  expectedValue,
  fmtDraws,
  fmtOddsPct,
  medianDraws,
  oddsTotal,
  perItemPct,
  roundingNote,
} from './box-odds'

describe('per-item odds (tier split evenly, the in-game rule)', () => {
  it('splits a tier across its items', () => {
    expect(perItemPct(70, 4)).toBe(17.5)
    expect(perItemPct(15, 3)).toBeCloseTo(5, 10)
    expect(perItemPct(0.2, 7)).toBeCloseTo(0.028571, 5)
    expect(perItemPct(0.004, 1)).toBe(0.004)
  })

  it('has no figure without a stated chance or items', () => {
    expect(perItemPct(null, 3)).toBeNull()
    expect(perItemPct(70, 0)).toBeNull()
    expect(perItemPct(0, 2)).toBeNull()
  })
})

describe('spins', () => {
  it('expected draws are 1 / p', () => {
    expect(expectedDraws(0.2)).toBe(500)
    expect(expectedDraws(0.004)).toBe(25_000)
    expect(expectedDraws(100)).toBe(1)
  })

  it('the median is the smallest n with a 50% chance: ceil(ln 0.5 / ln(1 − p))', () => {
    expect(medianDraws(0.2)).toBe(347) // 346.2 → 347
    expect(medianDraws(0.004)).toBe(17_329) // 17,328.3 → 17,329
    expect(medianDraws(50)).toBe(1)
    expect(medianDraws(100)).toBe(1)
    // At the median the chance is at least 50%, one fewer is below.
    const p = 0.002
    const n = medianDraws(0.2)
    expect(1 - (1 - p) ** n).toBeGreaterThanOrEqual(0.5)
    expect(1 - (1 - p) ** (n - 1)).toBeLessThan(0.5)
  })

  it('other chances', () => {
    expect(drawsForChance(0.2, 0.9)).toBe(1151)
  })

  it('rejects impossible inputs', () => {
    expect(() => expectedDraws(0)).toThrow(RangeError)
    expect(() => medianDraws(-1)).toThrow(RangeError)
    expect(() => drawsForChance(0.2, 1)).toThrow(RangeError)
  })
})

describe('expected value per spin', () => {
  it('is Σ tier% × the average price of the tier', () => {
    const ev = expectedValue([
      { pct: 70, prices: [0.1, 0.3] }, // avg 0.2 → 0.14
      { pct: 30, prices: [1] }, // → 0.3
    ])
    expect(ev?.usd).toBeCloseTo(0.44, 10)
    expect(ev).toMatchObject({ pricedItems: 3, items: 3 })
  })

  it('uses the odds as shown, the 100.2% included (no normalising)', () => {
    const ev = expectedValue([
      { pct: 70, prices: [1] },
      { pct: 15, prices: [1] },
      { pct: 10, prices: [1] },
      { pct: 5, prices: [1] },
      { pct: 0.2, prices: [1] },
      { pct: 0.004, prices: [1] },
    ])
    expect(ev?.usd).toBeCloseTo(1.00204, 10)
  })

  it('averages over the priced items of a tier (an unpriced one does not count as $0)', () => {
    expect(expectedValue([{ pct: 100, prices: [2, null] }])?.usd).toBe(2)
    expect(expectedValue([{ pct: 100, prices: [2, null] }])).toMatchObject({ pricedItems: 1, items: 2 })
  })

  it('is null when a tier with items has no stated chance or no priced item', () => {
    expect(expectedValue([{ pct: 70, prices: [1] }, { pct: null, prices: [5] }])).toBeNull()
    expect(expectedValue([{ pct: 70, prices: [1] }, { pct: 0.2, prices: [null] }])).toBeNull()
  })

  it('ignores tiers without items, and is null with none at all', () => {
    expect(expectedValue([{ pct: 100, prices: [3] }, { pct: null, prices: [] }])?.usd).toBe(3)
    expect(expectedValue([])).toBeNull()
  })
})

describe('the rounding note', () => {
  const current = [
    { rarity: 'Common', pct: 70 },
    { rarity: 'Uncommon', pct: 15 },
    { rarity: 'Rare', pct: 10 },
    { rarity: 'Legendary', pct: 5 },
    { rarity: 'Godly', pct: 0.2 },
    { rarity: 'Chroma', pct: 0.004 },
  ]

  it('totals the tiers without the separate Chroma line, free of float noise', () => {
    expect(oddsTotal(current)).toBe(100.2)
    expect(roundingNote(current)).toEqual({ total: 100.2, over: 0.2 })
  })

  it('says nothing when the tiers make 100%', () => {
    expect(roundingNote([{ rarity: 'Rare', pct: 70 }, { rarity: 'Legendary', pct: 30 }])).toBeNull()
  })

  it('has no total when a tier lacks a figure', () => {
    expect(oddsTotal([{ rarity: 'Common', pct: 70 }, { rarity: 'Godly', pct: null }])).toBeNull()
    expect(roundingNote([{ rarity: 'Common', pct: 70 }, { rarity: 'Godly', pct: null }])).toBeNull()
  })
})

describe('formats', () => {
  it('percent: stated digits kept, small ones to two significant figures, never an exponent', () => {
    expect(fmtOddsPct(70)).toBe('70')
    expect(fmtOddsPct(17.5)).toBe('17.5')
    expect(fmtOddsPct(70 / 3)).toBe('23.33')
    expect(fmtOddsPct(0.2)).toBe('0.2')
    expect(fmtOddsPct(0.004)).toBe('0.004')
    expect(fmtOddsPct(0.2 / 7)).toBe('0.029')
    expect(fmtOddsPct(0.004 / 7)).toBe('0.00057')
    expect(fmtOddsPct(0.1)).toBe('0.1')
  })

  it('draws: whole numbers with commas', () => {
    expect(fmtDraws(25_000)).toBe('25,000')
    expect(fmtDraws(3500.4)).toBe('3,500')
  })
})
