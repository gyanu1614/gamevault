/**
 * Shared end-of-page "buy" CTA for every game content-hub page. Now a thin
 * wrapper over the shared HubCtaBand so buy + sell CTAs render the exact same
 * modal band (per-game bg from public/cta-heroes/{slug}.jpg, left-weighted
 * scrim, button on the right) — one band, no reinventing.
 */

import { HubCtaBand } from './HubCtaBand'

export function HubBuyCta({
  gameName,
  gameSlug,
  buyHref,
  title,
  /** Override the background image (e.g. a blog post's own CTA art). Falls back
      to the shared per-game public/cta-heroes/{slug}.jpg. */
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
  return (
    <HubCtaBand
      gameSlug={gameSlug}
      bgSrc={bgSrc}
      className={className}
      title={title ?? `Skip the grind — buy the ${gameName} item you want`}
      body="Every order is covered by SafeDrop — the seller is paid only after you confirm delivery."
      ctaLabel={`Buy ${gameName} items`}
      ctaHref={buyHref}
    />
  )
}
