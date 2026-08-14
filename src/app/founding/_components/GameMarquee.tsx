'use client'

/**
 * Auto-scrolling game strip for the Founding HQ. A gentle, continuous marquee of
 * the real game logos (from the shared GAME_ICONS registry) — the color and life
 * against the calm ivory pane, and a concrete answer to "what can I sell here".
 *
 * Uses embla-carousel with the autoplay plugin (already a dependency). Loops
 * seamlessly, slows on hover, and respects prefers-reduced-motion by rendering a
 * static row instead.
 */

import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useMemo } from 'react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import { getGameIcon } from '@/features/home/lib/game-icons'

export interface MarqueeGame {
  slug: string
  name: string
}

function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** One game chip — a legible logo on a soft tinted tile + the name. */
function GameTile({ game }: { game: MarqueeGame }) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 rounded-xl bg-white py-2.5 pl-2.5 pr-4"
      style={{ border: `1px solid ${PALETTE.line}`, boxShadow: '0 1px 2px rgba(20,67,42,0.04)' }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/[0.07]"
        style={{ background: 'linear-gradient(180deg,#F6F7F1 0%,#EEF0E8 100%)' }}
      >
        <Image
          src={getGameIcon(game.slug)}
          alt={game.name}
          width={34}
          height={34}
          className="h-[34px] w-[34px] object-contain"
        />
      </span>
      <span className="whitespace-nowrap text-[13.5px] font-semibold" style={{ color: PALETTE.ink }}>
        {game.name}
      </span>
    </div>
  )
}

export default function GameMarquee({ games }: { games: MarqueeGame[] }) {
  const reduced = usePrefersReducedMotion()

  // A marquee only reads well with enough items to fill the row and loop; with a
  // handful it looks broken. Auto-scroll only past this count, else a clean row.
  const shouldScroll = games.length > 4 && !reduced

  const [emblaRef] = useEmblaCarousel(
    { loop: true, dragFree: true, align: 'start', containScroll: false },
    shouldScroll ? [AutoScroll({ speed: 0.6, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  )

  // Duplicate the list so the loop always has enough width to scroll smoothly.
  const items = useMemo(() => (games.length ? [...games, ...games] : []), [games])

  if (!games.length) return null

  if (!shouldScroll) {
    return (
      <div className="flex flex-wrap gap-3" aria-label="Games you can sell">
        {games.map((g) => (
          <GameTile key={g.slug} game={g} />
        ))}
      </div>
    )
  }

  return (
    <div ref={emblaRef} className="overflow-hidden" aria-label="Games you can sell">
      <div className="flex gap-3" style={{ touchAction: 'pan-y' }}>
        {items.map((g, i) => (
          <GameTile key={`${g.slug}-${i}`} game={g} />
        ))}
      </div>
    </div>
  )
}
