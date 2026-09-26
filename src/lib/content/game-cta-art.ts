/**
 * Which background art a game's promo surfaces use.
 *
 * Contract (see public/cta-heroes/README.md): drop `{gameSlug}.jpg` into
 * public/cta-heroes and it appears — no config. A game can also ship its own
 * seller art in public/seller-cta/{gameSlug}.png; list it below. If the file
 * doesn't exist, the component showing it hides the image on load error and
 * falls back to its plain surface.
 *
 * Used by the hub seller band (_SabSellerCta) and the category-page guide's
 * "Why Buy" card, so both always show the same art for a game.
 */

/** Games with dedicated seller-band art in public/seller-cta/. */
const GAMES_WITH_SELLER_ART = new Set(['steal-a-brainrot'])

export function gameCtaArt(gameSlug: string): string {
  return GAMES_WITH_SELLER_ART.has(gameSlug)
    ? `/seller-cta/${gameSlug}.png`
    : `/cta-heroes/${gameSlug}.jpg`
}
