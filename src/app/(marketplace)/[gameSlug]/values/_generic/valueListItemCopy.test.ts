import { describe, expect, it } from 'vitest'
import { aboutSentence, chromaSentence, itemFaq, priceSentence, valueItemMetaTail, valueItemMetaTitle, type ItemCopyInput } from './valueListItemCopy'

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
    expect(priceSentence({ ...harvester, now: Date.parse('2026-10-07T00:00:00Z') })).toBe(
      'As of October 5, 2026, Harvester is worth about $7.55 in MM2 — its verified market price — and starts at $7.20 from professional sellers.',
    )
    // Two weeks on: today's price, and the old date says the price held.
    expect(priceSentence({ ...harvester, now: Date.parse('2026-10-19T00:00:00Z') })).toBe(
      'Harvester is worth about $7.55 in MM2 — its verified market price — and starts at $7.20 from professional sellers. Its price has been steady since October 5, 2026.',
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

// Bing 2026-10-19: MM2 item pages had the most impressions (16.3K) and a 0.3%
// click rate with "… — Price in USD"; Adopt Me items ("<Pet> Value in Adopt Me
// (Month Year)") got 2.6% at the same position. Same pattern, plus the tier
// MM2 players search by, when it fits with the brand.
describe('value item search title and snippet', () => {
  it('"<Item> Value in MM2 (Month Year)", plus "– Godly Knife" only when it fits', () => {
    expect(valueItemMetaTitle({ name: 'Icewing', shortName: 'MM2', rarity: 'Godly', typeLabel: 'Knife' }, 'October 2026')).toBe(
      'Icewing Value in MM2 (October 2026) – Godly Knife',
    )
    expect(valueItemMetaTitle({ name: 'Chroma Elderwood Revolver', shortName: 'MM2', rarity: 'Chroma', typeLabel: 'Gun' }, 'October 2026')).toBe(
      'Chroma Elderwood Revolver Value in MM2 (October 2026)',
    )
  })
  it('the snippet tail says what the item is and what the page has', () => {
    expect(valueItemMetaTail({ rarity: 'Ancient', typeNoun: 'gun', obtain: harvester.obtain, origin: 'Halloween Event 2021' })).toBe(
      "It's an Ancient gun, released as a battle-pass reward in the Halloween Event 2021. How to get it, its price history and safe offers to buy it.",
    )
    // Not enough room after the answer: the shorter one-sentence version.
    expect(valueItemMetaTail({ rarity: 'Ancient', typeNoun: 'gun', obtain: harvester.obtain, origin: 'Halloween Event 2021' }, 80)).toBe(
      'See how to get this Ancient gun, its price history and safe offers to buy it.',
    )
    expect(valueItemMetaTail({ rarity: 'Ancient', typeNoun: 'gun', obtain: harvester.obtain, origin: 'Halloween Event 2021' }, 65)).toBe(
      'Ancient gun: how to get it, price history and safe offers.',
    )
    expect(valueItemMetaTail({ rarity: 'Ancient', typeNoun: 'gun', obtain: [], origin: null })).toBe(
      'See how to get this Ancient gun, its price history and safe offers to buy it.',
    )
    expect(valueItemMetaTail({ rarity: null, typeNoun: 'item', obtain: [], origin: null })).toBe(
      "How to get it, its price history and safe offers to buy it.",
    )
  })
})
