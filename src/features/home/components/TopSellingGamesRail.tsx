'use client'

/**
 * TopSellingGamesRail — a scrolling row of game cards.
 *
 * There is no public sales metric yet, so the row shows the games with the
 * most live stock (getPopularGames' own ranking), as the same card the
 * Popular Games grid uses. Swap the source for real sales counts once
 * those exist; the rail itself does not care.
 *
 * Matches the listing rail: same Embla setup, same wheel plugin.
 */

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { PopularGameCard } from './PopularGameCard'
import type { PopularGameCard as GameCardData } from '../lib/popular-games'

const FADE = '56px'

export function TopSellingGamesRail({ games }: { games: GameCardData[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: 'start', containScroll: 'trimSnaps', dragFree: true },
    [WheelGesturesPlugin()],
  )
  const [canNext, setCanNext] = useState(false)

  const onSelect = useCallback(() => {
    if (emblaApi) setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect).on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  const mask = canNext
    ? `linear-gradient(to right, #000 calc(100% - ${FADE}), transparent 100%)`
    : undefined

  return (
    <div
      ref={emblaRef}
      className="relative mt-6 overflow-hidden sm:mt-8"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <div className="-ml-3 flex touch-pan-y sm:-ml-4">
        {games.map((game) => (
          <div
            key={game.slug}
            // Phone: three-ish game cards in view, same size as the grid's.
            className="min-w-0 shrink-0 grow-0 basis-[31%] pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
          >
            <PopularGameCard game={game} />
          </div>
        ))}
      </div>
    </div>
  )
}
