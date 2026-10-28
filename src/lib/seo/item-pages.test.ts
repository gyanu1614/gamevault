import { describe, expect, it } from 'vitest'
import type { CategoryPageRow } from './category-index'
import { computeItemPages, type ItemPagesInput } from './item-pages'

const listing = (over: Partial<ItemPagesInput['listings'][number]>): ItemPagesInput['listings'][number] => ({
  updated_at: '2026-10-01T00:00:00Z',
  game_id: 'g1',
  game_category_id: 'c1',
  seller_id: 's1',
  price: 5,
  value_item_slug: 'parrot',
  ...over,
})

const input = (listings: ItemPagesInput['listings']): ItemPagesInput => ({
  games: [{ id: 'g1', slug: 'adopt-me' }],
  categories: [
    { id: 'c1', slug: 'buy-items', game_id: 'g1' },
    { id: 'c2', slug: 'buy-accounts', game_id: 'g1' },
  ],
  listings,
  pausedSellerIds: new Set(['paused']),
})

const page = (categorySlug: string, verdict: CategoryPageRow['verdict']): CategoryPageRow => ({
  gameSlug: 'adopt-me',
  categorySlug,
  buyableCount: 1,
  hasCuratedContent: false,
  lastmod: null,
  verdict,
})
const indexed = [page('buy-items', 'index'), page('buy-accounts', 'noindex')]

describe('computeItemPages', () => {
  it('one page per item from its first buyable listing, newest change as lastmod', () => {
    const rows = computeItemPages(
      input([listing({}), listing({ updated_at: '2026-10-05T00:00:00Z' }), listing({ value_item_slug: 'owl' })]),
      indexed,
    )
    expect(rows).toEqual([
      { gameSlug: 'adopt-me', categorySlug: 'buy-items', itemSlug: 'owl', lastmod: '2026-10-01T00:00:00Z' },
      { gameSlug: 'adopt-me', categorySlug: 'buy-items', itemSlug: 'parrot', lastmod: '2026-10-05T00:00:00Z' },
    ])
  })

  it('skips listings with no item, no price, a paused seller, or under a category that is not indexed', () => {
    const rows = computeItemPages(
      input([
        listing({ value_item_slug: null }),
        listing({ price: 0 }),
        listing({ seller_id: 'paused' }),
        listing({ game_category_id: 'c2' }),
        listing({ game_id: 'gone' }),
      ]),
      indexed,
    )
    expect(rows).toEqual([])
  })
})
