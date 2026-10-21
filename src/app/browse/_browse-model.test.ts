import { describe, it, expect } from 'vitest'
import { gamesByLetter, popularGames, type BrowseGame } from './_browse-model'

const g = (name: string, sort_order: number | null = 99): BrowseGame => ({
  id: name,
  slug: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  image_url: null,
  sort_order,
  href: `/${name.toLowerCase()}`,
})

// Owner, 2026-10-15: /browse in the new UI. The 240-game tile wall becomes a
// popular row plus a compact A to Z index.
describe('/browse model', () => {
  it('groups games A to Z, digits and symbols under #, names sorted', () => {
    const groups = gamesByLetter([g('Roblox'), g('99 Nights in the Forest'), g('Adopt Me'), g('+1 Speed Keyboard Escape'), g('anime dice'), g('Rust')])
    expect(groups.map((x) => x.letter)).toEqual(['#', 'A', 'R'])
    expect(groups[1].games.map((x) => x.name)).toEqual(['Adopt Me', 'anime dice'])
    expect(groups[0].games.map((x) => x.name)).toEqual(['+1 Speed Keyboard Escape', '99 Nights in the Forest'])
  })

  it('popular = the hand-ordered games (sort order below 99), in that order, at most 12', () => {
    const list = [g('MM2', 1), g('Roblox', 1), g('Zeta', 99), ...Array.from({ length: 14 }, (_, i) => g(`G${i}`, i + 2))]
    const top = popularGames(list)
    expect(top).toHaveLength(12)
    expect(top[0].name).toBe('MM2')
    expect(top.some((x) => x.name === 'Zeta')).toBe(false)
  })
})
