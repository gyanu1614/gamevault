import { describe, it, expect } from 'vitest'
import {
  ALL,
  anonymiseBuyer,
  avgStatedDeliveryLabel,
  categoryFacets,
  DEFAULT_STORE_FILTERS,
  filterReviews,
  filterStoreOffers,
  gameFacets,
  ratingBreakdown,
  reconcileFilters,
  storeSortOptions,
  type StoreOffer,
  type StoreReview,
} from './storefront-model'

function so(
  id: string,
  price: number,
  game: string,
  category: string,
  opts: { createdAt?: string; sales?: number; name?: string } = {},
): StoreOffer {
  return {
    offer: { id, name: opts.name ?? `Offer ${id}`, pricePerUnit: price, breadcrumb: [], mutations: [] } as any,
    game: { id: `g-${game}`, slug: game, name: game.toUpperCase() },
    category: { slug: `buy-${category.toLowerCase()}`, name: category, type: null },
    createdAt: opts.createdAt ?? '2026-10-01T00:00:00Z',
    sales: opts.sales ?? 0,
  }
}

const offers = [
  so('a', 10, 'sab', 'Items', { createdAt: '2026-10-03T00:00:00Z', name: 'Garama Madundung' }),
  so('b', 5, 'sab', 'Accounts', { createdAt: '2026-10-01T00:00:00Z' }),
  so('c', 20, 'mm2', 'Items', { createdAt: '2026-10-02T00:00:00Z', sales: 4 }),
]

describe('storefront offers — facets', () => {
  it('lists games by offer count', () => {
    expect(gameFacets(offers).map((f) => [f.slug, f.count])).toEqual([['sab', 2], ['mm2', 1]])
  })

  it('merges categories across games by name, and narrows to the chosen game', () => {
    expect(categoryFacets(offers, ALL).map((f) => [f.slug, f.count])).toEqual([['items', 2], ['accounts', 1]])
    expect(categoryFacets(offers, 'mm2').map((f) => f.slug)).toEqual(['items'])
  })
})

describe('storefront offers — filter, search, sort', () => {
  const ids = (xs: StoreOffer[]) => xs.map((x) => x.offer.id)

  it('Newest by default', () => {
    expect(ids(filterStoreOffers(offers, DEFAULT_STORE_FILTERS))).toEqual(['a', 'c', 'b'])
  })

  it('price low→high and high→low', () => {
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, sort: 'price-asc' }))).toEqual(['b', 'a', 'c'])
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, sort: 'price-desc' }))).toEqual(['c', 'a', 'b'])
  })

  it('best selling', () => {
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, sort: 'best-selling' }))[0]).toBe('c')
  })

  it('filters by game and category', () => {
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, game: 'sab' }))).toEqual(['a', 'b'])
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, category: 'items' }))).toEqual(['a', 'c'])
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, game: 'sab', category: 'items' }))).toEqual(['a'])
  })

  it('searches name, game and category, every word must match', () => {
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, q: 'garama' }))).toEqual(['a'])
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, q: 'mm2 items' }))).toEqual(['c'])
    expect(ids(filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, q: 'garama mm2' }))).toEqual([])
  })

  it('does not mutate its input', () => {
    const copy = [...offers]
    filterStoreOffers(offers, { ...DEFAULT_STORE_FILTERS, sort: 'price-asc' })
    expect(offers).toEqual(copy)
  })

  it('offers Best Selling only when some offer has sales', () => {
    expect(storeSortOptions(offers).map((o) => o.slug)).toContain('best-selling')
    expect(storeSortOptions([offers[0], offers[1]]).map((o) => o.slug)).not.toContain('best-selling')
  })

  it('resets a category that does not exist under the picked game', () => {
    expect(reconcileFilters(offers, { ...DEFAULT_STORE_FILTERS, game: 'mm2', category: 'accounts' }).category).toBe(ALL)
    expect(reconcileFilters(offers, { ...DEFAULT_STORE_FILTERS, game: 'nope' }).game).toBe(ALL)
    expect(reconcileFilters([offers[0]], { ...DEFAULT_STORE_FILTERS, sort: 'best-selling' }).sort).toBe('newest')
  })
})

describe('storefront stats', () => {
  it('labels the average stated delivery', () => {
    expect(avgStatedDeliveryLabel([])).toBeNull()
    expect(avgStatedDeliveryLabel(['instant', 'instant'])).toBe('Instant')
    expect(avgStatedDeliveryLabel(['20min'])).toBe('~20 Mins')
    expect(avgStatedDeliveryLabel(['1hr', '3hr'])).toBe('~2 Hours')
    expect(avgStatedDeliveryLabel(['24hr', '72hr'])).toBe('~2 Days')
  })
})

describe('storefront reviews', () => {
  it('breaks ratings down and ignores junk', () => {
    const b = ratingBreakdown([5, 5, 4, 1, 0, 7, NaN])
    expect(b.total).toBe(4)
    expect(b.counts).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 })
    expect(b.average).toBe(3.8)
    expect(b.positivePercent).toBe(75)
    expect(b.positive).toBe(3)
    expect(b.negative).toBe(1)
    expect(ratingBreakdown([]).positivePercent).toBeNull()
  })

  it('filters by sentiment and by star', () => {
    const r = (id: string, rating: number) => ({ id, rating }) as StoreReview
    const list = [r('a', 5), r('b', 4), r('c', 2), r('d', 3)]
    expect(filterReviews(list, 'all')).toHaveLength(4)
    expect(filterReviews(list, 'positive').map((x) => x.id)).toEqual(['a', 'b'])
    expect(filterReviews(list, 'negative').map((x) => x.id)).toEqual(['c', 'd'])
    expect(filterReviews(list, '4').map((x) => x.id)).toEqual(['b'])
  })

  it('anonymises reviewer handles', () => {
    expect(anonymiseBuyer('gyanu1614')).toBe('gya***')
    expect(anonymiseBuyer('ab')).toBe('ab***')
    expect(anonymiseBuyer('')).toBe('Anonymous')
    expect(anonymiseBuyer(null)).toBe('Anonymous')
  })
})
