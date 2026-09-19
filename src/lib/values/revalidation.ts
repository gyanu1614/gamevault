import { unstable_cache } from 'next/cache'

/** Cache tag carried by every render of a game's value pages. */
export function valuesTag(gameSlug: string): string {
  return `values:${gameSlug}`
}

/**
 * Anchor the current render to the game's values tag.
 *
 * Item pages are an open set (`/[gameSlug]/values/[itemSlug]`), so the pricing
 * job cannot revalidate them by path: the concrete form
 * `'/<game>/values/[itemSlug]'` matches nothing, and the route-pattern form
 * drops EVERY game's pages on every crawl. A render that consumes a cached
 * value carrying `values:<game>` is tagged with it, so
 * `revalidateTag(valuesTag(game))` marks exactly that game's pages stale.
 *
 * The cached value is the slug itself — a no-op read whose only purpose is
 * the tag. Call it once at the top of the page render (Step 7a).
 */
export function bindValuesTag(gameSlug: string): Promise<string> {
  return unstable_cache(async () => gameSlug, ['values-tag', gameSlug], {
    tags: [valuesTag(gameSlug)],
  })()
}
