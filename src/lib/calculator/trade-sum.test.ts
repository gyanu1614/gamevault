import { describe, it, expect } from 'vitest'
import { sumSide, tradeVerdict, usdToCents, type TradeLine } from './trade-sum'

const line = (pointUsd: number | null, extra: Partial<TradeLine> = {}): TradeLine => ({
  pointUsd,
  quantity: 1,
  ...extra,
})

describe('sumSide', () => {
  it('counts a $0.62 estimate (no rounding to zero)', () => {
    const side = sumSide([line(0.62)])
    expect(side.pointCents).toBe(62)
    expect(side.unknown).toBe(0)
  })

  it('counts $0.10 and $0.01 estimates', () => {
    const side = sumSide([line(0.1), line(0.01)])
    expect(side.pointCents).toBe(11)
    expect(side.unknown).toBe(0)
  })

  it('totals nine $0.62 items exactly as $5.58', () => {
    expect(sumSide([line(0.62, { quantity: 9 })]).pointCents).toBe(558)
    expect(sumSide(Array.from({ length: 9 }, () => line(0.62))).pointCents).toBe(558)
  })

  it('sums the low and high ends in cents', () => {
    const side = sumSide([
      line(0.1, { lowUsd: 0.1, highUsd: 0.2 }),
      line(0.2, { lowUsd: 0.2, highUsd: 0.3 }),
    ])
    expect(side.lowCents).toBe(30)
    expect(side.highCents).toBe(50)
  })

  it('widens a range that does not contain the point value', () => {
    // Live row: point $0.62, market range $15–$15.
    const side = sumSide([line(0.62, { lowUsd: 15, highUsd: 15 })])
    expect(side.lowCents).toBe(62)
    expect(side.highCents).toBe(1500)
  })

  it('treats only a truly missing estimate as unknown, and names it', () => {
    const side = sumSide([line(0.62), line(null, { label: 'Garama (Diamond)' })])
    expect(side.pointCents).toBe(62)
    expect(side.unknown).toBe(1)
    expect(side.unknownLabels).toEqual(['Garama (Diamond)'])
  })

  it('counts low-confidence lines without dropping them', () => {
    const side = sumSide([line(0.62, { lowConfidence: true }), line(1)])
    expect(side.pointCents).toBe(162)
    expect(side.lowConfidence).toBe(1)
  })
})

describe('tradeVerdict', () => {
  it('gives "win" for $0.62 given against $75 received', () => {
    const give = sumSide([line(0.62, { lowUsd: 2, highUsd: 2, lowConfidence: true })])
    const receive = sumSide([line(75, { lowUsd: 75, highUsd: 223.53 })])
    expect(tradeVerdict(give, receive)?.kind).toBe('win')
  })

  it('pauses when any line on either side has no estimate', () => {
    const give = sumSide([line(0.62), line(null)])
    const receive = sumSide([line(75)])
    expect(tradeVerdict(give, receive)).toBeNull()
  })

  it('needs items on both sides', () => {
    expect(tradeVerdict(sumSide([line(1)]), sumSide([]))).toBeNull()
  })

  it('gives "loss" when you give far more than you get', () => {
    expect(tradeVerdict(sumSide([line(75)]), sumSide([line(0.62)]))?.kind).toBe('loss')
  })

  it('gives "fair" for equal sides', () => {
    expect(tradeVerdict(sumSide([line(10)]), sumSide([line(10)]))?.kind).toBe('fair')
  })

  it('reports the percentage and cent difference', () => {
    const v = tradeVerdict(sumSide([line(10)]), sumSide([line(12)]))
    expect(v?.diffCents).toBe(200)
    expect(v?.pct).toBeCloseTo(20)
  })
})

describe('usdToCents', () => {
  it('avoids float drift', () => {
    expect(usdToCents(0.62)).toBe(62)
    expect(usdToCents(0.1 + 0.2)).toBe(30)
    expect(usdToCents(223.53)).toBe(22353)
  })
})
