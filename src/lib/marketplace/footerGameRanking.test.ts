import { describe, expect, it } from 'vitest'
import { rankFooterGames, tallyByGame, FOOTER_VISIBLE_GAMES } from './footerGameRanking'

const game = (id: string, sort_order: number | null = null, name = id) => ({ id, slug: id, name, sort_order })

describe('rankFooterGames', () => {
  const games = [game('a', 1), game('b', 2), game('c', 3), game('d', 4)]
  const withCats = new Set(['a', 'b', 'c', 'd'])

  it('orders by 30-day paid orders first', () => {
    const out = rankFooterGames(games, withCats, { orders30d: { c: 5, b: 2 } })
    expect(out.map((g) => g.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('breaks order ties by active listing count, then trend signal', () => {
    const out = rankFooterGames(games, withCats, {
      orders30d: { a: 1, b: 1 },
      activeListings: { b: 10, a: 3, d: 1 },
      trendPeak: { c: 50_000 },
    })
    // a/b tie on orders → b wins on listings; c has no orders/listings but a
    // trend signal; d has a listing, which outranks a trend-only game.
    expect(out.map((g) => g.id)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('falls back to the curated sort_order, then name, with no signals', () => {
    const out = rankFooterGames(
      [game('z', null, 'Zed'), game('y', 2), game('x', 1), game('w', null, 'Alpha')],
      new Set(['w', 'x', 'y', 'z']),
      {},
    )
    expect(out.map((g) => g.id)).toEqual(['x', 'y', 'w', 'z'])
  })

  it('drops games with no enabled category', () => {
    const out = rankFooterGames(games, new Set(['a', 'c']), { orders30d: { b: 99 } })
    expect(out.map((g) => g.id)).toEqual(['a', 'c'])
  })

  it('caps the result at the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => game(`g${i}`, i))
    const out = rankFooterGames(many, new Set(many.map((g) => g.id)), {}, 24)
    expect(out).toHaveLength(24)
    expect(out[0].id).toBe('g0')
  })

  it('ignores negative / non-finite signal values', () => {
    const out = rankFooterGames(games, withCats, { orders30d: { d: Number.NaN, c: -3 } })
    expect(out.map((g) => g.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('shows six games in the always-visible row', () => {
    expect(FOOTER_VISIBLE_GAMES).toBe(6)
  })
})

describe('tallyByGame', () => {
  it('counts rows per game id and skips nulls', () => {
    expect(tallyByGame(['a', 'b', 'a', null, undefined, 'a'])).toEqual({ a: 3, b: 1 })
  })
})
