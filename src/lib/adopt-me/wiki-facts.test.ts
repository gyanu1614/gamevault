import { describe, expect, it } from 'vitest'
import { buildAdoptMeFacts, parseOdds, parsePrice, parseReleased, statusOf } from './wiki-facts'

// Trimmed from the live wiki pages (adoptme.fandom.com, CC BY-SA), 2026-10-19.
const BROWN_BEAR = `{{Pets
|image = Brown Bear.png
|rarity = Rare
|price = {{Bucks|750}} ([[Jungle Egg]])
}}
The '''Brown Bear''' is a limited rare [[Pets|pet]] in ''Adopt Me!'' that was released on August 31, 2019, along with the [[Jungle Egg]]. As it is now unavailable, it can only be obtained by hatching any remaining [[Jungle Egg]]s or through [[Trade System|trading]].

Players have a 37% chance of hatching a rare [[Pets|pet]] from the [[Jungle Egg]], but only an 18.5% chance of hatching a Brown Bear.`

const FROST = `{{Pets
|rarity = Legendary
|price = {{Robux|1,000}} (Off-sale)
}}
The '''Frost Dragon''' is a limited legendary [[Pets|pet]] in ''Adopt Me!'' that was released on December 20, 2019.`

const build = (text: string, categories: string[], name = 'Brown Bear', db: string | null = 'obtainable') =>
  buildAdoptMeFacts({ slug: 'x', name, pageUrl: 'https://adoptme.fandom.com/wiki/X', text, categories, dbObtainability: db, checkedAt: '2026-10-19' })

describe('infobox + lead', () => {
  it('price: amount, currency, the egg or box in brackets, off-sale', () => {
    expect(parsePrice('{{Bucks|750}} ([[Jungle Egg]])')).toEqual({ amount: '750', currency: 'Bucks', source: 'Jungle Egg', offSale: false })
    expect(parsePrice('{{Robux|1,000}} (Off-sale)')).toEqual({ amount: '1,000', currency: 'Robux', source: null, offSale: true })
    expect(parsePrice('{{Cranky Coins|1,000}}')).toMatchObject({ currency: 'Cranky Coins', source: null })
    expect(parsePrice('Free ([[Campfire Cookbook]])')).toEqual({ amount: null, currency: null, source: 'Campfire Cookbook', offSale: false })
    expect(parsePrice('')).toBeNull()
  })
  it('release date from the lead; only THIS pet’s odds, not the rarity-wide one', () => {
    expect(parseReleased(BROWN_BEAR)).toBe('2019-08-31')
    expect(parseOdds(BROWN_BEAR, 'Brown Bear')).toBe('18.5%')
    expect(parseOdds('There is an 87.5% chance of obtaining this [[Pets|pet]] from a [[Wolf Box]]', 'Ghost Wolf')).toBe('87.5%')
    expect(parseOdds('a 37% chance of hatching a rare pet', 'Brown Bear')).toBeNull()
  })
  it('unavailable by category, off-sale or the lead; else the catalogue; never guesses obtainable', () => {
    expect(statusOf({ categories: ['Category:Unavailable Pets'], price: null, text: '', dbObtainability: 'obtainable' })).toBe('unobtainable')
    expect(statusOf({ categories: [], price: parsePrice('{{Robux|1,000}} (Off-sale)'), text: '', dbObtainability: 'obtainable' })).toBe('unobtainable')
    expect(statusOf({ categories: [], price: null, text: 'It is now only obtainable through trading.', dbObtainability: 'obtainable' })).toBe('unobtainable')
    expect(statusOf({ categories: [], price: null, text: '', dbObtainability: 'obtainable' })).toBe('obtainable')
    expect(statusOf({ categories: [], price: null, text: '', dbObtainability: 'limited' })).toBe('unknown')
  })
})

describe('buildAdoptMeFacts', () => {
  it('a retired egg pet: past tense, per-hatch cost and odds, egg origin', () => {
    const f = build(BROWN_BEAR, ['Category:Unavailable Pets', 'Category:Jungle Egg Pets'])
    expect([f.released_at, f.origin_type, f.origin_detail]).toEqual(['2019-08-31', 'egg', 'Jungle Egg'])
    expect(f.how_to_get).toMatchObject({
      status: 'unobtainable',
      method: 'Hatched from the Jungle Egg, which is no longer sold.',
      costs: '750 Bucks per hatch',
      odds: '18.5% per hatch',
      released: '31 August 2019',
    })
  })
  it('an obtainable egg pet is written so the shared copy can do the hatch maths', () => {
    const f = build(BROWN_BEAR.replace('As it is now unavailable, it can only be obtained by hatching any remaining [[Jungle Egg]]s or through [[Trade System|trading]].', ''), [])
    expect(f.how_to_get).toMatchObject({ status: 'obtainable', method: 'Hatched from the Jungle Egg in the Nursery.', costs: '750 Bucks per hatch', odds: '18.5% per hatch' })
  })
  it('an off-sale Robux pet: the dated event is its origin and its context', () => {
    const f = build(FROST, ['Category:Christmas Event (2019)', 'Category:Limited'], 'Frost Dragon')
    expect([f.origin_type, f.origin_detail]).toEqual(['event', 'Christmas Event (2019)'])
    expect(f.how_to_get?.method).toBe('Was sold for 1,000 Robux during the Christmas Event (2019).')
    expect(f.how_to_get?.costs).toBe('1,000 Robux')
  })
  it('no price in the infobox: no How To Get, but the release date still counts', () => {
    const f = build("The '''X''' is a pet that was released on May 1, 2026.", [], 'X')
    expect(f.how_to_get).toBeNull()
    expect(f.released_at).toBe('2026-05-01')
  })
})
