import { describe, expect, it } from 'vitest'
import {
  currencyListingRedirect,
  currencyOfferUrl,
  isCurrencyCategoryType,
  listingUrl,
} from './url'
import { findLinkedOffer, readCurrencyOfferLink } from './currency-offer-link'

const ID = '0b7a1c2e-4d5f-4a6b-8c9d-0e1f2a3b4c5d'
const OTHER = '9f8e7d6c-5b4a-4321-8fed-cba987654321'

describe('listingUrl', () => {
  const item = {
    id: ID,
    slug: 'rare-og-account-c0b478d2',
    game: { slug: 'fortnite' },
    category: { slug: 'buy-accounts', type: 'account' },
  }

  it('keeps item/account listings on their own page', () => {
    expect(listingUrl(item)).toBe('/fortnite/buy-accounts/rare-og-account-c0b478d2')
  })

  it('sends a currency listing to its currency page with the seller + offer pinned', () => {
    expect(
      listingUrl({
        id: ID,
        slug: 'r6-siege-15000-credits-c0b478d2',
        game: { slug: 'r6-siege' },
        category: { slug: 'buy-credits', type: 'currency' },
        seller: { shop_slug: 'fast-credits', username: 'bob' },
      }),
    ).toBe(`/r6-siege/buy-credits?seller=fast-credits&offer=${ID}`)
  })

  it('builds the currency form even when the listing has no slug', () => {
    expect(
      listingUrl({ id: ID, slug: null, game: { slug: 'roblox' }, category: { slug: 'buy-robux', type: 'currency' } }),
    ).toBe(`/roblox/buy-robux?offer=${ID}`)
  })

  it('falls back to the legacy resolver without game/category slugs', () => {
    expect(listingUrl({ ...item, game: null })).toBe(`/listings/${ID}`)
  })
})

describe('currencyOfferUrl', () => {
  it('omits empty params', () => {
    expect(currencyOfferUrl({ gameSlug: 'roblox', categorySlug: 'buy-robux' })).toBe('/roblox/buy-robux')
  })

  it('encodes the seller slug', () => {
    expect(currencyOfferUrl({ gameSlug: 'g', categorySlug: 'c', sellerSlug: 'a b&c' })).toBe('/g/c?seller=a+b%26c')
  })
})

describe('isCurrencyCategoryType', () => {
  it('is true only for the currency type', () => {
    expect(isCurrencyCategoryType('currency')).toBe(true)
    for (const t of ['items', 'account', 'top_up', 'service', 'gift_card', null, undefined]) {
      expect(isCurrencyCategoryType(t)).toBe(false)
    }
  })
})

describe('currencyListingRedirect (listing route decision)', () => {
  it('does not redirect a non-currency category', () => {
    expect(
      currencyListingRedirect({
        gameSlug: 'fortnite',
        category: { slug: 'buy-accounts', type: 'account' },
        listing: { id: ID, seller: { shop_slug: 's' } },
      }),
    ).toBeNull()
  })

  it('does not redirect when the category is unknown (the route 404s as before)', () => {
    expect(currencyListingRedirect({ gameSlug: 'g', category: null, listing: null })).toBeNull()
  })

  it('redirects a live currency listing to the currency page with its seller + offer', () => {
    expect(
      currencyListingRedirect({
        gameSlug: 'r6-siege',
        category: { slug: 'buy-credits', type: 'currency' },
        listing: { id: ID, seller: { shop_slug: null, username: 'bob' } },
      }),
    ).toBe(`/r6-siege/buy-credits?seller=bob&offer=${ID}`)
  })

  it('redirects a dead currency listing to the plain currency page', () => {
    expect(
      currencyListingRedirect({ gameSlug: 'r6-siege', category: { slug: 'buy-credits', type: 'currency' }, listing: null }),
    ).toBe('/r6-siege/buy-credits')
  })
})

describe('readCurrencyOfferLink', () => {
  it('reads a valid seller + offer', () => {
    expect(readCurrencyOfferLink(new URLSearchParams(`seller=fast-credits&offer=${ID}`))).toEqual({
      offerId: ID,
      sellerSlug: 'fast-credits',
    })
  })

  it('drops malformed values', () => {
    expect(readCurrencyOfferLink(new URLSearchParams('seller=<script>&offer=not-a-uuid'))).toEqual({
      offerId: null,
      sellerSlug: null,
    })
  })

  it('is empty without params', () => {
    expect(readCurrencyOfferLink(new URLSearchParams(''))).toEqual({ offerId: null, sellerSlug: null })
  })
})

describe('findLinkedOffer', () => {
  type O = { id: string; seller: string | null; price: number }
  const offers: O[] = [
    { id: OTHER, seller: 'cheap', price: 1 },
    { id: ID, seller: 'fast-credits', price: 9 },
    { id: 'x', seller: 'fast-credits', price: 4 },
  ]
  const get = { id: (o: O) => o.id, sellerSlug: (o: O) => o.seller, price: (o: O) => o.price }

  it('finds the exact offer by id', () => {
    expect(findLinkedOffer(offers, { offerId: ID, sellerSlug: 'cheap' }, get)?.id).toBe(ID)
  })

  it("falls back to the seller's cheapest offer when the listing is gone", () => {
    expect(findLinkedOffer(offers, { offerId: '11111111-1111-4111-8111-111111111111', sellerSlug: 'fast-credits' }, get)?.id).toBe('x')
  })

  it('matches the seller slug case-insensitively', () => {
    expect(findLinkedOffer(offers, { offerId: null, sellerSlug: 'Fast-Credits' }, get)?.id).toBe('x')
  })

  it('returns null when nothing matches (page keeps its normal pick)', () => {
    expect(findLinkedOffer(offers, { offerId: null, sellerSlug: 'nobody' }, get)).toBeNull()
    expect(findLinkedOffer(offers, { offerId: null, sellerSlug: null }, get)).toBeNull()
  })
})
