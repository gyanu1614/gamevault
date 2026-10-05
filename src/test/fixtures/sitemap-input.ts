import type { SitemapInput } from '@/lib/seo/sitemap-builder'

/**
 * A sitemap input that covers every entry type (home, legal, blog, game blog,
 * landing, content hubs and items, game hub, sell, category, listing) plus the
 * shapes that must NOT be listed (a disabled category, paused and free
 * listings). Dates are fixed in the past. Shared by the builder tests and the
 * sitemap-vs-robots guard.
 */
export const SITEMAP_BASE = 'https://dropmarket.gg'

export function sitemapFixture(over: Partial<SitemapInput> = {}): SitemapInput {
  return {
    baseUrl: SITEMAP_BASE,
    games: [
      { id: 'g1', slug: 'valorant', content_tier: 'listed', updated_at: '2026-09-02T00:00:00Z', seo_indexable: null },
      { id: 'g2', slug: 'fortnite', content_tier: 'listed', updated_at: '2026-09-03T00:00:00Z', seo_indexable: null },
      { id: 'g3', slug: 'steal-a-brainrot', content_tier: 'data', updated_at: '2026-09-04T00:00:00Z', seo_indexable: null },
      { id: 'g4', slug: 'adopt-me', content_tier: 'data', updated_at: '2026-09-05T00:00:00Z', seo_indexable: null },
      { id: 'g5', slug: 'steal-an-egg', content_tier: 'data', updated_at: '2026-09-06T00:00:00Z', seo_indexable: null },
      { id: 'g6', slug: 'gta-vi', content_tier: 'listed', updated_at: '2026-09-07T00:00:00Z', seo_indexable: null },
    ],
    categories: [
      { id: 'c1', slug: 'buy-vp', type: 'currency', game_id: 'g1' },
      { id: 'c2', slug: 'buy-items', type: 'items', game_id: 'g1' },
      { id: 'c3', slug: 'buy-accounts', type: 'account', game_id: 'g2' },
      { id: 'c4', slug: 'buy-items', type: 'items', game_id: 'g3' },
      // gta-vi has no enabled category: its only category row is disabled, so it is not loaded.
    ],
    currencyConfigs: [{ game_id: 'g1', config: { faq: [{ q: 'x' }], steps: [] }, updated_at: '2026-09-20T00:00:00Z' }],
    listings: [
      { slug: 'vp-1000', updated_at: '2026-09-28T09:00:00Z', game_id: 'g1', game_category_id: 'c1', seller_id: 'sA', price: 9.99 },
      { slug: 'vp-paused', updated_at: '2026-09-29T09:00:00Z', game_id: 'g1', game_category_id: 'c1', seller_id: 'sPaused', price: 5 },
      { slug: 'free-item', updated_at: '2026-09-27T09:00:00Z', game_id: 'g1', game_category_id: 'c2', seller_id: 'sA', price: 0 },
      { slug: 'sab-item', updated_at: '2026-09-26T09:00:00Z', game_id: 'g3', game_category_id: 'c4', seller_id: 'sA', price: 3 },
      // gta-vi: an active listing whose category is not an enabled category of that game
      { slug: 'gta-cash', updated_at: '2026-09-25T09:00:00Z', game_id: 'g6', game_category_id: 'cDisabled', seller_id: 'sA', price: 4 },
    ],
    pausedSellerIds: new Set(['sPaused']),
    sabBrainrots: [
      { slug: 'cavallo-virtuoso', updated_at: '2026-09-30T00:00:00Z' },
      { slug: 'tralalero', updated_at: '2026-09-18T00:00:00Z' },
    ],
    adoptMePets: [
      { slug: 'bat-dragon', updated_at: '2026-09-15T00:00:00Z' },
      { slug: 'shadow-dragon', updated_at: '2026-09-12T00:00:00Z' },
    ],
    pipelineItems: [
      { gameSlug: 'steal-an-egg', slug: 'golden-egg', priceChangedAt: '2026-09-22T00:00:00Z', sampleSize: 5 },
      { gameSlug: 'steal-an-egg', slug: 'thin-egg', priceChangedAt: '2026-09-23T00:00:00Z', sampleSize: 2 },
      { gameSlug: 'murder-mystery-2', slug: 'harvester', rarity: 'Ancient', priceChangedAt: '2026-09-24T00:00:00Z', sampleSize: 63 },
    ],
    gamePosts: [
      { slug: 'vp-guide', primary_game_slug: 'valorant', updated_at: '2026-09-10T00:00:00Z' },
      { slug: 'vp-tips', primary_game_slug: 'valorant', updated_at: '2026-09-14T00:00:00Z' },
    ],
    posts: [{ publishedAt: '2026-08-01' }, { publishedAt: '2026-08-20' }],
    flatPosts: [{ slug: 'how-we-work', publishedAt: '2026-08-20' }],
    landingSlugs: ['buy-fortnite-accounts'],
    ...over,
  }
}

