/**
 * Shared end-of-page "buy" CTA for every game content-hub page. Now a thin
 * wrapper over the shared HubCtaBand so buy + sell CTAs render the exact same
 * modal band (the game's ONE CTA image — admin upload, then static art —
 * left-weighted scrim, button on the right) — one band, no reinventing.
 *
 * Async SERVER component: it reads the game's admin CTA banner through the
 * cached, cookie-free `getGameCtaImage`, so every caller gets it without
 * threading a prop and the page stays static.
 */

import { HubCtaBand } from './HubCtaBand'
import { HUB_COPY } from '@/lib/content/theme'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'

export async function HubBuyCta({
  gameName,
  gameSlug,
  buyHref,
  title,
  /** Override the background image (e.g. a blog post's own CTA art). Defaults
      to the game's ONE CTA image (`getGameCtaImage`). */
  bgSrc,
  /** Override the section wrapper (e.g. to match a narrower content column). */
  className,
}: {
  gameName: string
  gameSlug: string
  buyHref: string
  title?: string
  bgSrc?: string
  className?: string
}) {
  const bg = bgSrc ?? (await getGameCtaImage(gameSlug))
  return (
    <HubCtaBand
      gameSlug={gameSlug}
      bgSrc={bg}
      className={className}
      title={title ?? `Skip the grind — buy the ${gameName} item you want`}
      body={HUB_COPY.safedrop}
      ctaLabel={`Buy ${gameName} items`}
      ctaHref={buyHref}
    />
  )
}
