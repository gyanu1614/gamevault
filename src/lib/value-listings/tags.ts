/**
 * Cache tags for DropMarket's own stock on the value pages (Bundle 2, T1).
 *
 * Dependency-free on purpose: lib/revalidation/listings.ts (the listing
 * mutation seam) imports these, and stock-server.ts imports that seam's
 * category tag — keeping the names here avoids the cycle.
 */

/** Every per-GAME stock read (item listings pages, calculator). Nightly reconcile. */
export function valueStockTag(gameSlug: string): string {
  return `value-stock:${gameSlug}`
}

/**
 * ONE item's stock — the buy button and "Available Now" on that item's value
 * page. A listing mutation revalidates the tag of the item the listing is
 * linked to (`listings.value_item_slug`), so a new or edited listing rebuilds
 * that page only, not every item page of the game.
 */
export function valueItemStockTag(gameSlug: string, itemSlug: string): string {
  return `value-stock:${gameSlug}:${itemSlug}`
}
