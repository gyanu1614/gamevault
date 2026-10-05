import { describe, expect, it } from 'vitest'
import { aboutSentence, chromaSentence, itemFaq, priceSentence, type ItemCopyInput } from './valueListItemCopy'

const harvester: ItemCopyInput = {
  name: 'Harvester',
  gameName: 'Murder Mystery 2',
  shortName: 'MM2',
  rarity: 'Ancient',
  typeNoun: 'gun',
  releaseYear: 2021,
  origin: 'Halloween Event 2021',
  obtain: [
    { kind: 'pass', name: 'Halloween Event 2021', year: 2021, cost: null, odds_pct: null, still_obtainable: false },
  ],
  cheapestUsd: 7.2,
  marketUsd: 7.55,
  listedNow: 63,
  priceChangedAt: '2026-10-05T07:47:00Z',
  counterpart: null,
}

describe('value-list item copy', () => {
  it('states the item from its own catalogue facts', () => {
    expect(aboutSentence(harvester)).toBe(
      'Harvester is an Ancient gun in Murder Mystery 2, released in 2021 as a battle-pass reward in the Halloween Event 2021.',
    )
  })

  it('gives a dated, listing-backed price sentence', () => {
    expect(priceSentence(harvester)).toBe(
      'As of October 5, 2026, Harvester is worth about $7.55 in MM2 — its verified market price — and starts at $7.20 from professional sellers.',
    )
    expect(priceSentence({ ...harvester, cheapestUsd: null })).toBeNull()
  })

  it('links a Chroma to its base with the real price ratio', () => {
    const chroma: ItemCopyInput = {
      ...harvester,
      name: 'Chroma Fang',
      rarity: 'Chroma',
      typeNoun: 'knife',
      cheapestUsd: 1.16,
      counterpart: { name: 'Fang', isChroma: false, cheapestUsd: 0.49 },
    }
    expect(chromaSentence(chroma)).toContain('Chroma form of the Fang')
    expect(chromaSentence(chroma)).toContain('about 2.4×')
    const base = { ...harvester, name: 'Fang', counterpart: { name: 'Chroma Fang', isChroma: true, cheapestUsd: 1.16 }, cheapestUsd: 0.49 }
    expect(chromaSentence(base)).toContain('Its Chroma form, the Chroma Fang')
  })

  it('never claims obtainability or drop odds', () => {
    const text = itemFaq(harvester).map((f) => `${f.q} ${f.a}`).join(' ')
    expect(text).not.toMatch(/still obtainable|no longer obtainable|odds/i)
    expect(text).toMatch(/SafeDrop/)
  })
})
