import { describe, it, expect } from 'vitest'
import { matchListingToValueItem, type ValueCatalog } from './match'

// Shapes taken from live listings (2026-10-02).
const SAB: ValueCatalog = {
  gameSlug: 'steal-a-brainrot',
  items: [
    { slug: 'dragon-cannelloni', name: 'Dragon Cannelloni' },
    { slug: 'garama-and-madundung', name: 'Garama and Madundung' },
    { slug: '67', name: '67' },
    { slug: 'la-vacca-saturno-saturnita', name: 'La Vacca Saturno Saturnita' },
  ],
  variants: [
    { key: 'gold', names: ['Gold'] },
    { key: 'diamond', names: ['Diamond'] },
    { key: 'rainbow', names: ['Rainbow'] },
    { key: 'yin-yang', names: ['Yin Yang'] },
    { key: 'lava', names: ['Lava'] },
  ],
  identityKeys: ['select-brainrot'],
  variantKeys: ['mutation', 'select-mutation'],
  defaultVariant: 'default',
}

const AM: ValueCatalog = {
  gameSlug: 'adopt-me',
  items: [
    { slug: 'bat-dragon', name: 'Bat Dragon' },
    { slug: 'chocolate-chip-bat-dragon', name: 'Chocolate Chip Bat Dragon' },
    { slug: 'parrot', name: 'Parrot' },
    { slug: 'evil-unicorn', name: 'Evil Unicorn' },
  ],
  variants: [
    { key: 'normal', names: ['Normal', 'No Potion'] },
    { key: 'fly', names: ['Fly', 'F'] },
    { key: 'ride', names: ['Ride', 'R'] },
    { key: 'fly-ride', names: ['Fly Ride', 'FR'] },
    { key: 'neon', names: ['Neon', 'N'] },
    { key: 'neon-fly-ride', names: ['Neon Fly Ride', 'NFR'] },
    { key: 'mega-neon', names: ['Mega Neon', 'M', 'Mega'] },
    { key: 'mega-fly-ride', names: ['Mega Fly Ride', 'Mega Neon Fly Ride', 'MFR'] },
  ],
  identityKeys: ['pet-name'],
  variantKeys: ['trait'],
}

// The live Adopt Me taxonomy: option slugs do not match their labels.
const AM_LABELS = {
  trait: {
    n: 'Normal',
    f: 'Fly',
    r: 'Fly Ride (FR)',
    fr: 'Neon',
    nfr: 'Neon Fly Ride (NFR)',
    mfr: 'Mega Neon',
    'mega-fly-ride': 'Mega Fly Ride (MFR)',
  },
}

describe('matchListingToValueItem — Steal a Brainrot', () => {
  it('reads identity from select-brainrot and defaults the mutation', () => {
    expect(
      matchListingToValueItem(
        {
          title: 'Dragon Cannelloni 250M/s — Steal a Brainrot (Roblox) | Instant Delivery',
          templateData: { rarity: 'secret', 'item-type': 'brainrot', 'select-brainrot': 'dragon-cannelloni' },
        },
        SAB,
      ),
    ).toEqual({ itemSlug: 'dragon-cannelloni', variant: 'default' })
  })

  it('finds the mutation in the title', () => {
    expect(
      matchListingToValueItem(
        {
          title: 'Rainbow Garama & Madundung 500M/s - Steal a Brainrot | Instant Delivery',
          templateData: { 'select-brainrot': 'garama-and-madundung' },
        },
        SAB,
      ),
    ).toEqual({ itemSlug: 'garama-and-madundung', variant: 'rainbow' })
  })

  it('prefers a mutation template field over the title', () => {
    expect(
      matchListingToValueItem(
        { title: 'Diamond Dragon Cannelloni', templateData: { 'select-brainrot': 'dragon-cannelloni', mutation: 'gold' } },
        SAB,
      ),
    ).toEqual({ itemSlug: 'dragon-cannelloni', variant: 'gold' })
  })

  it('matches multi-word mutations', () => {
    expect(
      matchListingToValueItem({ title: 'Yin Yang Dragon Cannelloni', templateData: {} }, SAB),
    ).toEqual({ itemSlug: 'dragon-cannelloni', variant: 'yin-yang' })
  })

  it('falls back to the title when select-brainrot is not a catalogue item', () => {
    expect(
      matchListingToValueItem(
        { title: 'Diamond Dragon Cannelloni | fast', templateData: { 'select-brainrot': 'secret' } },
        SAB,
      ),
    ).toEqual({ itemSlug: 'dragon-cannelloni', variant: 'diamond' })
  })

  it('does not read a mutation word that is part of the item name', () => {
    const catalog: ValueCatalog = { ...SAB, items: [...SAB.items, { slug: 'lava-boss', name: 'Lava Boss' }] }
    expect(matchListingToValueItem({ title: 'Lava Boss', templateData: {} }, catalog)).toEqual({
      itemSlug: 'lava-boss',
      variant: 'default',
    })
  })

  it('matches a numeric name only as a whole word', () => {
    expect(matchListingToValueItem({ title: '67 Brainrot', templateData: {} }, SAB)?.itemSlug).toBe('67')
    expect(matchListingToValueItem({ title: 'Random 1670M/s thing', templateData: {} }, SAB)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchListingToValueItem({ title: 'Lucky Block', templateData: { 'select-brainrot': 'secret-lucky-block' } }, SAB)).toBeNull()
  })
})

