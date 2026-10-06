import { describe, expect, it } from 'vitest'
import {
  chromaMultiple,
  chromaStats,
  fmtMultiple,
  matchesChromaFilter,
  multipleBarPct,
  multipleExtremes,
  resolveChromaSource,
  shopChromaSources,
  sortChromas,
  unboxMaths,
  type ChromaEntry,
  type ChromaSource,
} from './chromas'
import { sharedWeaponBoxOdds, shopBoxes } from './shop-boxes'
import { valueListHub } from './hub-config'

const SRC: Record<string, ChromaSource> = {
  box: { kind: 'box', label: 'Knife Box 4', eventSlug: null, oddsPct: 0.004, oddsUnconfirmed: false },
  egg: { kind: 'egg', label: 'Common Egg', eventSlug: null, oddsPct: 0.004 / 7, oddsUnconfirmed: false },
  event: { kind: 'event', label: '2023 Halloween Box', eventSlug: 'halloween-2023', oddsPct: null, oddsUnconfirmed: false },
  craft: { kind: 'craft', label: 'Crafting Station', eventSlug: null, oddsPct: null, oddsUnconfirmed: false },
}

function entry(slug: string, price: number | null, base: number | null, src: keyof typeof SRC, itemType = 'knife'): ChromaEntry {
  return {
    slug,
    name: slug,
    itemType,
    imageUrl: null,
    cheapestUsd: price,
    marketUsd: null,
    href: price != null ? `/mm2/values/${slug}` : null,
    base: base === undefined ? null : { slug: `${slug}-base`, name: `${slug} base`, cheapestUsd: base, href: null },
    source: SRC[src],
  }
}

const ENTRIES = [
  entry('travelers', 4045.99, 129.93, 'event', 'gun'),
  entry('slasher', 1.08, 0.56, 'box'),
  entry('luger', 1.95, 0.68, 'box', 'gun'),
  entry('elderwood', 1.33, 1.09, 'event'),
  entry('seer', 0.98, 0.28, 'craft'),
  entry('fire-bunny', 0.28, null, 'egg', 'pet'),
  entry('ornament', null, null, 'event', 'gun'),
]

describe('chroma multiples', () => {
  it('is the Chroma price over its normal version price, and null without both', () => {
    expect(chromaMultiple(ENTRIES[0])).toBeCloseTo(31.14, 2)
    expect(chromaMultiple(ENTRIES[5])).toBeNull()
    expect(chromaMultiple(ENTRIES[6])).toBeNull()
    expect(chromaMultiple({ cheapestUsd: 1, base: null })).toBeNull()
    expect(chromaMultiple({ cheapestUsd: 1, base: { slug: 'x', name: 'x', cheapestUsd: 0, href: null } })).toBeNull()
    expect(fmtMultiple(31.139)).toBe('×31.1')
  })

  it('draws the bar on a log scale, never empty, never past full', () => {
    expect(multipleBarPct(39.9, 39.9)).toBe(100)
    expect(multipleBarPct(1.22, 39.9)).toBeGreaterThanOrEqual(4)
    expect(multipleBarPct(6.3, 39.9)).toBeCloseTo(50, 0)
    expect(multipleBarPct(0.5, 39.9)).toBe(4)
  })

  it('splits the biggest and smallest without overlap', () => {
    const { biggest, smallest } = multipleExtremes(ENTRIES, 5)
    expect(biggest.map((p) => p.entry.slug)).toEqual(['travelers', 'seer'])
    expect(smallest.map((p) => p.entry.slug)).toEqual(['elderwood', 'slasher'])
  })
})

describe('chromaStats', () => {
  const s = chromaStats(ENTRIES)
  it('counts, prices and pairs from the data', () => {
    expect(s.count).toBe(7)
    expect(s.priced).toBe(6)
    expect(s.byType).toEqual({ knife: 3, gun: 3, pet: 1, other: 0 })
    expect(s.mostExpensive?.slug).toBe('travelers')
    expect(s.pairs).toBe(5)
    expect(s.pairsAbove).toBe(5)
    expect(s.fromBoxes).toBe(3)
    expect(s.fromEvents).toBe(3)
  })

  it('averages the multiples, overall and by source group', () => {
    const ms = [4045.99 / 129.93, 1.08 / 0.56, 1.95 / 0.68, 1.33 / 1.09, 0.98 / 0.28]
    expect(s.averageMultiple).toBeCloseTo(ms.reduce((a, b) => a + b) / 5, 9)
    expect(s.medianMultiple).toBeCloseTo(1.95 / 0.68, 9)
    expect(s.groups.box).toEqual({ pairs: 2, average: (1.08 / 0.56 + 1.95 / 0.68) / 2 })
    expect(s.groups.event.pairs).toBe(2)
    expect(s.groups.other.pairs).toBe(1)
    expect(s.biggest?.entry.slug).toBe('travelers')
    expect(s.smallest?.entry.slug).toBe('elderwood')
  })

  it('is empty-safe', () => {
    const e = chromaStats([])
    expect(e.averageMultiple).toBeNull()
    expect(e.medianMultiple).toBeNull()
    expect(e.mostExpensive).toBeNull()
  })
})

