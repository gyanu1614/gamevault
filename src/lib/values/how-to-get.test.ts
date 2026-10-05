import { describe, expect, it } from 'vitest'
import {
  parseHowToGet,
  parseRecipe,
  parseSpinPrices,
  parseStatedOddsPct,
  unboxExpectation,
  type ValueHowToGet,
} from './how-to-get'

const box: ValueHowToGet = {
  status: 'obtainable',
  method: 'Unboxed from Mystery Box 2 in the in-game Shop (Chroma drop).',
  costs: '1,000 Coins, 100 Diamonds or 1 Mystery Key per spin',
  odds: '0.004% per spin',
  released: 'March 2020 update',
  note: null,
  sources: ['https://murder-mystery-2.fandom.com/wiki/Chroma_Lightbringer'],
  confidence: 'high',
  checkedAt: '2026-10-05',
}

describe('how_to_get parsing', () => {
  it('reads the stored object and rejects malformed rows', () => {
    const h = parseHowToGet({
      status: 'unobtainable',
      method: 'Tier 30 reward of the Halloween 2021 event pass.',
      costs: '80,000 Candies (2021)',
      sources: ['https://murder-mystery-2.fandom.com/wiki/Harvester', 'javascript:alert(1)'],
      confidence: 'high',
      checked_at: '2026-10-05',
    })
    expect(h).toMatchObject({ status: 'unobtainable', costs: '80,000 Candies (2021)', odds: null, checkedAt: '2026-10-05' })
    expect(h!.sources).toEqual(['https://murder-mystery-2.fandom.com/wiki/Harvester'])
    expect(parseHowToGet(null)).toBeNull()
    expect(parseHowToGet([])).toBeNull()
    expect(parseHowToGet({ status: 'maybe', method: 'x', checked_at: '2026-10-05' })).toBeNull()
    expect(parseHowToGet({ status: 'obtainable', method: '', checked_at: '2026-10-05' })).toBeNull()
  })

  it('only turns stated odds into a number', () => {
    expect(parseStatedOddsPct('0.2% per spin')).toBe(0.2)
    expect(parseStatedOddsPct('0.004% per spin')).toBe(0.004)
    expect(parseStatedOddsPct('under 1% (wiki estimate)')).toBeNull()
    expect(parseStatedOddsPct('1% (wiki estimate)')).toBeNull()
    expect(parseStatedOddsPct(null)).toBeNull()
  })

  it('splits per-spin prices without breaking thousands separators', () => {
    expect(parseSpinPrices(box.costs)).toEqual([
      { amount: 1000, unit: 'Coins' },
      { amount: 100, unit: 'Diamonds' },
      { amount: 1, unit: 'Mystery Key' },
    ])
    expect(parseSpinPrices('80,000 Candies (2021)')).toBeNull()
    expect(parseSpinPrices('75 Gifts per spin before the official release, then 30 Gifts')).toBeNull()
  })

  it('expects 1 / p spins, priced in every listed currency', () => {
    expect(unboxExpectation(box)).toEqual({
      oddsPct: 0.004,
      spins: 25000,
      action: 'spin',
      totals: [
        { amount: 1000, unit: 'Coins', total: 25_000_000 },
        { amount: 100, unit: 'Diamonds', total: 2_500_000 },
        { amount: 1, unit: 'Mystery Key', total: 25_000 },
      ],
    })
    expect(unboxExpectation({ ...box, odds: '0.2% per spin' })!.spins).toBe(500)
    // Not obtainable now → no grind maths, whatever the odds say.
    expect(unboxExpectation({ ...box, status: 'unobtainable' })).toBeNull()
    expect(unboxExpectation({ ...box, odds: 'under 1% (wiki estimate)' })).toBeNull()
  })

  it('reads a crafting recipe', () => {
    expect(parseRecipe('20 Legendary Shards (salvage at least 10 Legendary weapons)')).toEqual([
      { label: '20 Legendary Shards', hint: 'salvage at least 10 Legendary weapons' },
    ])
    expect(parseRecipe('10 Godly Shards + 10 Godly Metals per craft')).toEqual([
      { label: '10 Godly Shards', hint: null },
      { label: '10 Godly Metals', hint: null },
    ])
    expect(parseRecipe(null)).toBeNull()
  })
})
