/**
 * Item listings page data: 404 is decided from the game, pair and catalogue
 * BEFORE any listing is read (CLAUDE.md "404 before the DB"), and the page is
 * filtered on the server (the first HTML holds only this item's offers, each
 * with its trait, so the trait picker works without another request).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildValueCatalog } from '@/lib/value-listings/catalogs'

vi.mock('server-only', () => ({}))
// React's request cache is a server-runtime API; identity in a unit test.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
const getValueListings = vi.fn()
const getValueItemListings = vi.fn()
const getValueItemDescriptions = vi.fn(async () => ({ b: 'Fast trade, message me first.' }))
const itemPageExistsFresh = vi.fn(async () => false)
vi.mock('@/lib/value-listings/stock-server', () => ({
  getItemsPair: vi.fn(async (game: string) =>
    game === 'adopt-me' ? { gameId: 'g1', gameName: 'Adopt Me', gameImageUrl: null, pairId: 'p1', categorySlug: 'buy-items' } : null,
  ),
  getValueCatalog: vi.fn(async () =>
    buildValueCatalog('adopt-me', { items: [{ slug: 'bat-dragon', name: 'Bat Dragon' }, { slug: 'owl', name: 'Owl' }] }),
  ),
  itemPageExistsFresh: (...a: unknown[]) => itemPageExistsFresh(...(a as [])),
  getValueListings: (...a: unknown[]) => getValueListings(...a),
  getValueItemDescriptions: (...a: unknown[]) => getValueItemDescriptions(...(a as [])),
  getValueItemListings: (...a: unknown[]) => getValueItemListings(...a),
}))
vi.mock('./_itemsData', () => ({
  loadItemsTaxonomy: vi.fn(async () => ({ filters: [], categories: [], mutations: [] })),
  listingToOffer: (r: { id: string; price: number }) => ({ id: r.id, pricePerUnit: Number(r.price) }),
}))

import { getValueItemBuyData, loadItemListingsPage, resolveItemRoute } from './_valueItemOffers'

const row = (id: string, item: string, variant: string | null, price: number) => ({ id, value_item_slug: item, value_variant: variant, price, seller_id: 's' })

describe('loadItemListingsPage', () => {
  beforeEach(() => {
    getValueListings.mockReset()
    getValueItemDescriptions.mockClear()
    itemPageExistsFresh.mockReset()
    itemPageExistsFresh.mockResolvedValue(false)
    getValueListings.mockResolvedValue({
      pair: {},
      rows: [row('a', 'bat-dragon', 'fly-ride', 300), row('b', 'bat-dragon', 'neon', 900), row('c', 'owl', 'neon', 40)],
    })
  })

  // 2026-11-06: /murder-mystery-2/buy-items/item/emberbow was saved as a 404
  // seconds after its first listing went live, with the item in the database.
  // A saved 404 stays until the next release, so the database has the last word.
  it('never answers 404 for an item the database still has', async () => {
    itemPageExistsFresh.mockResolvedValue(true)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(resolveItemRoute('adopt-me', 'buy-items', 'nope', null)).rejects.toMatchObject({ name: 'PublicReadError' })
    expect(itemPageExistsFresh).toHaveBeenCalledWith('adopt-me', 'buy-items', 'nope')
    // What a future case needs to find the layer that was wrong.
    expect(error.mock.calls[0][1]).toMatchObject({ gameSlug: 'adopt-me', itemSlug: 'nope', hasPair: true, catalogItems: 2 })
    error.mockRestore()
  })

  it('a failed check keeps the last page: it throws, it does not become a 404', async () => {
    itemPageExistsFresh.mockRejectedValue(Object.assign(new Error('down'), { name: 'PublicReadError' }))
    await expect(resolveItemRoute('adopt-me', 'buy-items', 'nope', null)).rejects.toMatchObject({ name: 'PublicReadError' })
  })

  it('an item the saved data has needs no extra read', async () => {
    await resolveItemRoute('adopt-me', 'buy-items', 'bat-dragon', null)
    expect(itemPageExistsFresh).not.toHaveBeenCalled()
  })

  it('an unknown trait of a real item stays a 404 with no extra read', async () => {
    expect(await resolveItemRoute('adopt-me', 'buy-items', 'bat-dragon', 'diamond')).toBeNull()
    expect(itemPageExistsFresh).not.toHaveBeenCalled()
  })

  // 2026-11-06: a new Sunrise offer showed the stock hand-over text, not the
  // seller's. Descriptions are read for the offers on the page, so a new offer
  // can't be served from a copy saved before it existed.
  it('reads descriptions for the offers on the page', async () => {
    await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', null)
    expect(getValueItemDescriptions).toHaveBeenCalledWith('adopt-me', 'bat-dragon', ['a', 'b'])
  })

  it('an item with no offers reads no descriptions', async () => {
    getValueListings.mockResolvedValue({ pair: {}, rows: [row('c', 'owl', 'neon', 40)] })
    const data = await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', null)
    expect(data!.offers).toEqual([])
    expect(getValueItemDescriptions).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown game', 'fortnite', 'buy-items', 'bat-dragon', null],
    ['wrong category', 'adopt-me', 'buy-accounts', 'bat-dragon', null],
    ['unknown item', 'adopt-me', 'buy-items', 'nope', null],
    ['unknown variant', 'adopt-me', 'buy-items', 'bat-dragon', 'diamond'],
  ])('404s an %s without reading listings', async (_label, game, cat, item, variant) => {
    expect(await resolveItemRoute(game, cat, item, variant)).toBeNull()
    expect(await loadItemListingsPage(game, cat, item, variant)).toBeNull()
    expect(getValueListings).not.toHaveBeenCalled()
    expect(getValueItemDescriptions).not.toHaveBeenCalled()
  })

  // The route awaits this ahead of its Suspense boundary (skeleton), so it must stay cheap.
  it('an existing pet and trait pass the route check without reading listings', async () => {
    expect(await resolveItemRoute('adopt-me', 'buy-items', 'bat-dragon', 'neon')).toMatchObject({ pair: { categorySlug: 'buy-items' } })
    expect(getValueListings).not.toHaveBeenCalled()
  })

  it('returns every offer of the item (no other item), cheapest first, with its trait', async () => {
    const data = await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', 'neon')
    expect(data!.offers.map((o) => o.id)).toEqual(['a', 'b'])
    expect(data!.offerVariants).toEqual({ a: 'fly-ride', b: 'neon' })
    expect(data!.offers.map((o) => o.description)).toEqual([null, 'Fast trade, message me first.'])
    expect(data!.model.results.map((r) => r.id)).toEqual(['b'])
    expect(data!.model.canonicalPath).toBe('/adopt-me/buy-items/item/bat-dragon')
  })

  it('a trait nobody sells still loads the item’s other offers', async () => {
    const data = await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', 'mega-neon')
    expect(data!.model.results).toEqual([])
    expect(data!.offers.map((o) => o.id)).toEqual(['a', 'b'])
  })
})

describe('getValueItemBuyData — the value item page reads ONE item (T1)', () => {
  beforeEach(() => {
    getValueListings.mockReset()
    getValueItemListings.mockReset()
    getValueItemListings.mockResolvedValue({
      pair: { gameId: 'g1', categorySlug: 'buy-items' },
      rows: [row('b', 'bat-dragon', 'neon', 900), row('a', 'bat-dragon', 'fly-ride', 300)],
    })
  })

  it('uses the per-item read (its own stock tag), never the per-game one', async () => {
    const data = await getValueItemBuyData('adopt-me', 'bat-dragon')
    expect(getValueItemListings).toHaveBeenCalledWith('adopt-me', 'bat-dragon')
    // The per-game read carries the items-pair listings tag: any listing of the
    // game would rebuild this page.
    expect(getValueListings).not.toHaveBeenCalled()
    expect(data!.offers.map((o) => o.id)).toEqual(['a', 'b'])
    expect(data!.stock).not.toBeNull()
  })
})
