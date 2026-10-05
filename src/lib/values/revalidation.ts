import { unstable_cache } from 'next/cache'

/**
 * Values hub cache tags — and THE rule for reading values data (2026-10-05).
 *
 * The publish step (/api/internal/values-revalidate) refreshes pages with
 * `revalidateTag`. A tag only refreshes DATA that was cached under it: on
 * Next 14 every un-annotated server fetch on a static route is stored in the
 * Data Cache with the page's window and no tags, so a re-render triggered by
 * a tag was served the old query responses (Adopt Me pet pages kept a fixed
 * price for days after `values-revalidate?full=1`).
 *
 * The pattern — one, everywhere: every values-hub data read goes through
 * `createValueItemReadClient` / `createValueListReadClient`
 * (src/lib/values/read-client.ts), the tagged anon client. Each query response
 * is cached under the read's tag set, and the render is tagged with it too:
 *
 *   • ITEM pages (`/<game>/values/<item>`) — every read, including the
 *     similar/related rails: valueItemReadTags(game, item)
 *       = [price:<game>:<item>, values:<game>]
 *     Never the game price tag: an item page carrying it is rebuilt with
 *     every list refresh (the pre-T1 ~500 ISR writes per run).
 *   • LIST pages (values hub, calculator, neon calculator, price index,
 *     methodology counts, blog hub, SAB landing carousel):
 *     valueListReadTags(game) = [price:<game>, values:<game>]
 *
 * The publish step revalidates exactly those tags: each moved item's
 * `price:<game>:<item>` plus `price:<game>` for the lists; `?full=1` revalidates
 * `values:<game>`, which every read carries.
 *
 * `createAnonClient()` stays for NON-values reads (games, blog posts,
 * categories) and inside `unstable_cache` callbacks (Next 14 runs those
 * no-store; the entry itself carries the tags — value-listings/stock-server).
 * src/test/guards/values-data-tags.guard.test.ts pins this.
 */

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
 * Cache tag for a game's price LISTS — carried by every list-page read
 * (valueListReadTags), revalidated whenever any item of the game moved.
 * It must NEVER be bound by an item page: until T1 (2026-10-04) the item
 * binding below carried it, so every "changed items" call that also refreshed
 * the lists re-marked ALL ~500 SAB item pages stale.
 */
export function valueGamePriceTag(gameSlug: string): string {
  return `price:${gameSlug}`
}

/** Tags of every data read on ONE item's value page (see the header). */
export function valueItemReadTags(gameSlug: string, itemSlug: string): string[] {
  return [valueItemPriceTag(gameSlug, itemSlug), valuesTag(gameSlug)]
}

/** Tags of every data read on a game's list pages (see the header). */
export function valueListReadTags(gameSlug: string): string[] {
  return [valueGamePriceTag(gameSlug), valuesTag(gameSlug)]
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
