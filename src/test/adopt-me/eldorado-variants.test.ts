/**
 * Eldorado Adopt Me trait → ladder variant mapping.
 *
 * Eldorado's "Traits" options are a 3 × 4 grid: {None, N = Neon, M = Mega
 * Neon} × {plain, F, R, FR} → None F R FR / N NF NR NFR / M MF MR MFR. So the
 * code "N" is NEON, not Normal. Until 2026-10-05 the collector mapped N →
 * Normal, and once the trait reader learned the new response shape every
 * "N Caterpillar" (a Neon) priced the Normal column: caterpillar N $59.54
 * (Normal is ~$14), 87+ pets with Normal above Neon/Mega.
 *
 * Fixtures are real listings from the 2026-10-05 Pets crawl
 * (data/adopt-me-catalog-dryrun/eldorado-crawl-2026-10-05.json).
 */
import { describe, expect, it } from 'vitest'

import {
  cleanEldoradoOffer,
  resolveListingVariant,
  variantFromTitle,
} from '../../../scripts/lib/adoptme-eldorado.mjs'

const NOW = Date.parse('2026-10-05T00:00:00Z')

function offer(o: { name: string; title: string; trait: string | null; price: number; reviews: number }) {
  return {
    offer: {
      id: Math.random().toString(36),
      offerTitle: o.title,
      tradeEnvironmentValues: [
        { name: 'Item type', value: 'Pets' },
        { name: 'Item name', value: o.name },
      ],
      attributes: o.trait == null ? [] : [{ name: 'Traits', value: { name: o.trait, id: 'x' } }],
      pricePerUnit: { amount: o.price, currency: 'USD' },
      quantity: 1,
    },
    user: { id: 'seller', createdDate: '2020-01-01T00:00:00Z' },
    userOrderInfo: { ratingCount: o.reviews, feedbackScore: 99 },
  }
}

const clean = (o: Parameters<typeof offer>[0]) =>
  cleanEldoradoOffer(offer(o), { petName: o.name, nowMs: NOW })

describe('Eldorado trait N is Neon, not Normal', () => {
  it('a bulk shop\'s "> N" listing is the NEON caterpillar', () => {
    expect(
      clean({ name: 'Caterpillar', title: 'Adopt Me > Caterpillar > N', trait: 'N', price: 59.54, reviews: 1343802 }),
    ).toMatchObject({ ok: true, listing: { variant: 'NEON', trait: 'N' } })
  })

  it('the same shop\'s "> Normal" listing (trait None) is the Normal caterpillar', () => {
    expect(
      clean({ name: 'Caterpillar', title: 'Adopt Me > Caterpillar > Normal', trait: 'None', price: 13.89, reviews: 1343806 }),
    ).toMatchObject({ ok: true, listing: { variant: 'N' } })
  })

  it('a neon age stage (Luminous) stays NEON', () => {
    expect(
      clean({ name: 'Caterpillar', title: 'N Luminous Caterpillar', trait: 'N', price: 103.97, reviews: 15699 }),
    ).toMatchObject({ ok: true, listing: { variant: 'NEON' } })
  })

  it('"Neon <pet>" with trait N agrees instead of conflicting', () => {
    expect(
      clean({ name: 'Eel', title: 'Adopt me Neon Eel', trait: 'N', price: 1.99, reviews: 2563 }),
    ).toMatchObject({ ok: true, listing: { variant: 'NEON' } })
  })

  it('M is still Mega Neon', () => {
    expect(
      clean({ name: 'Caelum Cervi', title: 'M Caelum Cervi', trait: 'M', price: 390, reviews: 5000 }),
    ).toMatchObject({ ok: true, listing: { variant: 'MEGA' } })
  })
})

