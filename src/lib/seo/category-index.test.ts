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
    const r = rows(input({ pausedSellerIds: new Set(['s1']) }))
    expect(r[0]).toMatchObject({ buyableCount: 0, verdict: 'noindex' })
  })

  it('ignores listings priced at 0', () => {
    expect(rows(input({ listings: [listing({ price: 0 })] }))[0]).toMatchObject({ buyableCount: 0, verdict: 'noindex' })
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

  it('indexes an empty currency category only when the game has curated content, and dates it from the config', () => {
    const base = input({ listings: [] })
    expect(rows(base)[0]).toMatchObject({ verdict: 'noindex', hasCuratedContent: false })
    const curated = rows({
      ...base,
      currencyConfigs: [{ game_id: 'g1', config: { faq: [{}], steps: [] }, updated_at: '2026-09-20T08:00:00Z' }],
    })
    expect(curated[0]).toMatchObject({ verdict: 'index', hasCuratedContent: true, lastmod: '2026-09-20T08:00:00Z' })
  })

  it('a default config row with empty FAQ and steps is not curated content', () => {
    const r = rows(input({ listings: [], currencyConfigs: [{ game_id: 'g1', config: { faq: [], steps: [] }, updated_at: '2026-09-20T08:00:00Z' }] }))
    expect(r[0]).toMatchObject({ verdict: 'noindex', hasCuratedContent: false })
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
