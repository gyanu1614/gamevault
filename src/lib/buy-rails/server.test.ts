import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { blog: true, value_item: true, value_list: true, calculator: false }, error: null }) }) }) }),
  }),
}))
const stock = vi.fn()
vi.mock('@/lib/value-listings/stock-server', () => ({ getValueStock: (...a: unknown[]) => stock(...a), getValueItemListings: async () => null }))
vi.mock('@/lib/seo/page-stats', () => ({ getCategoryStats: async () => ({ count: 0, lowPrice: null }) }))
vi.mock('@/lib/seo/hidden-sellers', () => ({ getHiddenSellerIds: async () => [] }))
vi.mock('@/lib/content/game-cta-art.server', () => ({ getGameCtaImage: async () => '/x.jpg' }))
vi.mock('@/lib/currency-guides/server', () => ({ getLivePages: async () => [] }))

describe('calculator switch', () => {
  it('off → no buy box data and no stock read', async () => {
    const { getCalcBuyData } = await import('./server')
    expect(await getCalcBuyData('adopt-me')).toBeNull()
    expect(stock).not.toHaveBeenCalled()
  })
})
