'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from '@/components/navigation/AppLink'
import useEmblaCarousel from 'embla-carousel-react'
import { useReducedMotion } from 'framer-motion'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { useAuth } from '@/hooks/use-auth'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { trackValueEvent } from '@/lib/value-listings/track'
import { ValueOfferCell, ValueOfferGrid, bestDealId } from './ValueOfferGrid'
import { TrackOnMount } from './TrackOnMount'

/**
 * "Available Now" on a value item page (Bundle 2, task C): DropMarket's own
 * live listings for this item, cheapest first, using the marketplace's
 * listing card. One or two offers sit in a static grid; more become an Embla
 * carousel of up to ten (two per view on desktop, 1.1 on phones, arrows +
 * swipe). With none, the state-3 actions instead. Also records the value page
 * view for the funnel. Used by every value item page (SAB, Adopt Me, generic).
 */

/** Offers shown before "View All N" takes over. */
const MAX_OFFERS = 10
/** Above this many offers the grid becomes a carousel. */
const STATIC_MAX = 2

const ARROW =
  'flex h-8 w-8 items-center justify-center rounded-md bg-bg-overlay text-text-secondary transition-colors ' +
  'hover:bg-bg-overlay-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
export function AvailableNow({
  gameSlug,
  gameName,
  categorySlug,
  itemSlug,
  itemName,
  offers,
  total,
  sellHref,
}: {
  gameSlug: string
  gameName: string
  categorySlug: string
  itemSlug: string
  itemName: string
  offers: ItemOffer[]
  total: number
  sellHref: string
}) {
  const itemHref = itemBuyHref({ gameSlug, categorySlug, itemSlug })
  const shown = offers.slice(0, MAX_OFFERS)
  const carousel = shown.length > STATIC_MAX
  const best = bestDealId(shown)

  const { user } = useAuth()
  const viewerId = user?.id ?? null
  const reduceMotion = useReducedMotion()
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    duration: reduceMotion ? 10 : 25,
  })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])
  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect).on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])
  return (
    <section aria-labelledby="available-now" className="relative mx-auto w-full max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
      <TrackOnMount event={{ event: 'value_view', surface: 'value_item', game: gameSlug, item: itemSlug }} />
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="available-now" className="text-lg font-semibold text-text-primary">
          Available Now
        </h2>
        <div className="flex items-center gap-3">
          {carousel ? (
            <div className="hidden gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => emblaApi?.scrollPrev()}
                disabled={!canPrev}
                aria-label="Previous offers"
                className={ARROW}
              >
                <CaretLeftIcon aria-hidden size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => emblaApi?.scrollNext()}
                disabled={!canNext}
                aria-label="Next offers"
                className={ARROW}
              >
                <CaretRightIcon aria-hidden size={16} weight="bold" />
              </button>
            </div>
          ) : null}
          {total > 0 ? (
            <Link
              href={itemHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              View All {total}
              <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Link>
          ) : null}
        </div>
      </div>

      {carousel ? (
        <div className="overflow-hidden" ref={emblaRef} role="region" aria-roledescription="carousel" aria-label={`${itemName} offers`}>
          <div className="-ml-3 flex touch-pan-y">
            {shown.map((o, i) => (
              <div
                key={o.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${shown.length}`}
                className="min-w-0 shrink-0 grow-0 basis-[91%] pl-3 md:basis-1/2"
              >
                <ValueOfferCell
                  offer={o}
                  gameSlug={gameSlug}
                  gameName={gameName}
                  surface="value_item"
                  itemSlug={itemSlug}
                  viewerId={viewerId}
                  isBestDeal={o.id === best}
                />
              </div>
            ))}
          </div>
        </div>
      ) : shown.length > 0 ? (
        <ValueOfferGrid
          offers={shown}
          gameSlug={gameSlug}
          gameName={gameName}
          surface="value_item"
          itemSlug={itemSlug}
          columns={2}
        />
      ) : (
        <div className="rounded-lg bg-bg-raised px-5 py-6 sm:px-6">
          <p className="text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
            No {itemName} listed right now.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={itemHref}
              onClick={() => trackValueEvent({ event: 'cta_click', surface: 'value_item', game: gameSlug, item: itemSlug, state: 'none' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/[0.07] px-5 font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Browse Similar Items
            </Link>
            <Link
              href={sellHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-lime px-5 font-bold text-text-inverse transition-colors hover:bg-lime-hover active:bg-lime-pressed"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Sell Yours For Cash
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
