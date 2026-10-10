/**
 * The listing detail page is ISR (2026-10-09, Supabase usage cut): no cookie
 * client anywhere on the public path, active listings only, reads tagged with
 * the listing's category, and a listing found under the wrong URL 308s to its
 * canonical one. Its owner/admin preview lives at /listing-preview/[id].
 *
 * The cookie client is mocked to THROW. Driven through generateMetadata, which
 * runs the same gate as the route (resolveOrExit) before anything streams.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '../fakes/supabase-recorder'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used on the public listing page')
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`)
  },
}))
vi.mock('@/components/marketplace/GameHeroBackdrop', () => ({ GameHeroBackdrop: () => null }))
vi.mock('@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/_ListingDetailSkeleton', () => ({
  default: () => null,
}))
vi.mock('@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/_ListingDetailBody', () => ({
  LISTING_DETAIL_SELECT: '*',
  ListingDetailBody: () => null,
}))

const gate = {
  game: { id: 'g1', name: 'Adopt Me', slug: 'adopt-me' } as Record<string, unknown> | null,
  category: { id: 'c1', name: 'Pets', slug: 'pets', type: 'items' } as Record<string, unknown> | null,
}
vi.mock('@/app/(marketplace)/[gameSlug]/[categorySlug]/_routeGate', () => ({
  getActiveGame: async () => gate.game,
  getEnabledCategory: async () => gate.category,
}))

const clients: { category: SupabaseRecorder; home: SupabaseRecorder } = {
  category: createSupabaseRecorder(),
  home: createSupabaseRecorder(),
}
const categoryTags: string[][] = []
vi.mock('@/lib/listings/read-client', () => ({
  createCategoryListingsReadClient: (ids: string[]) => {
    categoryTags.push(ids)
    return clients.category.client
  },
  createHomeListingsReadClient: () => clients.home.client,
}))

const LISTING = {
  id: '0b7e6a52-3c1d-4f5e-9a8b-1c2d3e4f5a6b',
  slug: 'shadow-dragon-mfr',
  title: 'Shadow Dragon MFR',
  description: 'Fast trade.',
  price: 120,
  status: 'active',
  images: [],
  seller: { is_test: false },
  game: { name: 'Adopt Me', slug: 'adopt-me' },
  category: { name: 'Pets', slug: 'pets' },
}

const params = (gameSlug: string, categorySlug: string, listingSlug: string) => ({
  params: Promise.resolve({ gameSlug, categorySlug, listingSlug }),
})

async function metadata(p: ReturnType<typeof params>) {
  const { generateMetadata } = await import(
    '@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/page'
  )
  return generateMetadata(p)
}

beforeEach(() => {
  gate.game = { id: 'g1', name: 'Adopt Me', slug: 'adopt-me' }
  gate.category = { id: 'c1', name: 'Pets', slug: 'pets', type: 'items' }
  categoryTags.length = 0
})

describe('listing page (ISR)', () => {
  it('is cached: revalidate window + on-demand params', async () => {
    const page = await import('@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/page')
    expect(page.revalidate).toBe(86400)
    await expect(page.generateStaticParams()).resolves.toEqual([])
  })

  it('reads the active listing in its URL category, tagged with that category', async () => {
    clients.category = createSupabaseRecorder({ listings: [LISTING] })
    clients.home = createSupabaseRecorder({ listings: [] })
    const meta = await metadata(params('adopt-me', 'pets', 'shadow-dragon-mfr'))
    expect(String(meta.title)).toContain('Shadow Dragon MFR')
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(categoryTags).toContainEqual(['c1'])
    const read = clients.category.queries.find((q) => q.table === 'listings')
    expect(read?.calls).toEqual(['select', 'eq', 'eq', 'eq', 'maybeSingle'])
    expect(clients.home.queries).toEqual([])
  })

  it('308s a listing found under another category to its canonical URL', async () => {
    clients.category = createSupabaseRecorder({ listings: [] })
    clients.home = createSupabaseRecorder({ listings: [LISTING] })
    await expect(metadata(params('adopt-me', 'eggs', 'shadow-dragon-mfr'))).rejects.toThrow(
      'REDIRECT /adopt-me/pets/shadow-dragon-mfr',
    )
  })

  it('renders (no redirect loop) when its own game/category is not live', async () => {
    gate.category = null
    clients.category = createSupabaseRecorder({ listings: [] })
    clients.home = createSupabaseRecorder({ listings: [LISTING] })
    const meta = await metadata(params('adopt-me', 'pets', 'shadow-dragon-mfr'))
    expect(String(meta.title)).toContain('Shadow Dragon MFR')
  })

  it('404s when the listing\'s game is hidden from the public (no crash)', async () => {
    gate.game = null
    clients.category = createSupabaseRecorder({ listings: [] })
    clients.home = createSupabaseRecorder({ listings: [{ ...LISTING, game: null }] })
    await expect(metadata(params('adopt-me', 'pets', 'shadow-dragon-mfr'))).rejects.toThrow('NOT_FOUND')
  })

  it('404s when no active listing matches (pending ones live at /listing-preview)', async () => {
    clients.category = createSupabaseRecorder({ listings: [] })
    clients.home = createSupabaseRecorder({ listings: [] })
    await expect(metadata(params('adopt-me', 'pets', 'not-live-yet'))).rejects.toThrow('NOT_FOUND')
  })

  it('drops follow for a test seller', async () => {
    clients.category = createSupabaseRecorder({ listings: [{ ...LISTING, seller: { is_test: true } }] })
    const meta = await metadata(params('adopt-me', 'pets', 'shadow-dragon-mfr'))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })
})

describe('listingOwnerUrl', () => {
  it('sends owners to the live page or, while not live, the preview', async () => {
    const { listingOwnerUrl } = await import('@/lib/listings/url')
    const base = { id: LISTING.id, slug: LISTING.slug, game: LISTING.game, category: LISTING.category }
    expect(listingOwnerUrl({ ...base, status: 'active' })).toBe('/adopt-me/pets/shadow-dragon-mfr')
    expect(listingOwnerUrl({ ...base, status: 'pending_approval' })).toBe(`/listing-preview/${LISTING.id}`)
    // Currency offers have no listing page; their link is the currency page.
    expect(
      listingOwnerUrl({ ...base, category: { slug: 'buy-robux', type: 'currency' }, status: 'paused' }),
    ).toMatch(/^\/adopt-me\/buy-robux\?/)
  })
})
