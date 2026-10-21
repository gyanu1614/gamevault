import { describe, expect, it } from 'vitest'
import { TRADE_BENCHMARKS, benchmarkLabel, formatTradeValue, tradePoints } from './trade-points'

describe('trade points', () => {
  it('MM2 sits on the community scale: Harvester = 250', () => {
    const b = TRADE_BENCHMARKS['murder-mystery-2']
    expect([b.slug, b.points]).toEqual(['harvester', 250])
    expect(tradePoints(7.5, 7.5, b.points)).toBe(250)
    expect(tradePoints(5.62, 7.5, b.points)).toBe(187.33)
    expect(benchmarkLabel(187.33, b)).toBe('≈ 0.7 Harvesters')
    expect(benchmarkLabel(2500, b)).toBe('≈ 10 Harvesters')
  })
  it('defaults to a 100-point scale (Adopt Me: Frost Dragon FR = 100)', () => {
    expect(tradePoints(41.5, 83, undefined)).toBe(50)
    expect(benchmarkLabel(320, { one: 'Frost', many: 'Frosts' })).toBe('≈ 3.2 Frosts')
    expect(tradePoints(null, 7.5)).toBeNull()
  })
  it('rounds one way everywhere', () => {
    expect([formatTradeValue(140000), formatTradeValue(187.33), formatTradeValue(5.84), formatTradeValue(0.034)]).toEqual(['140K', '187', '5.8', '0.03'])
  })
})
