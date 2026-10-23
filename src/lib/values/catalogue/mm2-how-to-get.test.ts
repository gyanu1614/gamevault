import { describe, expect, it } from 'vitest'
import { mm2HowToGet } from './mm2-how-to-get'
import type { ObtainSource } from './mm2-wiki'

const URL = 'https://murder-mystery-2.fandom.com/wiki/Embersickle'
const src = (over: Partial<ObtainSource>): ObtainSource => ({
  kind: 'box',
  name: '2026 Halloween Box',
  year: 2026,
  method: 'Unbox',
  cost: null,
  odds_pct: null,
  still_obtainable: true,
  wiki_page: null,
  ...over,
})
const item = (obtain: ObtainSource[], releaseYear: number | null = 2026, origin: string | null = obtain[0]?.name ?? null) => ({ obtain, releaseYear, origin })

describe('mm2HowToGet', () => {
  it('a box: where, both prices, the stated odds, in the stored key order', () => {
    const h = mm2HowToGet(
      item([src({ cost: { amount: 600, currency: 'Candies' }, alt_costs: [{ amount: 1, currency: 'Halloween Key' }], odds_pct: 0.2, odds_text: '0.2%' })]),
      URL,
      '2026-10-22',
    )
    expect(h).toEqual({
      status: 'obtainable',
      method: 'Unboxed from the 2026 Halloween Box.',
      costs: '600 Candies or 1 Halloween Key',
      odds: '0.2%',
      released: '2026 (2026 Halloween Box)',
      sources: [URL],
      confidence: 'medium',
      checked_at: '2026-10-22',
    })
    expect(Object.keys(h!)).toEqual(['status', 'method', 'costs', 'odds', 'released', 'sources', 'confidence', 'checked_at'])
  })

  it('a current-year source the wiki marks unavailable reads as seasonal, an old one as gone (past tense)', () => {
    expect(mm2HowToGet(item([src({ still_obtainable: false })]), URL, '2026-10-22')).toMatchObject({ status: 'seasonal', method: 'Unboxed from the 2026 Halloween Box.' })
    const old = mm2HowToGet(item([src({ name: 'Knife Box 2', year: 2019, still_obtainable: false })], 2019), URL, '2026-10-22')
    expect(old).toMatchObject({ status: 'unobtainable', method: 'Was unboxed from the Knife Box 2 (2019).' })
  })

  it('an event pass, a gamepass, crafting, a code and a shop', () => {
    expect(mm2HowToGet(item([src({ kind: 'pass', name: 'Halloween Event 2026', method: 'Tier Reward' })]), URL, '2026-10-22')?.method).toBe('Tier Reward in the Halloween Event 2026.')
    expect(mm2HowToGet(item([src({ kind: 'pass', name: 'Halloween Event 2026', method: 'Formerly' })]), URL, '2026-10-22')?.method).toBe('Reward of the Halloween Event 2026.')
    expect(
      mm2HowToGet(item([src({ kind: 'gamepass', name: 'Elite', year: null, cost: { amount: 499, currency: 'Robux' } })], null), URL, '2026-10-22'),
    ).toMatchObject({ method: 'Comes with the Elite gamepass.', costs: '499 Robux' })
    expect(mm2HowToGet(item([src({ kind: 'crafting', name: 'Crafting', year: null })], null), URL, '2026-10-22')?.method).toBe('Crafted at the Crafting Station.')
    expect(mm2HowToGet(item([src({ kind: 'code', name: 'RBBATTLE', year: null })], null), URL, '2026-10-22')?.method).toBe('Redeemed from a code (RBBATTLE).')
    expect(mm2HowToGet(item([src({ kind: 'shop', name: 'Shop', year: null })], null), URL, '2026-10-22')?.method).toBe('Bought from the Shop.')
  })

  it('names up to two more sources', () => {
    const h = mm2HowToGet(item([src({}), src({ kind: 'shop', name: 'Shop' }), src({ kind: 'code', name: 'X' }), src({ kind: 'code', name: 'Y' })]), URL, '2026-10-22')
    expect(h?.method).toBe('Unboxed from the 2026 Halloween Box. Also from the Shop and X, plus 1 more.')
  })

  it('no usable source → null (never a made-up method)', () => {
    expect(mm2HowToGet(item([]), URL, '2026-10-22')).toBeNull()
    expect(mm2HowToGet(item([src({ kind: 'unobtainable', name: 'Scrapped' })]), URL, '2026-10-22')).toBeNull()
  })
})
