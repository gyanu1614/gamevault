/**
 * Market name → catalogue row. Every case below is a real MM2 naming pattern
 * from the 2026-10-04 crawl vs the wiki titles.
 */
import { describe, it, expect } from 'vitest'

import { buildMarketIndex, marketNamesFor, resolveMarketKey, suggestForReview, type CatalogueEntry } from './resolve'
import { marketKey } from '../normalisers/eldorado-structured'

const e = (slug: string, title: string, itemType: string, extra: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  slug,
  title,
  itemType,
  isChroma: /^chroma /i.test(title),
  ...extra,
})

const CATALOGUE: CatalogueEntry[] = [
  e('fang', 'Fang', 'knife'),
  e('chroma-fang', 'Chroma Fang', 'knife'),
  e('adurite-knife', 'Adurite (Knife)', 'knife'),
  e('adurite-gun', 'Adurite (Gun)', 'gun'),
  e('bats-knife-2018', 'Bats Knife (2018)', 'knife', { releaseYear: 2018 }),
  e('bats-gun-2018', 'Bats Gun (2018)', 'gun', { releaseYear: 2018 }),
  e('harvester', 'Harvester', 'gun', { releaseYear: 2021 }),
  e('travelers-gun', "Traveler's Gun", 'gun', { releaseYear: 2023 }),
  e('chroma-travelers-gun', "Chroma Traveler's Gun", 'gun', { releaseYear: 2023 }),
  e('laser-godly', 'Laser (Godly)', 'gun'),
  e('laser-vintage', 'Laser (Vintage)', 'gun'),
  e('waves', 'Waves', 'knife', { releaseYear: 2023 }),
  e('waves-knife-rare', 'Waves Knife (Rare)', 'knife', { displayTitle: 'Waves', releaseYear: 2024 }),
  e('bat-pet', 'Bat (Pet)', 'pet', { displayTitle: 'Bat' }),
  e('rainbow-gun', 'Rainbow (Gun)', 'gun'),
  e('rainbow-gun-godly', 'Rainbow Gun (Godly)', 'gun', { displayTitle: 'Rainbow', releaseYear: 2023 }),
]

const index = buildMarketIndex(CATALOGUE)
const resolve = (type: string, variant: string, name: string, rarity?: string) =>
  resolveMarketKey(marketKey(type, variant, name), index, { rarity })

describe('marketNamesFor', () => {
  it('derives the names a qualified wiki title sells under', () => {
    expect(marketNamesFor('Adurite (Knife)', 'knife').derived).toEqual(['Adurite'])
    expect(marketNamesFor('Bats Knife (2018)', 'knife').derived).toEqual(['Bats (2018)'])
    expect(marketNamesFor('Stickers Gun (Halloween 2021)', 'gun').derived).toEqual(['Stickers (Halloween 2021)'])
    // A type word that does not match the row's type derives nothing.
    expect(marketNamesFor('Bats Knife (2018)', 'gun').derived).toEqual([])
  })
})

describe('resolveMarketKey', () => {
  it('exact title, confidence 1', () => {
    expect(resolve('knife', 'default', 'Fang')).toMatchObject({ slug: 'fang', confidence: 1, via: 'title' })
  })

  it('chroma = the BASE name under the chroma variant', () => {
    expect(resolve('knife', 'chroma', 'Fang').slug).toBe('chroma-fang')
    expect(resolve('gun', 'chroma', "Traveler's Gun (2023)").slug).toBe('chroma-travelers-gun')
  })

  it('type qualifiers: "Adurite" knife vs gun, "Bats (2018)" knife vs gun', () => {
    expect(resolve('knife', 'default', 'Adurite')).toMatchObject({ slug: 'adurite-knife', via: 'derived' })
    expect(resolve('gun', 'default', 'Adurite').slug).toBe('adurite-gun')
    expect(resolve('knife', 'default', 'Bats (2018)').slug).toBe('bats-knife-2018')
    expect(resolve('gun', 'default', 'Bats (2018)').slug).toBe('bats-gun-2018')
  })

  it('"Harvester (2021)" resolves through the release year — and only that year', () => {
    expect(resolve('gun', 'default', 'Harvester (2021)')).toMatchObject({ slug: 'harvester', via: 'year', confidence: 0.8 })
    expect(resolve('gun', 'default', 'Harvester (2019)').slug).toBeNull()
  })

  it('rarity-qualified pages win when the listing states that rarity', () => {
    expect(resolve('gun', 'default', 'Laser', 'Godly').slug).toBe('laser-godly')
    expect(resolve('gun', 'default', 'Laser', 'Vintage').slug).toBe('laser-vintage')
    expect(resolve('knife', 'default', 'Waves', 'Rare').slug).toBe('waves-knife-rare')
    expect(resolve('knife', 'default', 'Waves', 'Common').slug).toBe('waves')
  })

  it('an infobox display title never out-ranks another page\'s real title', () => {
    // "Waves Knife (Rare)" displays as "Waves"; the page titled "Waves" keeps the name.
    expect(resolve('knife', 'default', 'Waves').slug).toBe('waves')
    // …but a display title with no rival still resolves ("Bat (Pet)" → "Bat").
    expect(resolve('pet', 'default', 'Bat').slug).toBe('bat-pet')
  })

  it('two rows claiming the same derived name is ambiguous, never a guess', () => {
    // "Rainbow (Gun)" and "Rainbow Gun (Godly)" (display "Rainbow") both derive "Rainbow".
    const r = resolve('gun', 'default', 'Rainbow')
    expect(r.slug).toBeNull()
    expect(r.note).toMatch(/ambiguous/)
  })

  it('a reviewed alias settles an ambiguous name but never overrides an exact title', () => {
    const withAliases = buildMarketIndex(CATALOGUE, [
      { key: 'gun|default|rainbow', slug: 'rainbow-gun' },
      { key: 'knife|default|fang', slug: 'chroma-fang' },
      { key: 'gun|default|nope', slug: 'not-in-catalogue' },
    ])
    expect(resolveMarketKey('gun|default|rainbow', withAliases)).toMatchObject({ slug: 'rainbow-gun', via: 'alias' })
    expect(resolveMarketKey('knife|default|fang', withAliases).slug).toBe('fang')
    expect(resolveMarketKey('gun|default|nope', withAliases).slug).toBeNull()
  })

  it('an unknown name resolves to nothing (no fuzzy matching)', () => {
    expect(resolve('knife', 'default', 'Fangs').slug).toBeNull()
    expect(resolveMarketKey(null, index).note).toBe('no market key')
  })
})

describe('suggestForReview', () => {
  it('suggests same-type rows sharing the first word, for the review CSV only', () => {
    expect(suggestForReview('gun|default|rainbow', CATALOGUE)).toEqual(['rainbow-gun', 'rainbow-gun-godly'])
    expect(suggestForReview('knife|chroma|fang 2020', CATALOGUE)).toEqual(['chroma-fang'])
  })
})
