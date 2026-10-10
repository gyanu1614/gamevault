import { categoryPageVerdict, hasCuratedCurrencyContent, type CategoryPageVerdict } from '@/lib/games/indexability'

/**
 * Which (game, category) pages exist and are worth indexing: the data side of
 * the shared rule in lib/games/indexability.ts. Pure: the loader supplies rows.
 *
 * The inputs are already filtered the way the page's own routing is:
 *  - `games`: active games only (an inactive game 404s);
 *  - `categories`: enabled categories only (a disabled one 404s);
 *  - `listings`: active listings of non-test sellers.
 * The rest of the page's buyable-listing rule (not paused, price above 0, same
 * game AND same category) is applied here, mirroring getCategoryStats.
 */
export interface CategoryIndexInput {
  games: { id: string; slug: string }[]
  categories: { id: string; slug: string; type: string | null; game_id: string }[]
  currencyConfigs: {
    game_id: string
    config: { faq?: unknown[] | null; steps?: unknown[] | null } | null
    updated_at: string | null
  }[]
  listings: {
    updated_at: string | null
    game_id: string
    game_category_id: string
    seller_id: string
    price: number | string | null
  }[]
  pausedSellerIds: ReadonlySet<string>
}

export interface CategoryPageRow {
  gameSlug: string
  categorySlug: string
  buyableCount: number
  hasCuratedContent: boolean
  /** Newest real change behind the page: a buyable listing or the curated config. */
  lastmod: string | null
  verdict: CategoryPageVerdict
}

const newest = (a: string | null, b: string | null | undefined) => (b && (!a || b > a) ? b : a)

export function computeCategoryPages(input: CategoryIndexInput): CategoryPageRow[] {
  const gameById = new Map(input.games.map((g) => [g.id, g]))
  const configByGame = new Map(input.currencyConfigs.map((c) => [c.game_id, c]))

  const stats = new Map<string, { count: number; lastmod: string | null }>()
  for (const l of input.listings) {
    if (input.pausedSellerIds.has(l.seller_id)) continue
    if (!(Number(l.price) > 0)) continue
    const key = `${l.game_id}:${l.game_category_id}`
    const s = stats.get(key) ?? { count: 0, lastmod: null }
    s.count += 1
    s.lastmod = newest(s.lastmod, l.updated_at)
    stats.set(key, s)
  }

  const rows: CategoryPageRow[] = []
  for (const c of input.categories) {
    const game = gameById.get(c.game_id)
    if (!game) continue // inactive game: the page 404s
    const s = stats.get(`${c.game_id}:${c.id}`) ?? { count: 0, lastmod: null }
    const cfg = c.type === 'currency' ? configByGame.get(c.game_id) : undefined
    const hasCuratedContent = hasCuratedCurrencyContent(cfg?.config)
    rows.push({
      gameSlug: game.slug,
      categorySlug: c.slug,
      buyableCount: s.count,
      hasCuratedContent,
      lastmod: newest(s.lastmod, hasCuratedContent ? cfg?.updated_at : null),
      verdict: categoryPageVerdict({
        gameActive: true,
        categoryEnabled: true,
        categoryBelongsToGame: true,
        buyableListingCount: s.count,
        hasCuratedContent,
        isCurrency: c.type === 'currency',
      }),
    })
  }
  return rows.sort((a, b) =>
    a.gameSlug === b.gameSlug ? a.categorySlug.localeCompare(b.categorySlug) : a.gameSlug.localeCompare(b.gameSlug),
  )
}
