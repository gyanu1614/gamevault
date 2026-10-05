/**
 * Item listings page data: 404 is decided from the game, pair and catalogue
 * BEFORE any listing is read (CLAUDE.md "404 before the DB"), and the page is
 * filtered on the server (the first HTML holds only this item / variant).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildValueCatalog } from '@/lib/value-listings/catalogs'

vi.mock('server-only', () => ({}))
// React's request cache is a server-runtime API; identity in a unit test.
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
const getValueListings = vi.fn()
const getValueItemListings = vi.fn()
vi.mock('@/lib/value-listings/stock-server', () => ({
  getItemsPair: vi.fn(async (game: string) =>
    game === 'adopt-me' ? { gameId: 'g1', gameName: 'Adopt Me', gameImageUrl: null, pairId: 'p1', categorySlug: 'buy-items' } : null,
  ),
  getValueCatalog: vi.fn(async () =>
    buildValueCatalog('adopt-me', { items: [{ slug: 'bat-dragon', name: 'Bat Dragon' }, { slug: 'owl', name: 'Owl' }] }),
  ),
  getValueListings: (...a: unknown[]) => getValueListings(...a),
  getValueItemListings: (...a: unknown[]) => getValueItemListings(...a),
}))
vi.mock('./_itemsData', () => ({
  loadItemsTaxonomy: vi.fn(async () => ({ filters: [], categories: [], mutations: [] })),
  listingToOffer: (r: { id: string; price: number }) => ({ id: r.id, pricePerUnit: Number(r.price) }),
}))

import { getValueItemBuyData, loadItemListingsPage } from './_valueItemOffers'

const row = (id: string, item: string, variant: string | null, price: number) => ({ id, value_item_slug: item, value_variant: variant, price, seller_id: 's' })

describe('loadItemListingsPage', () => {
  beforeEach(() => {
    getValueListings.mockReset()
    getValueListings.mockResolvedValue({
      pair: {},
      rows: [row('a', 'bat-dragon', 'fly-ride', 300), row('b', 'bat-dragon', 'neon', 900), row('c', 'owl', 'neon', 40)],
    })
  })

  it.each([
    ['unknown game', 'fortnite', 'buy-items', 'bat-dragon', null],
    ['wrong category', 'adopt-me', 'buy-accounts', 'bat-dragon', null],
    ['unknown item', 'adopt-me', 'buy-items', 'nope', null],
    ['unknown variant', 'adopt-me', 'buy-items', 'bat-dragon', 'diamond'],
  ])('404s an %s without reading listings', async (_label, game, cat, item, variant) => {
    expect(await loadItemListingsPage(game, cat, item, variant)).toBeNull()
    expect(getValueListings).not.toHaveBeenCalled()
  })

  it('returns only the requested item and variant', async () => {
    const data = await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', 'neon')
    expect(data!.offers.map((o) => o.id)).toEqual(['b'])
    expect(data!.model.canonicalPath).toBe('/adopt-me/buy-items/item/bat-dragon')
  })

  it('falls back to other variants when the variant has none', async () => {
    const data = await loadItemListingsPage('adopt-me', 'buy-items', 'bat-dragon', 'mega-neon')
    expect(data!.offers).toEqual([])
    expect(data!.otherOffers.map((o) => o.id)).toEqual(['a', 'b'])
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
