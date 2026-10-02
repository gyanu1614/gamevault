import { createAnonClient } from '@/lib/supabase/anon'
import { loadCoreRows } from '@/lib/seo/category-data'
import { computeCategoryPages } from '@/lib/seo/category-index'

export interface CategoryPair {
  gameSlug: string
  categorySlug: string
}

/**
 * The (game, category) pairs the sitemap advertises: the prerender set for
 * `/[gameSlug]/[categorySlug]/opengraph-image` (Step 7a).
 *
 * The SAME rule as src/app/sitemap.ts (lib/seo/category-index.ts +
 * lib/games/indexability.ts): an enabled category of an active game with a
 * buyable listing (active, non-test seller, not paused, price above 0) or
 * curated currency content. Cookie-free: this runs in generateStaticParams at
 * build time, where there is no request.
 *
 * Any read failure yields [] — the long tail renders on demand into the same
 * ISR cache, so a bad build-time read costs first-hit renders, not pages.
 */
export async function getIndexableCategoryPairs(): Promise<CategoryPair[]> {
  try {
    const rows = computeCategoryPages(await loadCoreRows(createAnonClient()))
    return rows
      .filter((r) => r.verdict === 'index')
      .map(({ gameSlug, categorySlug }) => ({ gameSlug, categorySlug }))
  } catch {
    return []
  }
}

/**
 * EVERY enabled (active game, enabled category) pair — the prerender set for
 * `/[gameSlug]/[categorySlug]` from Step 7b on. With ~12 deploys a day, any
 * pair not built at deploy re-renders on its first visit after each one; the
 * sitemap's subset (above) stays the rule for indexability and OG images.
 * One read; [] on failure so the long tail simply renders on demand.
 */
export async function getAllEnabledCategoryPairs(): Promise<CategoryPair[]> {
  try {
    const supabase = createAnonClient()
    const { data } = (await supabase
      .from('game_categories')
      .select('slug, game:games!game_categories_game_id_fkey(slug, is_active)')
      .eq('is_enabled', true)) as unknown as {
      data: { slug: string; game: { slug: string; is_active: boolean } | null }[] | null
    }
    return (data ?? [])
      .filter((c) => c.game?.slug && c.game.is_active)
      .map((c) => ({ gameSlug: c.game!.slug, categorySlug: c.slug }))
      .sort((a, b) =>
        a.gameSlug === b.gameSlug
          ? a.categorySlug.localeCompare(b.categorySlug)
          : a.gameSlug.localeCompare(b.gameSlug),
      )
  } catch {
    return []
  }
}