describe('matchListingToValueItem — Adopt Me', () => {
  it('maps the trait by its LABEL, not its slug', () => {
    expect(
      matchListingToValueItem(
        {
          title: 'FR Bat Dragon | Quick Delivery | Adopt Me',
          templateData: { trait: 'r', 'pet-name': 'bat-dragon', 'item-type-2': 'pets' },
          optionLabels: AM_LABELS,
        },
        AM,
      ),
    ).toEqual({ itemSlug: 'bat-dragon', variant: 'fly-ride' })
    expect(
      matchListingToValueItem(
        { title: 'Neon Parrot', templateData: { trait: 'fr', 'pet-name': 'parrot' }, optionLabels: AM_LABELS },
        AM,
      ),
    ).toEqual({ itemSlug: 'parrot', variant: 'neon' })
  })

  it('reads the potion prefix from the title when there is no trait', () => {
    expect(matchListingToValueItem({ title: 'NFR Evil Unicorn', templateData: {} }, AM)).toEqual({
      itemSlug: 'evil-unicorn',
      variant: 'neon-fly-ride',
    })
    expect(matchListingToValueItem({ title: 'Mega Neon Fly Ride Parrot', templateData: {} }, AM)).toEqual({
      itemSlug: 'parrot',
      variant: 'mega-fly-ride',
    })
  })

  it('picks the longest item name', () => {
    expect(matchListingToValueItem({ title: 'FR Chocolate Chip Bat Dragon', templateData: {} }, AM)).toEqual({
      itemSlug: 'chocolate-chip-bat-dragon',
      variant: 'fly-ride',
    })
  })

  it('leaves the variant unknown when no potion is stated', () => {
    expect(matchListingToValueItem({ title: 'Bat Dragon', templateData: { 'pet-name': 'bat-dragon' } }, AM)).toEqual({
      itemSlug: 'bat-dragon',
      variant: null,
    })
  })

  it('ignores one-letter codes in titles (too ambiguous)', () => {
    expect(matchListingToValueItem({ title: 'R Bat Dragon', templateData: {} }, AM)?.variant).toBeNull()
  })
})

// 2026-10-04: "Fairy Bat Dragon NFR" (a pet not in the catalogue) showed on the
// Bat Dragon page. A catalogue name must be the WHOLE pet name: a word directly
// before it that is not a variant/quality token means the title names a
// different item.
describe('matchListingToValueItem — whole-name rule', () => {
  it('rejects a title whose extra leading word makes it a different pet', () => {
    expect(matchListingToValueItem({ title: 'Fairy Bat Dragon NFR', templateData: {} }, AM)).toBeNull()
    expect(matchListingToValueItem({ title: 'Golden Chocolate Chip Bat Dragon', templateData: {} }, AM)).toBeNull()
  })

  it('rejects it even when the seller picked the nearest catalogue pet in the template', () => {
    expect(
      matchListingToValueItem({ title: 'Fairy Bat Dragon NFR', templateData: { 'pet-name': 'bat-dragon' } }, AM),
    ).toBeNull()
  })

  it('accepts variant / quality tokens before the name, and words after it', () => {
    expect(matchListingToValueItem({ title: 'NFR Bat Dragon', templateData: {} }, AM)).toEqual({
      itemSlug: 'bat-dragon',
      variant: 'neon-fly-ride',
    })
    expect(matchListingToValueItem({ title: 'Bat Dragon NFR', templateData: {} }, AM)).toEqual({
      itemSlug: 'bat-dragon',
      variant: 'neon-fly-ride',
    })
    expect(matchListingToValueItem({ title: 'FR bat dragon |quick delivery| adopt me', templateData: {} }, AM)).toEqual({
      itemSlug: 'bat-dragon',
      variant: 'fly-ride',
    })
    expect(matchListingToValueItem({ title: 'Mega Neon Bat Dragon', templateData: {} }, AM)).toEqual({
      itemSlug: 'bat-dragon',
      variant: 'mega-neon',
    })
    expect(matchListingToValueItem({ title: 'Adopt Me | Neon Bat Dragon', templateData: {} }, AM)?.itemSlug).toBe('bat-dragon')
  })

  it('still prefers the longest catalogue name', () => {
    expect(matchListingToValueItem({ title: 'Neon Chocolate Chip Bat Dragon', templateData: {} }, AM)).toEqual({
      itemSlug: 'chocolate-chip-bat-dragon',
      variant: 'neon',
    })
  })

  it('SAB: a mutation word before the name is a variant, any other word is a different brainrot', () => {
    const catalog: ValueCatalog = { ...SAB, variants: [...SAB.variants, { key: 'divine', names: ['Divine'] }] }
    expect(matchListingToValueItem({ title: 'Divine Dragon Cannelloni', templateData: {} }, catalog)).toEqual({
      itemSlug: 'dragon-cannelloni',
      variant: 'divine',
    })
    expect(
      matchListingToValueItem(
        { title: 'Divine Dragon Cannelloni 250M/s', templateData: { 'select-brainrot': 'dragon-cannelloni' } },
        catalog,
      ),
    ).toEqual({ itemSlug: 'dragon-cannelloni', variant: 'divine' })
    expect(matchListingToValueItem({ title: '1.5B/s Dragon Cannelloni', templateData: {} }, catalog)?.itemSlug).toBe(
      'dragon-cannelloni',
    )
    expect(matchListingToValueItem({ title: 'Mystery Dragon Cannelloni', templateData: {} }, catalog)).toBeNull()
  })
})
