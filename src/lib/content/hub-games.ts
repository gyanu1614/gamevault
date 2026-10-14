/**
 * Which games have a content hub (blog home + guides) — an admin switch per
 * game, games.content_hub_enabled (Admin → Games → "Guides & content"). The
 * hub nav's game picker lists only these (owner, 2026-10-13: the picker
 * showed ~235 games, most leading to empty pages). Pure, for the nav and tests.
 */
export interface HubGameFlag {
  slug: string
  content_hub_enabled?: boolean | null
}

export function contentHubSlugs(games: readonly HubGameFlag[]): string[] {
  return games.filter((g) => g.content_hub_enabled).map((g) => g.slug)
}

/** The picker's games: every switched-on game, and the one you are on (so it never vanishes from its own nav). */
export function pickerGames<T extends HubGameFlag>(games: readonly T[], currentSlug: string): T[] {
  return games.filter((g) => g.content_hub_enabled || g.slug === currentSlug)
}

export interface CodesMenuGame {
  slug: string
  name: string
  imageUrl: string | null
  href: string
}

/**
 * The hub nav's Codes menu (Blog v2): switched-on games that have a codes page
 * — their own custom one (MM2, theme `codes`) or a published codes post —
 * each linking to /{game}/codes. Order follows `games` (the picker's order).
 */
export function codesMenuGames<T extends HubGameFlag & { name: string; image_url?: string | null }>(
  games: readonly T[],
  customCodesSlugs: readonly string[],
  codesPostSlugs: readonly string[],
): CodesMenuGame[] {
  const has = new Set([...customCodesSlugs, ...codesPostSlugs])
  return games
    .filter((g) => g.content_hub_enabled && has.has(g.slug))
    .map((g) => ({ slug: g.slug, name: g.name, imageUrl: g.image_url ?? null, href: `/${g.slug}/codes` }))
}
