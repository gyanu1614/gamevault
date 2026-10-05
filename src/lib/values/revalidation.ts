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
 * stale-marks). Every game's pricing run now diffs the displayed prices
 * against the last published snapshot (src/lib/pricing/publish.ts) and
 * revalidates only the slugs that moved past the threshold.
 */
export function valueItemPriceTag(gameSlug: string, itemSlug: string): string {
  return `price:${gameSlug}:${itemSlug}`
}

/**
 * Cache tag for a game's price LISTS. Reserved: no render binds it today —
 * the lists (values hub, calculator, price-index) are revalidated by PATH.
 * It must NEVER be bound by an item page: until T1 (2026-10-04) the item
 * binding below carried it, so every "changed items" call that also refreshed
 * the lists re-marked ALL ~500 SAB item pages stale.
 */
export function valueGamePriceTag(gameSlug: string): string {
  return `price:${gameSlug}`
}

/**
 * Anchor the current render to ONE item's price tag — and only that tag, so a
 * changed price revalidates that item's page and nothing else. The page shell
 * stays on the long-lived content tag.
 */
export function bindValueItemPriceTag(
  gameSlug: string,
  itemSlug: string,
): Promise<string> {
  return unstable_cache(
    async () => itemSlug,
    // A render is tagged with the tags passed HERE (not those stored with the
    // cached entry), so pages drop the old game-wide tag on their next render.
    ['value-item-price-tag', gameSlug, itemSlug],
    { tags: [valueItemPriceTag(gameSlug, itemSlug)] },
  )()
}

/** Most item slugs one revalidation call may name (the biggest game has ~500). */
export const MAX_CHANGED_SLUGS = 5000

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/

/**
 * `{changedSlugs: string[]}` → the valid, de-duplicated slugs; null when the
 * body has no such array (the caller decides what that means). Anything that
 * is not a page slug is dropped — the slugs become cache tags.
 */
export function parseChangedSlugs(body: unknown): string[] | null {
  const raw = (body as { changedSlugs?: unknown } | null)?.changedSlugs
  if (!Array.isArray(raw)) return null
  const out = new Set<string>()
  for (const slug of raw) {
    if (typeof slug === 'string' && SLUG_RE.test(slug)) out.add(slug)
    if (out.size >= MAX_CHANGED_SLUGS) break
  }
  return [...out]
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
