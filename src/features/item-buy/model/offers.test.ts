import { describe, it, expect } from 'vitest'
import { formOptions, formPicker, offerPhotoFor } from './offers'
import { defaultTrait, offersOfTrait, pickOffer, traitNoun, traitOptions, type TraitDef } from './offers'

const VARIANTS: TraitDef[] = [
  { key: 'fly-ride', label: 'Fly Ride', short: 'FR' },
  { key: 'neon-fly-ride', label: 'Neon Fly Ride', short: 'NFR' },
  { key: 'mega-fly-ride', label: 'Mega Fly Ride', short: 'MFR' },
]

const o = (id: string, price: number, recommended = 50) => ({ id, pricePerUnit: price, recommended })
const OFFERS = [o('a', 60), o('b', 54.99), o('c', 120), o('d', 54.99, 90), o('e', 300)]
const VARIANT_OF: Record<string, string | null> = { a: 'fly-ride', b: 'fly-ride', c: 'neon-fly-ride', d: 'fly-ride', e: 'neon-fly-ride' }

describe('traitOptions', () => {
  it('every trait in catalogue order with its count and cheapest price', () => {
    expect(traitOptions(VARIANTS, OFFERS, VARIANT_OF)).toEqual([
      { variant: 'fly-ride', label: 'Fly Ride', short: 'FR', count: 3, minPriceUsd: 54.99 },
      { variant: 'neon-fly-ride', label: 'Neon Fly Ride', short: 'NFR', count: 2, minPriceUsd: 120 },
      { variant: 'mega-fly-ride', label: 'Mega Fly Ride', short: 'MFR', count: 0, minPriceUsd: null },
    ])
  })

  it('a pet nobody sells still lists every trait, all empty', () => {
    const opts = traitOptions(VARIANTS, [], {})
    expect(opts).toHaveLength(3)
    expect(opts.every((t) => t.count === 0 && t.minPriceUsd === null)).toBe(true)
  })

  it('a game without traits has no options (no picker)', () => {
    expect(traitOptions([], OFFERS, VARIANT_OF)).toEqual([])
  })
})

describe('offersOfTrait', () => {
  it('cheapest first; a price tie goes to the better-ranked offer', () => {
    expect(offersOfTrait(OFFERS, VARIANT_OF, 'fly-ride').map((x) => x.id)).toEqual(['d', 'b', 'a'])
  })

  it('no trait = every offer', () => {
    expect(offersOfTrait(OFFERS, VARIANT_OF, null).map((x) => x.id)).toEqual(['d', 'b', 'a', 'c', 'e'])
  })

  it('a trait with no offers is empty', () => {
    expect(offersOfTrait(OFFERS, VARIANT_OF, 'mega-fly-ride')).toEqual([])
  })
})

describe('pickOffer', () => {
  it('the cheapest offer of the trait', () => {
    expect(pickOffer(OFFERS, VARIANT_OF, 'neon-fly-ride', null)?.id).toBe('c')
  })

  it('keeps an offer the buyer chose from the list while it is in the trait', () => {
    expect(pickOffer(OFFERS, VARIANT_OF, 'fly-ride', 'a')?.id).toBe('a')
    expect(pickOffer(OFFERS, VARIANT_OF, null, 'e')?.id).toBe('e')
  })

  it('drops a chosen offer of another trait and falls back to the cheapest', () => {
    expect(pickOffer(OFFERS, VARIANT_OF, 'fly-ride', 'c')?.id).toBe('d')
  })

  it('nothing to buy in an empty trait', () => {
    expect(pickOffer(OFFERS, VARIANT_OF, 'mega-fly-ride', null)).toBeNull()
  })
})

