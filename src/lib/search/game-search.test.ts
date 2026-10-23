import { describe, it, expect } from 'vitest'
import { closeness, scoreName, searchGame, type GameSearchIndex } from './game-search'

const item = (n: string) => ({ n, h: `/adopt-me/values/${n.toLowerCase().replace(/ /g, '-')}`, i: null, p: 1, k: 'Legendary Pet' })
const index: GameSearchIndex = {
  game: 'adopt-me',
  name: 'Adopt Me',
  // Index order = most popular first.
  items: [item('Shadow Dragon'), item('Bat Dragon'), item('Frost Dragon'), item('Dragon'), item('Owl'), item('Snow Owl')],
  guides: [{ t: 'How To Get A Bat Dragon', h: '/adopt-me/blog/bat-dragon' }, { t: 'Adopt Me Trading Tips', h: '/adopt-me/blog/trading' }],
}

describe('per-game search (owner, 2026-10-23)', () => {
  it('ranks the whole name, then names starting with it, then a word, then anywhere', () => {
    expect(scoreName('Dragon', 'dragon')).toBe(4)
    expect(scoreName('Dragon Egg', 'drag')).toBe(3)
    expect(scoreName('Bat Dragon', 'drag')).toBe(2)
    expect(scoreName('Snowdragon', 'drag')).toBe(1)
    expect(scoreName('Owl', 'cat')).toBe(0)
  })

  it('returns items, then guides, ties in index order', () => {
    const r = searchGame(index, 'dragon')
    expect(r.items.map((i) => i.n)).toEqual(['Dragon', 'Shadow Dragon', 'Bat Dragon', 'Frost Dragon'])
    expect(r.guides.map((g) => g.t)).toEqual(['How To Get A Bat Dragon'])
    expect(r.closeOnly).toBe(false)
  })

  it('a typo finds close spellings; random letters find nothing', () => {
    expect(closeness('Bat Dragon', 'bat dargon')).toBeGreaterThan(0.75)
    const typo = searchGame(index, 'bat dargon')
    expect(typo).toMatchObject({ closeOnly: true })
    expect(typo.items[0].n).toBe('Bat Dragon')
    expect(searchGame(index, 'ushdushfjhf')).toEqual({ items: [], guides: [], closeOnly: false })
  })

  it('ignores case, accents and punctuation', () => {
    expect(searchGame(index, 'SNOW-owl').items.map((i) => i.n)).toEqual(['Snow Owl'])
    expect(scoreName('Pokémon', 'pokemon')).toBe(4)
  })
})
