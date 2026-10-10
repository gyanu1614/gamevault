import { describe, it, expect } from 'vitest'

import { computeCategoryPages, type CategoryIndexInput } from '@/lib/seo/category-index'

const game = (id: string, slug: string, over = {}) => ({ id, slug, ...over })
const cat = (id: string, slug: string, game_id: string, type = 'items') => ({ id, slug, type, game_id })
const listing = (over: Record<string, unknown> = {}) => ({
  slug: 'l', updated_at: '2026-09-30T10:00:00Z', game_id: 'g1', game_category_id: 'c1', seller_id: 's1', price: 5, ...over,
})

function input(over: Partial<CategoryIndexInput> = {}): CategoryIndexInput {
  return {
    games: [game('g1', 'valorant')],
    categories: [cat('c1', 'buy-vp', 'g1', 'currency')],
    currencyConfigs: [],
    listings: [listing()],
    pausedSellerIds: new Set<string>(),
    ...over,
  }
}
const rows = (i: CategoryIndexInput) => computeCategoryPages(i)

describe('computeCategoryPages: the page rule, applied to every enabled category of an active game', () => {
  it('indexes a category that has a buyable listing, with that listing as its lastmod', () => {
    expect(rows(input())).toEqual([
      expect.objectContaining({ gameSlug: 'valorant', categorySlug: 'buy-vp', verdict: 'index', buyableCount: 1, lastmod: '2026-09-30T10:00:00Z' }),
    ])
  })

  it('ignores listings from paused (Offline Mode) sellers: the grid hides them too (/grow-a-garden/buy-items)', () => {
    // An items category: a currency page is indexed regardless (owner 2026-10-10).
    const r = rows(input({ categories: [cat('c1', 'buy-items', 'g1')], pausedSellerIds: new Set(['s1']) }))
    expect(r[0]).toMatchObject({ buyableCount: 0, verdict: 'noindex' })
  })

  it('ignores listings priced at 0', () => {
    expect(rows(input({ categories: [cat('c1', 'buy-items', 'g1')], listings: [listing({ price: 0 })] }))[0]).toMatchObject({ buyableCount: 0, verdict: 'noindex' })
  })

  it('counts only listings of THIS game in THIS category', () => {
    const r = rows(
      input({
        games: [game('g1', 'valorant'), game('g2', 'fortnite')],
        categories: [cat('c1', 'buy-vp', 'g1', 'currency'), cat('c2', 'buy-items', 'g2')],
        // a listing whose category row belongs to another game
        listings: [listing({ game_id: 'g1', game_category_id: 'c2' })],
      }),
    )
    expect(r.find((x) => x.categorySlug === 'buy-items')).toMatchObject({ buyableCount: 0, verdict: 'noindex' })
  })

  it('never emits a category of an inactive game (not in the games list) or a disabled one (not in the categories list)', () => {
    const r = rows(input({ listings: [listing({ game_id: 'gX', game_category_id: 'cX' })] }))
    expect(r.map((x) => `${x.gameSlug}/${x.categorySlug}`)).toEqual(['valorant/buy-vp'])
  })

  it('indexes an empty currency category (always, owner 2026-10-10), dated from curated content when there is some', () => {
    const base = input({ listings: [] })
    expect(rows(base)[0]).toMatchObject({ verdict: 'index', hasCuratedContent: false, lastmod: null })
    const curated = rows({
      ...base,
      currencyConfigs: [{ game_id: 'g1', config: { faq: [{}], steps: [] }, updated_at: '2026-09-20T08:00:00Z' }],
    })
    expect(curated[0]).toMatchObject({ verdict: 'index', hasCuratedContent: true, lastmod: '2026-09-20T08:00:00Z' })
  })

  it('a default config row with empty FAQ and steps is not curated content', () => {
    const r = rows(input({ listings: [], currencyConfigs: [{ game_id: 'g1', config: { faq: [], steps: [] }, updated_at: '2026-09-20T08:00:00Z' }] }))
    // Still indexed (currency always is), but not dated by the default row.
    expect(r[0]).toMatchObject({ verdict: 'index', hasCuratedContent: false, lastmod: null })
  })

  it('curated content applies to currency categories only', () => {
    const r = rows(
      input({
        categories: [cat('c1', 'buy-items', 'g1', 'items')],
        listings: [],
        currencyConfigs: [{ game_id: 'g1', config: { faq: [{}] }, updated_at: '2026-09-20T08:00:00Z' }],
      }),
    )
    expect(r[0]).toMatchObject({ verdict: 'noindex', hasCuratedContent: false })
  })

  it('lastmod is the newest of the listings and the curated config', () => {
    const r = rows(
      input({
        listings: [listing({ updated_at: '2026-09-01T00:00:00Z' }), listing({ slug: 'l2', updated_at: '2026-09-25T00:00:00Z' })],
        currencyConfigs: [{ game_id: 'g1', config: { faq: [{}] }, updated_at: '2026-09-10T00:00:00Z' }],
      }),
    )
    expect(r[0].lastmod).toBe('2026-09-25T00:00:00Z')
  })
})

describe('currency pages in the sitemap (owner 2026-10-10)', () => {
  it('lists an empty currency page, not an empty items page', async () => {
    const { computeCategoryPages } = await import('./category-index')
    const rows = computeCategoryPages({
      games: [{ id: 'g', slug: 'tibia' }],
      categories: [
        { id: 'c1', slug: 'buy-currency', type: 'currency', game_id: 'g' },
        { id: 'c2', slug: 'buy-items', type: 'items', game_id: 'g' },
      ],
      currencyConfigs: [],
      listings: [],
      pausedSellerIds: new Set(),
    })
    expect(rows.find((r) => r.categorySlug === 'buy-currency')?.verdict).toBe('index')
    expect(rows.find((r) => r.categorySlug === 'buy-items')?.verdict).toBe('noindex')
  })
})
