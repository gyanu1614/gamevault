/**
 * Step 7a — every public read on the category page path is cookie-free.
 *
 * The route was rendering per request because four helpers reached
 * `@/lib/supabase/server` (one of them imported it AS `createAnonClient`).
 * One `cookies()` call anywhere in the graph makes the whole route dynamic,
 * so this is the invariant the ISR conversion stands on.
 *
 * The cookie client is mocked to THROW; each helper must complete against the
 * anon client alone.
 */
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseRecorder } from '../fakes/supabase-recorder'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used on a public read')
  },
}))

const recorder = createSupabaseRecorder({
  games: [{ id: 'g1', name: 'Roblox', slug: 'roblox' }],
  game_categories: [{ id: 'c1', slug: 'buy-robux', name: 'Robux', type: 'currency', game: { slug: 'roblox' } }],
  category_configs: [],
  listings: [],
  profiles: [],
  seller_presence: [],
})
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))

describe('category page helpers read through the anon client', () => {
  it('getCategoryStats', async () => {
    const { getCategoryStats } = await import('@/lib/seo/page-stats')
    await expect(getCategoryStats('g1', 'c1')).resolves.toMatchObject({ count: 0 })
  })

  it('getTestSellerIds', async () => {
    const { getTestSellerIds } = await import('@/lib/seo/public-hygiene')
    await expect(getTestSellerIds()).resolves.toEqual([])
    expect(recorder.tables()).toContain('profiles')
  })

  it('getPausedSellerIds', async () => {
    const { getPausedSellerIds } = await import('@/lib/actions/seller-presence')
    await expect(getPausedSellerIds()).resolves.toEqual([])
    expect(recorder.tables()).toContain('seller_presence')
  })

  it('fetchCategoryConfigBySlug', async () => {
    const { fetchCategoryConfigBySlug } = await import('@/lib/actions/admin-category-configs')
    await expect(fetchCategoryConfigBySlug('roblox', 'currency')).resolves.toBeNull()
    expect(recorder.tables()).toContain('category_configs')
  })

  it('resolveItemBySlug', async () => {
    const { resolveItemBySlug } = await import(
      '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemResolver'
    )
    await expect(resolveItemBySlug('g1', 'some-item')).resolves.toBeNull()
  })

  it('getCurrencyShell', async () => {
    const { getCurrencyShell } = await import(
      '@/app/(marketplace)/[gameSlug]/[categorySlug]/_currencyData'
    )
    const shell = await getCurrencyShell('roblox', 'buy-robux')
    expect(shell?.currency.name).toBeTruthy()
  })
})
