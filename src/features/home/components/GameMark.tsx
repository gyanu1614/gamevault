'use client'

/**
 * GameMark — a game's icon as a flattened tile.
 *
 * There is no dedicated mark asset set, so this renders the existing
 * `/games/<slug>.png` icons in a rounded, slightly inset tile. The tile is
 * what does the flattening: it gives every game the same silhouette and
 * edge treatment, so a square Roblox logo and a circular Valorant one read
 * as the same kind of object.
 *
 * Falls back to the game's first letter — never a placeholder glyph, which
 * reads as a broken image rather than a game without art.
 */

import { useState } from 'react'
import Image from 'next/image'
import { getGameIcon } from '../lib/game-icons'

interface GameMarkProps {
  slug: string
  /** Game name — used for the letter fallback. */
  name: string
  size?: number
}

export function GameMark({ slug, name, size = 24 }: GameMarkProps) {
  const [failed, setFailed] = useState(false)
  const icon = getGameIcon(slug)
  // getGameIcon returns a shared placeholder when a game has no icon; treat
  // that as "no art" so it takes the letter path rather than rendering a
  // generic glyph.
  const hasArt = !failed && !icon.includes('game-fallback')

  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center overflow-hidden border border-border-subtle bg-bg-overlay"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
      }}
    >
      {hasArt ? (
        <Image
          src={icon}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-semibold leading-none text-text-secondary"
          style={{ fontSize: Math.round(size * 0.46) }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}
