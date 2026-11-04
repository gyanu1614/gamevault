import type { CategoryPageRow } from './category-index'

export interface ItemPagesInput {
  games: { id: string; slug: string }[]
  categories: { id: string; slug: string; game_id: string }[]
  listings: {
    updated_at: string | null
    game_id: string
    game_category_id: string
    seller_id: string
    price: number | string | null
    value_item_slug?: string | null
  }[]
  pausedSellerIds: ReadonlySet<string>
}

export interface ItemPageEntry {
  gameSlug: string
  categorySlug: string
  itemSlug: string
  lastmod: string | null
}

const newest = (a: string | null, b: string | null) => (b && (!a || b > a) ? b : a)

/**
 * Pet pages for the sitemap (owner, 2026-10-27): the item page is indexable
 * from its first live listing (ITEM_PAGE_MIN_LISTINGS), so it is listed with
 * the same count the page uses — a buyable listing of a seller who isn't
 * paused — and only under a category page that is itself indexed.
 */
export function computeItemPages(input: ItemPagesInput, categoryPages: readonly CategoryPageRow[]): ItemPageEntry[] {
  const gameSlug = new Map(input.games.map((g) => [g.id, g.slug]))
  const categorySlug = new Map(input.categories.map((c) => [c.id, c.slug]))
  const indexed = new Set(categoryPages.filter((r) => r.verdict === 'index').map((r) => `${r.gameSlug}/${r.categorySlug}`))

  const pages = new Map<string, ItemPageEntry>()
  for (const l of input.listings) {
    if (!l.value_item_slug) continue
    if (input.pausedSellerIds.has(l.seller_id)) continue
    if (!(Number(l.price) > 0)) continue
    const game = gameSlug.get(l.game_id)
    const category = categorySlug.get(l.game_category_id)
    if (!game || !category || !indexed.has(`${game}/${category}`)) continue
    const key = `${game}/${category}/${l.value_item_slug}`
    const page = pages.get(key) ?? { gameSlug: game, categorySlug: category, itemSlug: l.value_item_slug, lastmod: null }
    page.lastmod = newest(page.lastmod, l.updated_at)
    pages.set(key, page)
  }
  return [...pages.values()].sort((a, b) => (a.gameSlug + a.categorySlug + a.itemSlug).localeCompare(b.gameSlug + b.categorySlug + b.itemSlug))
}
