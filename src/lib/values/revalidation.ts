import { unstable_cache } from 'next/cache'

/** Cache tag carried by every render of a game's value pages. */
export function valuesTag(gameSlug: string): string {
  return `values:${gameSlug}`
}

/**
 * Cache tag carried by ONE item's price data.
 *
 * The game-wide tag marks every item page of a game stale on every crawl —
 * ~500 ISR writes per run for SAB, 8 runs a day, whether or not a price moved
 * (the 2026-09-22 build audit put that at ~120,480 of the ~150,000 monthly
 * stale-marks). The publish step now diffs the freshly materialised prices
 * against the previous snapshot and revalidates only the slugs that changed.
 */
export function valueItemPriceTag(gameSlug: string, itemSlug: string): string {
  return `price:${gameSlug}:${itemSlug}`
}

/** Cache tag for a game's price LISTS (the values directory, calculator). */
export function valueGamePriceTag(gameSlug: string): string {
  return `price:${gameSlug}`
}

/**
 * Anchor the current render to ONE item's price tag.
 *
 * Call this from the cached read that fetches the item's prices, so a changed
 * price revalidates that item's page and nothing else. The page shell stays
 * on the long-lived content tag.
 */
export function bindValueItemPriceTag(
  gameSlug: string,
  itemSlug: string,
): Promise<string> {
  return unstable_cache(
    async () => itemSlug,
    ['value-item-price-tag', gameSlug, itemSlug],
    { tags: [valueItemPriceTag(gameSlug, itemSlug), valueGamePriceTag(gameSlug)] },
  )()
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
