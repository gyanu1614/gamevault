'use client'

/**
 * The ONE "similar items" rail for every values item page (Similar Brainrots,
 * Similar Pets). A draggable Embla row of flat value cards (art · name ·
 * price) with prev/next arrows on desktop that disable at each end. Prices
 * arrive pre-formatted, so server pages can render it directly.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from '@/components/navigation/AppLink'
import useEmblaCarousel from 'embla-carousel-react'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { ValueArt } from './ValueArt'
import { VALUE_SURFACE_LINK } from './styles'

export interface SimilarRailItem {
  key: string
  href: string
  name: string
  imageSrc: string | null
  imageAlt: string
  /** Pre-formatted price line ("$4.20", "$12.00 FR", "Price pending"). */
  price: string
}

const ARROW =
  'flex h-8 w-8 items-center justify-center rounded-md bg-bg-overlay text-text-secondary transition-colors ' +
  'hover:bg-bg-overlay-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

export function SimilarItemsRail({
  title,
  seeAllHref,
  items,
  itemNoun = 'items',
  pixelated = false,
  className = '',
}: {
  title: string
  seeAllHref: string
  items: SimilarRailItem[]
  /** For the arrow labels: "Previous pets". */
  itemNoun?: string
  pixelated?: boolean
  className?: string
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' })
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

  if (items.length === 0) return null

  return (
    <section className={className}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
        <div className="flex items-center gap-3">
          <div className="hidden gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              aria-label={`Previous ${itemNoun}`}
              className={ARROW}
            >
              <CaretLeftIcon aria-hidden size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              aria-label={`Next ${itemNoun}`}
              className={ARROW}
            >
              <CaretRightIcon aria-hidden size={16} weight="bold" />
            </button>
          </div>
          <Link
            href={seeAllHref}
            className="rounded-md text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            See All
          </Link>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${VALUE_SURFACE_LINK} flex min-w-0 shrink-0 basis-[46%] flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:basis-[31%] lg:basis-[23%] xl:basis-[15.5%]`}
            >
              <div className="flex aspect-square items-center justify-center p-3">
                <ValueArt src={item.imageSrc} alt={item.imageAlt} size={120} pixelated={pixelated} />
              </div>
              <div className="border-t border-white/[0.07] px-3 py-2.5">
                <p className="truncate text-[14px] font-semibold text-text-primary">{item.name}</p>
                <p className="mt-0.5 truncate text-[13px] tabular-nums text-text-secondary">{item.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
