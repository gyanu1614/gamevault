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
}: {
  gameName: string
  gameSlug: string
  buyHref: string
  title?: string
}) {
  return (
    <HubCtaBand
      gameSlug={gameSlug}
      title={title ?? `Skip the grind — buy the ${gameName} item you want`}
      body="Every order is covered by SafeDrop — the seller is paid only after you confirm delivery."
      ctaLabel={`Buy ${gameName} items`}
      ctaHref={buyHref}
    />
  )
}
