/**
 * Which background art a game's CTA bands use — ONE image per game, everywhere
 * (values / calculator / item / blog buy + sell bands, the /sell page bands and
 * the category-page guide card).
 *
 * Order (owner, 2026-10-04):
 *   1. The admin upload — games.blog_cta_image_url ("Blog CTA Banner" in the
 *      admin game wizard). Read server-side by `getGameCtaImage`
 *      (game-cta-art.server.ts) and passed to the client band as a prop.
 *   2. The static drop-a-file art (see public/cta-heroes/README.md):
 *      public/seller-cta/{slug}.png for games listed below, else
 *      public/cta-heroes/{slug}.jpg.
 *   3. Nothing loads → the band shows its plain scrim (the components walk
 *      `gameCtaSources` on image error).
 *
 * Plain module: safe for server and client components.
 */

/** Games whose static art lives in public/seller-cta/{slug}.png. */
const GAMES_WITH_SELLER_ART = new Set(['steal-a-brainrot'])

/** The static (repo) art path for a game — the fallback behind the admin upload. */
export function gameCtaFallback(gameSlug: string): string {
  return GAMES_WITH_SELLER_ART.has(gameSlug)
    ? `/seller-cta/${gameSlug}.png`
    : `/cta-heroes/${gameSlug}.jpg`
}

/** The ONE CTA image for a game: admin upload first, static art otherwise. */
export function gameCtaImage(game: { slug: string; ctaImageUrl?: string | null }): string {
  const admin = game.ctaImageUrl?.trim()
  return admin ? admin : gameCtaFallback(game.slug)
}

/**
 * Ordered image candidates for a band: the chosen image, then the static art
 * when the chosen one is something else. A component shows the first that
 * loads and drops to its plain surface when none do.
 */
export function gameCtaSources(gameSlug: string, src?: string | null): string[] {
  const fallback = gameCtaFallback(gameSlug)
  const first = src?.trim()
  return first && first !== fallback ? [first, fallback] : [fallback]
}
