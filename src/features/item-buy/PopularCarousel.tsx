'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { TITLE_GAP_BELOW } from '@/components/marketplace/page-scale'
import { ShowAllLink } from '@/components/marketplace/ShowAllLink'
import { GridCard } from '@/features/items-grid/GridCard'
import type { GridItem } from '@/features/items-grid/model/grid'
import { cn } from '@/lib/utils'
import { ITEM_H2 } from './layout'

const FADE = '56px'

/**
 * The row under a pet page (owner, 2026-11-02: "curated data, the actual card
 * design, a carousel that slides"): the most popular other pets in stock as
 * the Items page's own cards, in one Embla row. Drag, trackpad (wheel plugin)
 * or the arrows; the edges fade only while there is more to scroll. Cards are
 * real links in the server HTML; nothing moves on hover (house checklist).
 * Also the game home's Popular row, with a Show All to the Items page.
 */
export function PopularCarousel({
  id,
  heading,
  items,
  gameSlug,
  seeAllHref,
  className,
}: {
  id: string
  heading: string
  items: GridItem[]
  gameSlug: string
  seeAllHref?: string
  className?: string
}) {
  const [ref, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true, slidesToScroll: 'auto' }, [WheelGesturesPlugin()])
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const sync = useCallback(() => {
    if (!api) return
    setCanPrev(api.canScrollPrev())
    setCanNext(api.canScrollNext())
  }, [api])
  useEffect(() => {
    if (!api) return
    sync()
    api.on('select', sync).on('reInit', sync).on('scroll', sync)
    return () => {
      api.off('select', sync).off('reInit', sync).off('scroll', sync)
    }
  }, [api, sync])

  if (items.length === 0) return null
  const mask = [canPrev ? `transparent 0, #000 ${FADE}` : '#000 0', canNext ? `#000 calc(100% - ${FADE}), transparent 100%` : '#000 100%'].join(', ')

  return (
    <section aria-labelledby={id} className={className}>
      <div className={cn('flex items-center justify-between gap-4', TITLE_GAP_BELOW)}>
        <h2 id={id} className={ITEM_H2}>
          {heading}
        </h2>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <ArrowButton label="Previous pets" disabled={!canPrev} onClick={() => api?.scrollPrev()}>
              <IconChevronLeft aria-hidden size={18} stroke={2} />
            </ArrowButton>
            <ArrowButton label="More pets" disabled={!canNext} onClick={() => api?.scrollNext()}>
              <IconChevronRight aria-hidden size={18} stroke={2} />
            </ArrowButton>
          </div>
          {seeAllHref ? <ShowAllLink href={seeAllHref} /> : null}
        </div>
      </div>
      <div ref={ref} className="overflow-hidden" style={{ maskImage: `linear-gradient(to right, ${mask})`, WebkitMaskImage: `linear-gradient(to right, ${mask})` }}>
        <ul className="flex touch-pan-y gap-3 sm:gap-4">
          {items.map((item) => (
            <li key={item.key} className="min-w-0 shrink-0 grow-0 basis-[44%] sm:basis-[calc((100%-2rem)/3)] xl:basis-[calc((100%-3rem)/4)]">
              <GridCard item={item} gameSlug={gameSlug} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-md bg-white/[0.05] text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        disabled ? 'cursor-default opacity-40' : 'hover:bg-white/[0.09] hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}
