/**
 * The shared "hidden sellers" and value-catalogue reads must never run INSIDE
 * another unstable_cache callback, and run at most once per render.
 *
 * Why (Supabase gateway, 24 h before this fix): public_profiles?is_test 17.7k,
 * seller_presence?store_paused 17.5k, adopt_me_pets catalogue 7.4k — for reads
 * cached for 1 h / 1 day. On Next 14.2 an unstable_cache called inside another
 * unstable_cache's callback runs with fetchCache 'force-no-store' and skips its
 * cache read (next/dist/server/web/spec-extension/unstable-cache.js), and every
 * on-demand ISR revalidation skips it too. So the reads are resolved OUTSIDE
 * the cached callbacks and handed in, and each loader is React-cache()d so one
 * render reads each set once even when the data cache is skipped.
 *
 * The fakes: unstable_cache records any call made inside another's callback
 * (AsyncLocalStorage, so concurrent top-level calls are not mistaken for
 * nesting); React cache() memoises per simulated render (cleared per test).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder } from '@/test/fakes/supabase-recorder'

const inCallback = new AsyncLocalStorage<string>()
const nested: string[] = []
const cacheCalls: Array<{ keys: string[]; tags: string[] }> = []
const renderMemo = new Map<unknown, Map<string, unknown>>()

vi.mock('server-only', () => ({}))
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  cache: (fn: (...a: unknown[]) => unknown) => (...args: unknown[]) => {
    let m = renderMemo.get(fn)
    if (!m) renderMemo.set(fn, (m = new Map()))
    const k = JSON.stringify(args)
    if (!m.has(k)) m.set(k, fn(...args))
    return m.get(k)
  },
}))
vi.mock('next/cache', () => ({
  unstable_cache:
    (fn: (...a: unknown[]) => unknown, keys: string[], opts: { tags?: string[] } = {}) =>
    async (...args: unknown[]) => {
      const name = keys.join('/')
      const outer = inCallback.getStore()
      if (outer) nested.push(`${name} inside ${outer}`)
      cacheCalls.push({ keys, tags: opts.tags ?? [] })
      return inCallback.run(name, () => fn(...args))
    },
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used on a public read')
  },
}))

const recorder = createSupabaseRecorder({
  seller_presence: [{ seller_id: 'p1' }],
  public_profiles: [{ id: 't1' }],
  games: [{ id: 'g1', name: 'Adopt Me', image_url: null }],
  game_categories: [{ id: 'pair1', slug: 'buy-items', type: 'items' }],
  adopt_me_pets: [],
  listings: [],
  orders: [],
  reviews: [],
})
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => recorder.client,
  createTaggedAnonClient: () => recorder.client,
}))
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => recorder.client }))
vi.mock('@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsData', () => ({
  loadItemsTaxonomy: async () => null,
  listingToOffer: (r: unknown) => r,
}))
vi.mock('@/lib/actions/admin-category-configs', () => ({ fetchCategoryConfigBySlug: async () => null }))

const reads = (table: string) => recorder.tables().filter((t) => t === table).length

beforeEach(() => {
  nested.length = 0
  cacheCalls.length = 0
  recorder.queries.length = 0
  renderMemo.clear()
})

describe('value item page (stock-server)', () => {
  it('reads hidden sellers + catalogue outside the cached listings read, once per render', async () => {
    const { getValueItemListings, getValueListings } = await import('@/lib/value-listings/stock-server')
    await getValueItemListings('adopt-me', 'bat-dragon')
    await getValueItemListings('adopt-me', 'frost-dragon')
    await getValueListings('adopt-me')
    expect(nested).toEqual([])
    expect(reads('seller_presence')).toBe(1)
    expect(reads('public_profiles')).toBe(1)
    expect(reads('adopt_me_pets')).toBe(1)
  })

  it('keeps the cache keys and tags of the listings reads', async () => {
    const { getValueItemListings, getValueListings } = await import('@/lib/value-listings/stock-server')
    await getValueItemListings('adopt-me', 'bat-dragon')
    await getValueListings('adopt-me')
    const item = cacheCalls.find((c) => c.keys[0] === 'value-item-listings')
    const game = cacheCalls.find((c) => c.keys[0] === 'value-listings')
    expect(item).toEqual({
      keys: ['value-item-listings', 'whole-name-v2', 'adopt-me', 'pair1', 'bat-dragon'],
      tags: ['value-stock:adopt-me:bat-dragon', 'values:adopt-me'],
    })
    expect(game).toEqual({
      keys: ['value-listings', 'whole-name-v2', 'adopt-me', 'pair1'],
      tags: ['value-stock:adopt-me', 'listings:category:pair1', 'values:adopt-me'],
    })
  })

  it('readValueListings receives the hidden ids and catalogue instead of loading them', async () => {
    const { readValueListings } = await import('@/lib/value-listings/stock-server')
    const pair = { gameId: 'g1', gameName: 'Adopt Me', gameImageUrl: null, pairId: 'pair1', categorySlug: 'buy-items' }
    await readValueListings(pair, 'bat-dragon', ['h1'], null)
    expect(recorder.tables()).toEqual(['listings'])
    expect(recorder.queries[0].calls).toContain('not')
  })
})

describe('category stats + game hub', () => {
  it('getCategoryStats with passed hidden ids makes no hidden-id read', async () => {
    const { getCategoryStats } = await import('@/lib/seo/page-stats')
    await getCategoryStats('g1', 'c1', ['h1'])
    expect(recorder.tables()).toEqual(['listings'])
    expect(recorder.queries[0].calls).toContain('not')
  })

  it('getCategoryStats without ids still reads each set once per render', async () => {
    const { getCategoryStats } = await import('@/lib/seo/page-stats')
    await Promise.all([getCategoryStats('g1', 'c1'), getCategoryStats('g1', 'c2'), getCategoryStats('g1', 'c3')])
    expect(reads('seller_presence')).toBe(1)
    expect(reads('public_profiles')).toBe(1)
  })

  it('the hub resolves hidden sellers once for every category + its offers', async () => {
    const { getHubCategoryStats, getHubOffers } = await import('@/app/(marketplace)/[gameSlug]/_hubData')
    const cats = ['currency', 'items', 'account', 'service'].map((type, i) => ({ id: `c${i}`, name: type, slug: type, type }))
    await Promise.all([getHubCategoryStats('g1', cats), getHubOffers('g1', cats)])
    expect(reads('seller_presence')).toBe(1)
    expect(reads('public_profiles')).toBe(1)
  })
})

describe('other cached readers of the hidden-seller sets', () => {
  it('price helper currency offers', async () => {
    const { getMarketPriceHint } = await import('@/lib/price-helper/server')
    await getMarketPriceHint({ gameSlug: 'roblox', categorySlug: 'currency', gameCategoryId: 'c1', templateData: {} })
    expect(nested).toEqual([])
    expect(reads('seller_presence')).toBe(1)
  })

  it('footer game activity', async () => {
    const { getCachedGameActivity } = await import('@/lib/marketplace/gameActivityCache')
    await getCachedGameActivity()
    expect(nested).toEqual([])
    expect(reads('public_profiles')).toBe(1)
  })

  it('currency guide review stats + live pages', async () => {
    const { getGameReviewStats, getRelatedPages } = await import('@/lib/currency-guides/server')
    const { getCurrencyGuide } = await import('@/lib/currency-guides')
    await getGameReviewStats('g1')
    const guide = getCurrencyGuide('roblox')
    if (guide) await getRelatedPages(guide, 'Roblox')
    expect(nested).toEqual([])
    expect(reads('public_profiles')).toBe(1)
  })
})