describe('unbox maths (MM2 seed + hub config)', () => {
  const odds = sharedWeaponBoxOdds('murder-mystery-2')!
  const egg = shopBoxes('murder-mystery-2').find((b) => b.kind === 'egg')!
  const u = unboxMaths(odds.chroma, odds.godly, valueListHub('murder-mystery-2')!.earnRate!.perRound, egg.chromas.length)

  it('0.004% a spin = 25,000 spins = 25,000,000 Coins = 625,000 rounds at 40 Coins', () => {
    expect(odds.chroma).toBe(0.004)
    expect(u.spins).toBe(25_000)
    expect(u.coins).toBe(25_000_000)
    expect(u.coinsPerRound).toBe(40)
    expect(u.rounds).toBe(625_000)
    expect(u.rarerThanGodly).toBeCloseTo(50, 9)
  })

  it('a 50% chance takes 17,329 spins', () => {
    expect(u.half).toBe(17_329)
  })

  it('splits the Common Egg line across its 7 Fire pets', () => {
    expect(u.eggPets).toBe(7)
    expect(u.eggPetPct).toBeCloseTo(0.000571, 6)
    expect(u.eggPetHatches).toBeCloseTo(175_000, 6)
  })
})

describe('sources', () => {
  const shop = shopChromaSources(shopBoxes('murder-mystery-2'))

  it('gives a one-Chroma Shop box its 0.004%, splits the egg, and never quotes Mystery Box 2', () => {
    expect(shop.get('chroma-luger')).toEqual({ kind: 'box', boxName: 'Gun Box 1', oddsPct: 0.004, oddsUnconfirmed: false })
    expect(shop.get('chroma-fire-cat')?.oddsPct).toBeCloseTo(0.004 / 7, 12)
    expect(shop.get('chroma-lightbringer')).toEqual({ kind: 'box', boxName: 'Mystery Box 2', oddsPct: null, oddsUnconfirmed: true })
    // Retired event boxes are not Shop boxes.
    expect(shop.has('chroma-travelers-gun')).toBe(false)
  })

  it('resolves Shop box → event → crafting → origin', () => {
    const events = new Map([
      ['chroma-travelers-gun', { slug: 'halloween-2023', name: 'Halloween 2023' }],
      ['chroma-ornament', { slug: 'christmas-2025', name: 'Christmas 2025' }],
      ['chroma-luger', { slug: 'nope', name: 'Nope' }],
    ])
    expect(resolveChromaSource('chroma-luger', 'Gun Box 1', shop, events).kind).toBe('box')
    expect(resolveChromaSource('chroma-travelers-gun', '2023 Halloween Box', shop, events)).toEqual({
      kind: 'event',
      label: '2023 Halloween Box',
      eventSlug: 'halloween-2023',
      oddsPct: null,
      oddsUnconfirmed: false,
    })
    expect(resolveChromaSource('chroma-ornament', 'Christmas Event 2025', shop, events).label).toBe('Christmas 2025 Event')
    expect(resolveChromaSource('chroma-seer', 'Crafting', shop, events).kind).toBe('craft')
    expect(resolveChromaSource('chroma-x', null, shop, events)).toMatchObject({ kind: 'other', label: null })
  })
})

describe('grid filters + sorts', () => {
  it('filters by type and by source group', () => {
    const keys = (k: Parameters<typeof matchesChromaFilter>[1]) => ENTRIES.filter((e) => matchesChromaFilter(e, k)).map((e) => e.slug)
    expect(keys('all')).toHaveLength(7)
    expect(keys('gun')).toEqual(['travelers', 'luger', 'ornament'])
    expect(keys('pet')).toEqual(['fire-bunny'])
    expect(keys('box')).toEqual(['slasher', 'luger', 'fire-bunny'])
    expect(keys('event')).toEqual(['travelers', 'elderwood', 'ornament'])
  })

  it('sorts by price or multiple, unpriced and unpaired last', () => {
    expect(sortChromas(ENTRIES, 'price').map((e) => e.slug)).toEqual(['travelers', 'luger', 'elderwood', 'slasher', 'seer', 'fire-bunny', 'ornament'])
    expect(sortChromas(ENTRIES, 'multiple').map((e) => e.slug)).toEqual(['travelers', 'seer', 'luger', 'slasher', 'elderwood', 'fire-bunny', 'ornament'])
  })
})
