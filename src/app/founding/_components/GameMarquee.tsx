'use client'

/**
 * Auto-scrolling game strip for the Founding HQ — a gentle, continuous marquee of
 * the real game logos (from the shared GAME_ICONS registry). Deliberately
 * "invisible": no card frame, no borders, no track — just the logos + names
 * gliding across the ivory pane, softened at both edges so they fade in and out
 * rather than getting clipped. The same continuous-slide feel as the website's
 * payment-methods strip, applied to what a founder can sell.
 *
 * Uses embla-carousel with the auto-scroll plugin (already a dependency) for a
 * buttery, seam-free loop. Slows/pauses on hover, and respects
 * prefers-reduced-motion by rendering a static row instead.
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

/**
 * One game chip — frameless. Just the logo on a soft round tile and the name,
 * riding directly on the pane (no border/shadow) so the row reads as one clean
 * gliding band rather than a shelf of cards.
 */
function GameTile({ game }: { game: MarqueeGame }) {
  return (
    <div className="flex shrink-0 select-none items-center gap-2.5 pr-2">
      <span
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[13px] ring-1 ring-black/[0.06]"
        style={{ background: 'linear-gradient(180deg,#FFFFFF 0%,#F1F3EC 100%)' }}
      >
        <Image
          src={getGameIcon(game.slug)}
          alt={game.name}
          width={30}
          height={30}
          className="h-[30px] w-[30px] object-contain"
          draggable={false}
        />
      </span>
      <span
        className="whitespace-nowrap text-[13.5px] font-semibold tracking-tight"
        style={{ color: PALETTE.ink }}
      >
        {game.name}
      </span>
    </div>
  )
}

export default function GameMarquee({ games }: { games: MarqueeGame[] }) {
  const reduced = usePrefersReducedMotion()

  // Always auto-scroll (a founder's list is short — 3+ games — but we still want
  // the continuous left→right glide). We duplicate the list enough times that
  // even 3 games fill the row and loop seamlessly, so it never "snaps".
  const shouldScroll = games.length >= 2 && !reduced

  const [emblaRef] = useEmblaCarousel(
    { loop: true, dragFree: true, align: 'start', containScroll: false },
    shouldScroll ? [AutoScroll({ speed: 0.55, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  )

  // Duplicate the list enough times to guarantee the track is wider than the
  // viewport (embla-auto-scroll needs overflow to loop); 6× covers a 3-game list.
  const items = useMemo(
    () => (games.length ? Array.from({ length: 6 }).flatMap(() => games) : []),
    [games],
  )

  if (!games.length) return null

  if (!shouldScroll) {
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Games you can sell">
        {games.map((g) => (
          <GameTile key={g.slug} game={g} />
        ))}
      </div>
    )
  }

  return (
    <div className="relative" aria-label="Games you can sell">
      {/* Edge fades — the logos glide in/out instead of getting clipped.
          Tuned to the ivory pane wash so the mask is invisible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12"
        style={{ background: 'linear-gradient(90deg,#FAFAF7 0%, rgba(250,250,247,0) 100%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12"
        style={{ background: 'linear-gradient(270deg,#FAFAF7 0%, rgba(250,250,247,0) 100%)' }}
      />
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex items-center gap-6" style={{ touchAction: 'pan-y' }}>
          {items.map((g, i) => (
            <GameTile key={`${g.slug}-${i}`} game={g} />
          ))}
        </div>
      </div>
    </div>
  )
}
