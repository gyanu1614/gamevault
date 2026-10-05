/**
 * `eldorado-structured` normaliser, pinned against the live MM2 offer shapes
 * (gameId 204, 2026-10-04 crawl).
 */
import { describe, it, expect } from 'vitest'

import {
  comparableName,
  extractEldoradoOffer,
  marketKey,
  normaliseStructuredListing,
} from './eldorado-structured'
import { ELDORADO_STRUCTURED_GAMES, eldoradoStructuredConfig } from '../sources/eldorado-structured-games'

const MM2 = eldoradoStructuredConfig('murder-mystery-2')!

/** A raw offers-API result row as Eldorado returns it. */
function rawOffer(over: { title?: string; tev?: Record<string, string>; props?: string | null; price?: number; reviews?: number | null } = {}) {
  const tev = over.tev ?? { 'Item type': 'Knife', Rarity: 'Godly', 'Item name': 'Fang' }
  return {
    offer: {
      id: 'offer-1',
      offerTitle: over.title ?? 'Fang | Instant',
      tradeEnvironmentValues: Object.entries(tev).map(([name, value]) => ({ name, value })),
      attributes: over.props === null ? [] : [{ id: 'mm2-properties', name: 'Properties', values: [{ name: over.props ?? 'Common' }] }],
      pricePerUnitInUSD: { amount: over.price ?? 1.25 },
      quantity: 7,
      standardizedProductKey: '204|KNIFE|FANG|GODLY',
    },
    user: { id: 'seller-1' },
    userOrderInfo: { ratingCount: over.reviews === undefined ? 512 : over.reviews },
  }
}

const listing = (over: Parameters<typeof rawOffer>[0] = {}) => extractEldoradoOffer(rawOffer(over), MM2)!

describe('config', () => {
  it('MM2 is Eldorado gameId 204 with the mm2-properties variant attribute', () => {
    expect(MM2.gameId).toBe('204')
    expect(MM2.variant?.attributeId).toBe('mm2-properties')
    expect(MM2.variant?.map).toEqual({ Common: 'default', Chroma: 'chroma' })
  })

  it('every configured game names its own slug', () => {
    for (const [slug, config] of Object.entries(ELDORADO_STRUCTURED_GAMES)) expect(config.gameSlug).toBe(slug)
  })
})

describe('extractEldoradoOffer', () => {
  it('keeps the structured identity, price, stock, seller and review count', () => {
    expect(listing()).toEqual({
      source: 'eldorado',
      source_offer_id: 'offer-1',
      title: 'Fang | Instant',
      price_usd: 1.25,
      quantity: 7,
      seller_ref: 'seller-1',
      seller_reviews: 512,
      item_type_raw: 'Knife',
      item_name_raw: 'Fang',
      rarity_raw: 'Godly',
      variant_raw: 'Common',
      product_key: '204|KNIFE|FANG|GODLY',
    })
  })

  it('returns null for a row without an offer id instead of throwing mid-crawl', () => {
    expect(extractEldoradoOffer({ offer: {} }, MM2)).toBeNull()
    expect(extractEldoradoOffer(null, MM2)).toBeNull()
  })

  it('a missing review count stays null (the reputable gate drops it), never 0', () => {
    expect(listing({ reviews: null }).seller_reviews).toBeNull()
  })
})

describe('normaliseStructuredListing — identity', () => {
  it('identity = type + item name; the year suffix is part of the name', () => {
    const id = normaliseStructuredListing(listing({ tev: { 'Item type': 'Gun', Rarity: 'Ancient', 'Item name': 'Harvester (2021)' } }), MM2)
    expect(id).toMatchObject({ status: 'ok', itemType: 'gun', name: 'Harvester (2021)', rarity: 'Ancient', variant: 'default' })
    expect(id.marketKey).toBe('gun|default|harvester 2021')
  })

  it('the same name is a different item per type', () => {
    const knife = normaliseStructuredListing(listing({ tev: { 'Item type': 'Knife', 'Item name': 'Splash' } }), MM2)
    const gun = normaliseStructuredListing(listing({ tev: { 'Item type': 'Gun', 'Item name': 'Splash' } }), MM2)
    expect(knife.marketKey).not.toBe(gun.marketKey)
  })

  it('rejects the "Other" type (VIP servers, sets) and the "Other" placeholder name', () => {
    expect(normaliseStructuredListing(listing({ tev: { 'Item type': 'Other' } }), MM2).status).toBe('rejected')
    expect(normaliseStructuredListing(listing({ tev: { 'Item type': 'Gun', 'Item name': 'Other' } }), MM2).status).toBe('rejected')
  })

  it('rejects offers with no structured type or name, and unknown types', () => {
    expect(normaliseStructuredListing(listing({ tev: {} }), MM2).status).toBe('rejected')
    expect(normaliseStructuredListing(listing({ tev: { 'Item type': 'Knife' } }), MM2).status).toBe('rejected')
    expect(normaliseStructuredListing(listing({ tev: { 'Item type': 'Sword', 'Item name': 'X' } }), MM2).note).toMatch(/unknown item type/)
  })
})

describe('normaliseStructuredListing — variant (attribute first, title fallback)', () => {
  it('a Chroma attribute is chroma even when the title omits it ("Fire Dog")', () => {
    const id = normaliseStructuredListing(listing({ title: 'Fire Dog', props: 'Chroma' }), MM2)
    expect(id).toMatchObject({ status: 'ok', variant: 'chroma', variantSource: 'attribute' })
    expect(id.marketKey).toBe('knife|chroma|fang')
  })

  it('Common attribute + a title that explicitly says Chroma is ambiguous, never priced', () => {
    const id = normaliseStructuredListing(listing({ title: 'Chroma Fire Pig', props: 'Common' }), MM2)
    expect(id.status).toBe('ambiguous')
  })

  it('"Chromatic" (a real item) is not the chroma variant', () => {
    const id = normaliseStructuredListing(
      listing({ title: 'Chromatic (Gun) cheap', props: 'Common', tev: { 'Item type': 'Gun', 'Item name': 'Chromatic' } }),
      MM2,
    )
    expect(id).toMatchObject({ status: 'ok', variant: 'default' })
  })

  it('no attribute → the title decides, else the default', () => {
    expect(normaliseStructuredListing(listing({ title: 'Chroma Fang!!', props: null }), MM2)).toMatchObject({ variant: 'chroma', variantSource: 'title' })
    expect(normaliseStructuredListing(listing({ title: 'Fang', props: null }), MM2)).toMatchObject({ variant: 'default', variantSource: 'default' })
  })
})

describe('comparableName / marketKey', () => {
  it('folds quotes, apostrophes and punctuation', () => {
    expect(comparableName('Traveler’s Gun')).toBe('travelers gun')
    expect(comparableName("Traveler's Gun")).toBe('travelers gun')
    expect(comparableName('Stickers (Halloween 2021)')).toBe('stickers halloween 2021')
    expect(marketKey('knife', 'chroma', 'Fang')).toBe('knife|chroma|fang')
  })
})
