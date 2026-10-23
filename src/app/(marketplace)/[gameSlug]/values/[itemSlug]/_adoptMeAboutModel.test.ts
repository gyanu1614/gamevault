import { describe, expect, it } from 'vitest'
import { aboutAnswer, aboutBasis, aboutFacts, formRows, livePriceSpread, withoutStalePrices, petStory } from './_adoptMeAboutModel'

const v = (variant: string, cheapestUsd: number | null, tradeValue: number | null, listingsTracked = 0) =>
  ({ variant, label: variant, cheapestUsd, cashUsd: cheapestUsd, averageUsd: cheapestUsd, tradeValue, isEstimated: false, confidence: 'high', listingsTracked, lastPricedAt: null }) as any

const variants = [v('MFR', 2100, 9000, 3), v('FR', 289.99, 1450, 24), v('N', 120, 600, 8), v('NFR', 650, 3105, 15), v('MEGA', null, 7000)]

describe('formRows', () => {
  it('every form in ladder order, with our own stock per form', () => {
    const rows = formRows(variants, { total: 5, minPriceUsd: 290, byVariant: { 'neon-fly-ride': { count: 2, minPriceUsd: 590 } } }, (c) => (c === 'NFR' ? 'neon-fly-ride' : c.toLowerCase()), 'NFR')
    expect(rows.map((r) => r.code)).toEqual(['N', 'FR', 'NFR', 'MEGA', 'MFR'])
    const nfr = rows.find((r) => r.code === 'NFR')!
    expect(nfr).toMatchObject({ label: 'Neon Fly Ride', cheapestUsd: 650, tradeValue: 3105, listings: 15, ourFromUsd: 590, ourCount: 2, selected: true })
    expect(rows.find((r) => r.code === 'FR')).toMatchObject({ ourFromUsd: null, selected: false })
  })
})

describe('aboutAnswer', () => {
  it('one plain sentence for the picked form: price first, then trade value', () => {
    expect(aboutAnswer('Bat Dragon', v('NFR', 650, 3105, 15))).toBe('A Neon Fly Ride Bat Dragon sells for $650, with a trade value of 3,105.')
    expect(aboutAnswer('Bat Dragon', v('FR', 282, null, 2))).toBe('A Fly Ride Bat Dragon sells for $282.')
  })
  it('no price → the trade value alone; nothing → null', () => {
    expect(aboutAnswer('Owl', v('MEGA', null, 7000))).toBe('A Mega Owl has a trade value of 7,000.')
    expect(aboutAnswer('Owl', v('MEGA', null, null))).toBeNull()
  })
  it('three tiers, Normal / Neon / Mega: MFR reads "Mega Fly Ride"', () => {
    expect(aboutAnswer('Owl', v('MFR', 2100, 9000, 3))).toBe('A Mega Fly Ride Owl sells for $2,100, with a trade value of 9,000.')
  })
})

describe('aboutBasis', () => {
  it('where the price comes from, as a short line', () => {
    expect(aboutBasis(v('NFR', 650, 3105, 15))).toBe('Cheapest of 15 listings from sellers with 100+ reviews.')
    expect(aboutBasis(v('NFR', 650, 3105, 1))).toBe('Cheapest of 1 listing from sellers with 100+ reviews.')
    expect(aboutBasis(v('MEGA', null, 7000))).toBe('No cash listings tracked yet.')
    expect(aboutBasis(v('MEGA', null, null))).toBeNull()
  })
})

describe('aboutFacts', () => {
  it('rarity, origin, availability, price range across forms, forms priced', () => {
    const facts = aboutFacts({ rarity: 'Legendary', originDetail: '2019 Halloween Event', originType: 'event', obtainabilityLabel: 'Unobtainable' }, variants)
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ['Rarity', 'Legendary'],
      ['Origin', '2019 Halloween Event'],
      ['Availability', 'Unobtainable'],
      ['Price Range', '$120 – $2,100'],
      ['Forms Priced', '4 of 5'],
    ])
  })
  it('the shared Released fact sits after rarity, before origin', () => {
    const facts = aboutFacts({ rarity: 'Legendary', originDetail: 'Halloween Event (2022)', originType: 'event', obtainabilityLabel: 'Unobtainable', released: '27 October 2022' }, variants)
    expect(facts.slice(0, 3).map((f) => f.label)).toEqual(['Rarity', 'Released', 'Origin'])
  })
})

describe('withoutStalePrices', () => {
  const stored =
    'The Vampire Dragon is a legendary pet in Adopt Me, released on 5 October 2023 as part of the 2023 Halloween Event. It is no longer available through normal play, so trading with other players is now the main way to get one. In October 2026 the cheapest Fly Ride Vampire Dragon from an established seller was listed at about $6.98. Across the 6 forms with enough listings to price, the cheapest listings ran from about $6.98 (Fly Ride) to $75.00 (Mega Neon Fly Ride). Prices change daily, so check the live values above before you trade or buy.'
  it('drops the sentences that quote a price or a form count; keeps the story', () => {
    expect(withoutStalePrices(stored)).toBe(
      'The Vampire Dragon is a legendary pet in Adopt Me, released on 5 October 2023 as part of the 2023 Halloween Event. It is no longer available through normal play, so trading with other players is now the main way to get one.',
    )
  })
  it('leaves prose without prices alone', () => {
    expect(withoutStalePrices('A rare pet. Hatched from the Fossil Egg in 2020.')).toBe('A rare pet. Hatched from the Fossil Egg in 2020.')
  })
})

describe('livePriceSpread', () => {
  it('one sentence from the same numbers as the table: cheapest form, dearest form, how many priced', () => {
    expect(livePriceSpread('Owl', variants)).toBe('Across the 4 of 5 forms we can price today, the cheapest listings run from $120 (Normal) to $2,100 (Mega Fly Ride).')
  })
  it('one priced form, or none', () => {
    expect(livePriceSpread('Owl', [v('FR', 6.28, 20, 19), v('N', null, 14)])).toBe('Only the Fly Ride form has enough listings to price today: $6.28.')
    expect(livePriceSpread('Owl', [v('N', null, 14)])).toBeNull()
  })
})


describe('petStory (2026-10-21: every active pet has a page, written description or not)', () => {
  it('keeps a written description, without its old baked-in prices', () => {
    expect(petStory({ description: 'The Owl is a legendary pet. It costs $6.98 on average.', name: 'Owl', rarity: 'Legendary', released: null, origin: null, howToGetMethod: null })).toBe('The Owl is a legendary pet.')
  })
  it('without one, writes its facts in plain sentences', () => {
    expect(
      petStory({ description: null, name: 'Shoebill', rarity: 'Uncommon', released: '16 October 2026', origin: 'Basic Egg', howToGetMethod: 'Hatched from the Basic Egg in the Nursery.' }),
    ).toBe('The Shoebill is an uncommon pet in Adopt Me, released 16 October 2026, from the Basic Egg. Hatched from the Basic Egg in the Nursery.')
    expect(petStory({ description: '  ', name: 'Mystery', rarity: 'Rare', released: null, origin: null, howToGetMethod: null })).toBe('The Mystery is a rare pet in Adopt Me.')
  })
})
