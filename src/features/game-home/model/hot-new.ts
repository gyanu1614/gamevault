import type { HotNewCard, ValuesFeed } from '../types'

const DAY = 86_400_000

/** FNV-1a over the slug, seeded by the UTC day: a stable tiebreak all day that changes daily. */
function dayKey(slug: string, day: number): number {
  let h = (0x811c9dc5 ^ day) >>> 0
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * Hot New {Game} {Items} (owner, 2026-10-23): the game's New items, ranked by
 * OUR live offers for each (never another site's counts), then a day-seeded
 * shuffle, so items that tie keep one order all day and a different one the
 * next: the row never sits frozen on the same pets. The popularity feed (next
 * PR) can join the sort key without changing this contract.
 */
export function pickHotNew(feed: ValuesFeed, now: number, limit = 8): HotNewCard[] {
  const day = Math.floor(now / DAY)
  return feed.items
    .filter((i) => i.isNew)
    .map((i) => ({ i, offers: feed.stock[i.slug] ?? 0, k: dayKey(i.slug, day) }))
    .sort((a, b) => b.offers - a.offers || a.k - b.k)
    .slice(0, limit)
    .map(({ i, offers }) => ({
      slug: i.slug,
      name: i.name,
      imageUrl: i.imageUrl,
      valueHref: i.href,
      offers,
      buyHref: offers > 0 ? feed.buyHref[i.slug] ?? null : null,
      fromPrice: offers > 0 ? feed.minPrice[i.slug] ?? null : null,
    }))
}
