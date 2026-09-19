/**
 * Step 7a — `/[gameSlug]/[categorySlug]` is a catch-all for every two-segment
 * URL, so scanner junk (`/wp-admin/setup-config.php`) and typos land here. The
 * gate must settle 404 before any listing/seller/profile read, and with the
 * route on ISR the 404 is then cached.
 *
 * Uses the recording fake: no DB, and the assertion is on WHICH tables were
 * touched, which is the whole point.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '../fakes/supabase-recorder'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used in the route gate')
  },
}))

let recorder: SupabaseRecorder
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))

const EXPENSIVE = new Set(['listings', 'profiles', 'seller_presence', 'category_configs', '<auth.getUser>'])

describe('category route gate', () => {
  beforeEach(() => {
    recorder = createSupabaseRecorder()
  })

  it('an unknown game 404s after exactly one games lookup', async () => {
    const { resolveCategoryRoute } = await import(
      '@/app/(marketplace)/[gameSlug]/[categorySlug]/_routeGate'
    )
    const result = await resolveCategoryRoute('wp-admin', 'setup-config.php')
    expect(result).toEqual({ kind: 'not-found' })
    expect(recorder.tables()).toEqual(['games'])
  })

  it('a known game with an unknown slug 404s without touching sellers or offers beyond the slug lookup', async () => {
    recorder = createSupabaseRecorder({
      games: [{ id: 'g1', name: 'Rust', slug: 'rust', image_url: null, ecosystem: null }],
      game_categories: [],
      listings: [],
    })
    const { resolveCategoryRoute } = await import(
      '@/app/(marketplace)/[gameSlug]/[categorySlug]/_routeGate'
    )
    const result = await resolveCategoryRoute('rust', 'foo-bar')
    expect(result).toEqual({ kind: 'not-found' })
    const touched = recorder.tables()
    // The SEO item-slug resolver is allowed ONE scoped listings read (it is
    // how /game/<item-slug> 301s to the listing); nothing seller-shaped.
    expect(touched.filter((t) => t === 'listings').length).toBeLessThanOrEqual(1)
    expect(touched.filter((t) => EXPENSIVE.has(t) && t !== 'listings')).toEqual([])
  })

  it('a real (game, category) pair resolves with the rows the body needs', async () => {
    recorder = createSupabaseRecorder({
      games: [{ id: 'g1', name: 'Roblox', slug: 'roblox', image_url: null, ecosystem: null }],
      game_categories: [{ id: 'c1', name: 'Items', slug: 'buy-items', type: 'items' }],
    })
    const { resolveCategoryRoute } = await import(
      '@/app/(marketplace)/[gameSlug]/[categorySlug]/_routeGate'
    )
    const result = await resolveCategoryRoute('roblox', 'buy-items')
    expect(result).toMatchObject({
      kind: 'category',
      game: { id: 'g1', slug: 'roblox' },
      category: { id: 'c1', slug: 'buy-items', type: 'items' },
    })
    expect(recorder.tables()).toEqual(['games', 'game_categories'])
  })
})
