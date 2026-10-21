import { describe, expect, it } from 'vitest'

import { computeAdoptMeTradeValues, type ObservedPrice } from './adopt-me-trade-value'

// Frost Dragon FR is the benchmark: its price = 100 points.
const frost = (v: string, usd: number): ObservedPrice => ({ petId: 'frost', rarity: 'legendary', variant: v, priceUsd: usd })
const p = (petId: string, v: string, usd: number, rarity = 'legendary'): ObservedPrice => ({ petId, rarity, variant: v, priceUsd: usd })

// Five legendaries priced at both FR and NFR (NFR = 2× FR) so the rarity ratio exists.
const pairs = ['a', 'b', 'c', 'd', 'e'].flatMap((id, i) => [p(id, 'FR', 10 * (i + 1)), p(id, 'NFR', 20 * (i + 1))])

describe('computeAdoptMeTradeValues', () => {
  it('scores every observed form against Frost Dragon FR = 100', () => {
    const out = computeAdoptMeTradeValues([frost('FR', 80), p('bat', 'FR', 256), ...pairs])!
    expect(out.benchmarkUsd).toBe(80)
    expect(out.values.get('bat:FR')).toEqual({ trade: 320, estimated: false })
    expect(out.values.get('frost:FR')).toEqual({ trade: 100, estimated: false })
  })

  it('fills a missing form from the same pet, using ratios measured from our own prices', () => {
    const out = computeAdoptMeTradeValues([frost('FR', 80), p('owl', 'FR', 64), ...pairs])!
    expect(out.ratios.legendary.NFR).toBe(2)
    expect(out.values.get('owl:NFR')).toEqual({ trade: 160, estimated: true })
  })

  it('anchors on another form when FR itself is missing', () => {
    const out = computeAdoptMeTradeValues([frost('FR', 80), p('crow', 'NFR', 32), ...pairs])!
    expect(out.values.get('crow:FR')).toEqual({ trade: 20, estimated: true })
  })

  it('needs 5 pets per ratio; fewer means no estimate rather than a guess', () => {
    const out = computeAdoptMeTradeValues([frost('FR', 80), p('owl', 'FR', 64), p('x', 'FR', 10), p('x', 'MEGA', 90)])!
    expect(out.values.get('owl:MEGA')).toBeUndefined()
  })

  it('without a Frost Dragon FR price it does nothing (keeps yesterday)', () => {
    expect(computeAdoptMeTradeValues([p('bat', 'FR', 256)])).toBeNull()
  })
})
