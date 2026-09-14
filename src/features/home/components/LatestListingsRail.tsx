'use client'

/**
 * LatestListingsRail — the horizontally scrolling rail of live listings.
 *
 * No game filter: the rail is already mixed round-robin across every game
 * with stock (see getLatestListings), so a filter would be hiding variety
 * rather than revealing it.
 *
 * Embla drives the scroll (already a dependency, used elsewhere here) for
 * real drag physics on touch and trackpad. The right edge fades only while
 * there is more to scroll to.
 */

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { ListingCard } from './ListingCard'
import type { LatestListing } from '../lib/latest-listings'

const FADE = '56px'

export function LatestListingsRail({ listings }: { listings: LatestListing[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      containScroll: 'trimSnaps',
      // dragFree: a trackpad wheel arrives as many small deltas, and snapping
      // after each one is what made the rail feel stuck. Free scrolling with
      // momentum reads smooth; the rail is a browse strip, not a slideshow,
      // so nothing needs to land on a snap point.
      dragFree: true,
    },
    // Embla handles pointer drag but ignores wheel events, so a two-finger
    // trackpad swipe did nothing. This is Embla's own companion plugin. No
    // forceWheelAxis: left at its default it reads the gesture's dominant
    // axis, so a horizontal swipe moves the rail and a vertical one still
    // scrolls the page rather than being captured here.
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
      // `relative` lifts the rail above the section's ::before grid backdrop.
      className="relative mt-5 overflow-hidden"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <div className="-ml-3 flex touch-pan-y sm:-ml-4">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="min-w-0 shrink-0 grow-0 basis-1/2 pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
          >
            <ListingCard listing={listing} />
          </div>
        ))}
      </div>
    </div>
  )
}
