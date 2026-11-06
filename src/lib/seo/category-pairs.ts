import { createAnonClient } from '@/lib/supabase/anon'
import { loadCoreRows } from '@/lib/seo/category-data'
import { computeCategoryPages } from '@/lib/seo/category-index'
import { rethrowFailedRead } from '@/lib/supabase/failed-read'

export interface CategoryPair {
  gameSlug: string
  categorySlug: string
}

/**
 * The (game, category) pairs the sitemap advertises: the prerender set for
 * `/[gameSlug]/[categorySlug]` and its opengraph-image. Any other enabled pair
 * renders on its first visit into the same ISR cache. Builds don't read the Data
 * Cache, so a release's reads follow how many pages it builds (2026-11-05).
 *
 * The SAME rule as src/app/sitemap.ts (lib/seo/category-index.ts +
 * lib/games/indexability.ts): an enabled category of an active game with a
 * buyable listing (active, non-test seller, not paused, price above 0) or
 * curated currency content. Cookie-free: this runs in generateStaticParams at
 * build time, where there is no request.
 *
 * A failed read stops the build, which leaves the live site as it is.
 */
export async function getIndexableCategoryPairs(): Promise<CategoryPair[]> {
  try {
    const rows = computeCategoryPages(await loadCoreRows(createAnonClient()))
    return rows
      .filter((r) => r.verdict === 'index')
      .map(({ gameSlug, categorySlug }) => ({ gameSlug, categorySlug }))
  } catch (e) {
    rethrowFailedRead(e)
    return []
  }
}

/**
 * Narrow `game/category` keys to the pairs `/[gameSlug]/[categorySlug]` can
 * actually serve (`renderable`). The sitemap
 * builds its pairs from active LISTINGS, so a listing left under a category an
 * admin switched off (is_enabled = false) put a URL in the sitemap that the page
 * gate answers with a 404 — found live as /gta-vi/buy-items.
 *
 * Since the sitemap rewrite (lib/seo/sitemap-builder.ts + category-index.ts) the
 * sitemap applies this rule itself: it only emits categories that are ENABLED
 * categories of ACTIVE games and that belong to the listing's game, so it no
 * longer calls this helper. It stays exported, with its tests, for other callers.
 *
 * Input order is kept.
 */
export function onlyRenderablePairs(
  pairKeys: Iterable<string>,
  renderable: readonly CategoryPair[],
): string[] {
  const keys = [...pairKeys]
  if (renderable.length === 0) return keys
  const servable = new Set(renderable.map((p) => `${p.gameSlug}/${p.categorySlug}`))
  return keys.filter((key) => servable.has(key))
}
