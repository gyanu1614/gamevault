'use client'

import { HubCtaBand } from '@/components/content/HubCtaBand'
import { HUB_COPY } from '@/lib/content/theme'

/**
 * The game's CTA banner as visitors see it: the real HubCtaBand (buy copy)
 * with this image behind it. Shown under the upload field and live in the
 * banner editor. The button goes nowhere here.
 */
export function CtaBandPreview({ gameSlug, gameName, src }: { gameSlug: string; gameName: string; src: string | null }) {
  const game = gameName.trim() || 'this game'
  return (
    <div aria-label="Banner preview" className="pointer-events-none select-none">
      <HubCtaBand
        gameSlug={gameSlug || 'preview'}
        bgSrc={src ?? undefined}
        className="w-full"
        title={`Skip the grind — buy the ${game} item you want`}
        body={HUB_COPY.safedrop}
        ctaLabel={`Buy ${game} items`}
        ctaHref="#"
      />
    </div>
  )
}