describe('defaultTrait', () => {
  it('the trait in the URL (values Buy → NFR Parrot) when the game has it', () => {
    expect(defaultTrait(VARIANTS, 'neon-fly-ride', OFFERS, VARIANT_OF)).toBe('neon-fly-ride')
  })

  it('else the cheapest offer’s trait (from the grid: the cheapest Parrot is FR)', () => {
    expect(defaultTrait(VARIANTS, null, OFFERS, VARIANT_OF)).toBe('fly-ride')
    expect(defaultTrait(VARIANTS, 'golden', OFFERS, VARIANT_OF)).toBe('fly-ride')
  })

  it('no offers, or the cheapest offer has no known trait: none picked', () => {
    expect(defaultTrait(VARIANTS, null, [], {})).toBeNull()
    expect(defaultTrait(VARIANTS, null, [o('x', 5)], { x: null })).toBeNull()
  })

  it('a game without traits never picks one', () => {
    expect(defaultTrait([], 'fly-ride', OFFERS, VARIANT_OF)).toBeNull()
  })
})

describe('traitNoun', () => {
  it('Trait for Adopt Me, Mutation for Steal a Brainrot', () => {
    expect(traitNoun('adopt-me')).toBe('Trait')
    expect(traitNoun('steal-a-brainrot')).toBe('Mutation')
  })
})

describe('offerPhotoFor', () => {
  it('a mutation shows the offer’s own photo', () => {
    expect(offerPhotoFor('Mutation', 'candy', 'https://x/candy.webp')).toBe('https://x/candy.webp')
  })
  it('a mutation with no photo keeps the catalogue picture', () => {
    expect(offerPhotoFor('Mutation', 'candy', null)).toBeNull()
    expect(offerPhotoFor('Mutation', 'candy', '')).toBeNull()
  })
  it('the plain item keeps the catalogue picture', () => {
    expect(offerPhotoFor('Mutation', 'default', 'https://x/a.webp')).toBeNull()
    expect(offerPhotoFor('Mutation', null, 'https://x/a.webp')).toBeNull()
  })
  it('an Adopt Me trait never swaps the picture', () => {
    expect(offerPhotoFor('Trait', 'neon', 'https://x/a.webp')).toBeNull()
  })
})

describe('formOptions', () => {
  it('fits the picker: the slug is the value, a version with no offers has no price', () => {
    expect(formOptions([
      { slug: 'sunrise', label: 'Common', count: 2, minPriceUsd: 16.99 },
      { slug: 'chroma-sunrise', label: 'Chroma', count: 0, minPriceUsd: null },
    ])).toEqual([
      { variant: 'sunrise', label: 'Common', short: null, count: 2, minPriceUsd: 16.99 },
      { variant: 'chroma-sunrise', label: 'Chroma', short: null, count: 0, minPriceUsd: null },
    ])
  })
})

describe('formPicker', () => {
  const forms = [
    { slug: 'travelers-gun', label: 'Common', href: '/mm2/buy-items/item/travelers-gun', count: 1, minPriceUsd: 6 },
    { slug: 'chroma-travelers-gun', label: 'Chroma', href: '/mm2/buy-items/item/chroma-travelers-gun', count: 2, minPriceUsd: 30 },
  ]

  it('choosing Chroma on the plain page opens the Chroma page', () => {
    const went: string[] = []
    const picker = formPicker(forms, 'travelers-gun', (h) => went.push(h))
    expect(picker).toMatchObject({ noun: 'Type', value: 'travelers-gun' })
    picker.onChange('chroma-travelers-gun')
    expect(went).toEqual(['/mm2/buy-items/item/chroma-travelers-gun'])
  })

  it('choosing Common on the Chroma page goes back', () => {
    const went: string[] = []
    formPicker(forms, 'chroma-travelers-gun', (h) => went.push(h)).onChange('travelers-gun')
    expect(went).toEqual(['/mm2/buy-items/item/travelers-gun'])
  })

  it('choosing the page you are on goes nowhere', () => {
    const went: string[] = []
    formPicker(forms, 'travelers-gun', (h) => went.push(h)).onChange('travelers-gun')
    expect(went).toEqual([])
  })
})