describe('combo forms (NF / NR / MF / MR) have no ladder column and are dropped', () => {
  it.each([
    ['Shrew', '⭐ Rare NR Shrew ❤️ Neon Ride 🐾 Pet ✅ Fast Delivery', 'NR', 8.29], // was priced as R
    ['Peahen', 'PEAHEN NEON', 'NR', 15], // was priced as NEON
    ['Cheetah', 'Mega Neon Ride Cheetah', 'MR', 27.38], // was priced as MEGA
    ['Bluebottle Fly', 'MR Bluebottle Fly', 'MR', 5.97], // was priced as F
    ['Parakeet', 'Neon Fly Parakeet', 'NF', 0.43], // was priced as F
    ['Parakeet', 'Mega Neon Fly Parakeet', 'MF', 0.96], // was priced as MEGA
  ])('%s — "%s" (trait %s)', (name, title, trait, price) => {
    expect(clean({ name, title, trait, price, reviews: 15699 })).toEqual({ ok: false, reason: 'combo-variant' })
  })

  it('a combo title with no trait does not fall through to R / F / MEGA', () => {
    expect(variantFromTitle('Neon Ride Polar Bear')).toBeNull()
    expect(variantFromTitle('Neon Fly Puffer Fish')).toBeNull()
    expect(variantFromTitle('Mega Neon Ride Hippo')).toBeNull()
    expect(variantFromTitle('Dirty Ducky · Mega Neon Rideable')).toBeNull()
    expect(variantFromTitle('Oakee Wizard · Mega Neon Flyable')).toBeNull()
    expect(variantFromTitle('NR CAPYBARA > NEON RIDE')).toBeNull()
    // The full forms still parse.
    expect(variantFromTitle('Mega Neon Fly Ride 2D Kitty Pet')).toBe('MFR')
    expect(variantFromTitle('Neon Fly Ride Shrew Pet')).toBe('NFR')
    expect(variantFromTitle('Mega Neon Shrew Pet')).toBe('MEGA')
    expect(variantFromTitle('Ride Shrew Pet')).toBe('R')
  })
})

describe("the pet's own name never sets the variant", () => {
  it('"Bluebottle Fly" (trait None) is not a Fly potion', () => {
    expect(variantFromTitle('Bluebottle Fly', 'Bluebottle Fly')).toBeNull()
    expect(
      clean({ name: 'Bluebottle Fly', title: 'Adopt Me > Bluebottle Fly > Normal', trait: 'None', price: 0.43, reviews: 1343781 }),
    ).toMatchObject({ ok: true, listing: { variant: 'N' } })
    expect(
      clean({ name: 'Bluebottle Fly', title: 'Bluebottle Fly', trait: 'None', price: 0.43, reviews: 107095 }),
    ).toEqual({ ok: false, reason: 'no-variant' })
  })

  it('"F Bluebottle Fly" is a Fly; "Mega Neon Bluebottle Fly" is a Mega', () => {
    expect(
      clean({ name: 'Bluebottle Fly', title: 'F Bluebottle Fly | Full-Grown', trait: 'F', price: 6.33, reviews: 27027 }),
    ).toMatchObject({ ok: true, listing: { variant: 'F' } })
    expect(
      clean({ name: 'Bluebottle Fly', title: 'Mega Neon Bluebottle Fly', trait: 'M', price: 2.45, reviews: 107096 }),
    ).toMatchObject({ ok: true, listing: { variant: 'MEGA' } })
  })
})

describe('resolveListingVariant (re-derives a cached listing)', () => {
  it('maps a stored {trait, title} pair the same way the cleaner does', () => {
    expect(resolveListingVariant({ trait: 'N', title: 'N Shrew | Flare', petName: 'Shrew' })).toEqual({ variant: 'NEON' })
    expect(resolveListingVariant({ trait: 'NR', title: 'Neon Ride Clumpty', petName: 'Clumpty' })).toEqual({
      variant: null,
      reason: 'combo-variant',
    })
    expect(resolveListingVariant({ trait: 'FR', title: 'MFR Owl', petName: 'Owl' })).toEqual({
      variant: null,
      reason: 'variant-conflict',
    })
  })
})
