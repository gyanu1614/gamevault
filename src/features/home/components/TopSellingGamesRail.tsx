'use client'

/**
 * TopSellingGamesRail — placeholder row for currency cards.
 *
 * Layout only. The cards are deliberately empty: currency listings have no
 * per-currency artwork anywhere in the repo or the database (they all fall
 * back to the game icon), so filling these with real data would just be
 * twelve game logos with prices under them. The shell is here so the row's
 * geometry can be judged and so the section has the height its grid backdrop
 * needs.
 *
 * Matches the listing rail: same Embla setup, same wheel plugin, same card
 * geometry and the same recessed well treatment.
 */

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'

const FADE = '56px'
const PLACEHOLDER_COUNT = 10

export function TopSellingGamesRail() {
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
        {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
          <div
            key={i}
            className="min-w-0 shrink-0 grow-0 basis-1/2 pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
          >
            <div
              aria-hidden
              className="relative aspect-[1/1.1] overflow-hidden border border-border-subtle"
              style={{
                borderRadius: 'var(--radius-lg)',
                // Same recess as the listing cards — see ListingCard.
                backgroundColor: 'var(--color-bg-well, #181D25)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.30)',
              }}
            >
              <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ background: 'rgba(255,255,255,0.045)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
