'use client'

import { useState } from 'react'
import { gameCtaSources } from '@/lib/content/game-cta-art'

/**
 * Background art for a guide card: the game's ONE CTA image (`src`, read
 * server-side — the admin upload), then its static art, then nothing (the
 * card's plain surface — never a broken image).
 *
 * The image carries its own normalising filter (CLAUDE.md artwork rule):
 * bright promo art is pulled down to a night value first, and the card's
 * wash on top does the rest.
 */
export function GuideBackdrop({
  gameSlug,
  src,
  position = '50% 30%',
}: {
  gameSlug: string
  src?: string
  position?: string
}) {
  const sources = gameCtaSources(gameSlug, src)
  const [index, setIndex] = useState(0)
  const current = sources[index]
  if (!current) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- per-game art, same as HubCtaBand
    <img
      key={current}
      src={current}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: position, filter: 'brightness(0.4) saturate(0.6)' }}
    />
  )
}
