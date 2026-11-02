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

/**
 * 2026-11-02: Eldorado sells "Soda Knife (Summer 2025)" as knife "Soda 2025"
 * (and Coconut, Striped, Leaves the same way): the season word goes, the year
 * stays. A season-dated name also answers to "<name> (<year>)", at the year
 * rule's trust, and never when two rows would claim it.
 */
describe('season-dated names', () => {
  const rows = [
    e('soda-knife-summer-2025', 'Soda Knife (Summer 2025)', 'knife', { releaseYear: 2025 }),
    e('soda-gun-summer-2025', 'Soda Gun (Summer 2025)', 'gun', { releaseYear: 2025 }),
    e('stickers-knife-christmas-2025', 'Stickers Knife (Christmas 2025)', 'knife', { releaseYear: 2025 }),
    e('stickers-knife-summer-2025', 'Stickers Knife (Summer 2025)', 'knife', { releaseYear: 2025 }),
    e('soda', 'Soda', 'gun'),
  ]
  const idx = buildMarketIndex(rows)
  const r = (type: string, name: string) => resolveMarketKey(marketKey(type, 'default', name), idx)

  it('drops the season, keeps the year', () => {
    expect(r('knife', 'Soda 2025')).toMatchObject({ slug: 'soda-knife-summer-2025', via: 'year' })
    expect(r('gun', 'Soda 2025')).toMatchObject({ slug: 'soda-gun-summer-2025', via: 'year' })
  })

  it('still answers to the full season name', () => {
    expect(r('knife', 'Stickers (Christmas 2025)').slug).toBe('stickers-knife-christmas-2025')
  })

  it('never guesses between two seasons of the same year', () => {
    expect(r('knife', 'Stickers 2025').slug).toBeNull()
    expect(idx.ambiguousKeys.has(marketKey('knife', 'default', 'Stickers (2025)'))).toBe(true)
  })

  it('a plain title keeps its own exact match', () => {
    expect(r('gun', 'Soda')).toMatchObject({ slug: 'soda', via: 'title' })
  })
})

/**
 * 2026-11-02: the first Halloween 2021 Stickers pair is titled "Stickers
 * (Knife)" / "Stickers (Gun)" on the wiki, while Eldorado (which sells a
 * dozen Stickers) names each by its event: "Stickers (Halloween 2021)". A row
 * whose first source is a dated event or box answers to that name too.
 */
describe('event-dated names from the origin', () => {
  const rows = [
    e('stickers-knife', 'Stickers (Knife)', 'knife', { releaseYear: 2021, origin: '2021 Halloween Box' }),
    e('stickers-gun', 'Stickers (Gun)', 'gun', { releaseYear: 2021, origin: 'Halloween Event 2021' }),
    e('stickers-knife-halloween-2022', 'Stickers Knife (Halloween 2022)', 'knife', { releaseYear: 2022, origin: '2022 Halloween Box' }),
    e('hearts-2016', 'Hearts (2016)', 'knife', { releaseYear: 2016, origin: 'Valentines Event 2016' }),
    e('cowboy-knife', 'Cowboy (Knife)', 'knife', { origin: 'Shop' }),
    e('twin-a', 'Twin (Knife)', 'knife', { releaseYear: 2024, origin: 'Christmas Event 2024' }),
    e('twin-b', 'Twin Knife (Rare)', 'knife', { displayTitle: 'Twin', releaseYear: 2024, origin: '2024 Christmas Box' }),
  ]
  const idx = buildMarketIndex(rows)
  const r = (type: string, name: string) => resolveMarketKey(marketKey(type, 'default', name), idx)

  it('an item from a dated event or box sells under "<name> (<season> <year>)"', () => {
    expect(r('knife', 'Stickers (Halloween 2021)')).toMatchObject({ slug: 'stickers-knife', via: 'year' })
    expect(r('gun', 'Stickers (Halloween 2021)')).toMatchObject({ slug: 'stickers-gun', via: 'year' })
  })

  it('never for an undated or season-less origin, and never over a real title', () => {
    expect(r('knife', 'Cowboy (Shop)').slug).toBeNull()
    expect(r('knife', 'Stickers (Halloween 2022)').slug).toBe('stickers-knife-halloween-2022')
    expect(r('knife', 'Hearts (2016)')).toMatchObject({ slug: 'hearts-2016', via: 'title' })
  })

  it('two rows from the same event claiming one name is ambiguous', () => {
    expect(r('knife', 'Twin (Christmas 2024)').slug).toBeNull()
  })
})

describe('suggestForReview', () => {
  it('suggests same-type rows sharing the first word, for the review CSV only', () => {
    expect(suggestForReview('gun|default|rainbow', CATALOGUE)).toEqual(['rainbow-gun', 'rainbow-gun-godly'])
    expect(suggestForReview('knife|chroma|fang 2020', CATALOGUE)).toEqual(['chroma-fang'])
  })
})
