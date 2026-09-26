'use client'

import { useState } from 'react'

/**
 * Background art for a guide card. Hides itself if the file doesn't exist
 * (per the drop-a-file contract in public/cta-heroes/README.md), so a game
 * without art simply gets the card's plain surface — never a broken image.
 *
 * The image carries its own normalising filter (CLAUDE.md artwork rule):
 * bright promo art is pulled down to a night value first, and the card's
 * wash on top does the rest.
 */
export function GuideBackdrop({ src, position = '50% 30%' }: { src: string; position?: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static per-game art, same as HubCtaBand
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setOk(false)}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: position, filter: 'brightness(0.4) saturate(0.6)' }}
    />
  )
}
