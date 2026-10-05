'use client'

/**
 * Auto-scrolling "Live Values" strip for the blog hub — the same continuous,
 * seam-free glide the Founding HQ game marquee uses (embla-carousel +
 * auto-scroll, both already dependencies). Each slide is a priced pet card with
 * its art, variant tag, price and 7-day change. Pauses on hover, and renders a
 * static row for prefers-reduced-motion.
 */

import Link from '@/components/navigation/AppLink'
import { useMemo } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ValueArt } from '@/components/values/ValueArt'
import type { HubTeaserItem } from './_hubData'

function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Edge fade as a mask, so it works on any surface colour behind it. */
const EDGE_MASK =
  '[mask-image:linear-gradient(90deg,transparent,#000_48px,#000_calc(100%_-_48px),transparent)] sm:[mask-image:linear-gradient(90deg,transparent,#000_80px,#000_calc(100%_-_80px),transparent)]'

/** One priced-pet tile in the strip (flat tile inside the teaser card).
 *  Fixed width so the marquee reads evenly. */
function MarqueeTile({ item, gameSlug }: { item: HubTeaserItem; gameSlug: string }) {
  const up = item.changePct != null && item.changePct >= 0
  return (
    <Link
      href={`/${gameSlug}/values/${item.slug}`}
      draggable={false}
      className="flex w-[268px] shrink-0 select-none items-center gap-3 rounded-md bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <ValueArt src={item.imageUrl} alt="" size={44} className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-text-primary">
            {item.name}
          </span>
          {item.variant && (
            <span className="shrink-0 rounded bg-white/[0.08] px-1 py-px text-[10px] font-semibold text-text-secondary">
              {item.variant}
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-text-tertiary">{item.qualifier}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[14px] font-semibold tabular-nums text-text-primary">
          {item.priceLabel}
        </span>
        {item.changePct != null && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
              up ? 'text-success' : 'text-error'
            }`}
          >
            {up ? (
              <CaretUpIcon size={10} weight="fill" aria-label="Up" />
            ) : (
              <CaretDownIcon size={10} weight="fill" aria-label="Down" />
            )}
            {Math.abs(item.changePct).toFixed(0)}%
          </span>
        )}
      </span>
    </Link>
  )
}

export default function ValuesMarquee({
  items,
  gameSlug,
}: {
  items: HubTeaserItem[]
  gameSlug: string
}) {
  const reduced = usePrefersReducedMotion()
  const shouldScroll = items.length >= 3 && !reduced

  const [emblaRef] = useEmblaCarousel(
    { loop: true, dragFree: true, align: 'start', containScroll: false },
    shouldScroll
      ? [AutoScroll({ speed: 0.6, stopOnInteraction: false, stopOnMouseEnter: true })]
      : [],
  )

  // Duplicate so the track is always wider than the viewport (auto-scroll needs
  // overflow to loop seamlessly). 3× covers a short list without visible seams.
  const loopItems = useMemo(
    () => (items.length ? Array.from({ length: 3 }).flatMap(() => items) : []),
    [items],
  )

  if (!items.length) return null

  // Reduced motion (or too few items): a plain horizontal rail, no animation.
  if (!shouldScroll) {
    return (
      <div className="flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MarqueeTile key={item.slug} item={item} gameSlug={gameSlug} />
        ))}
      </div>
    )
  }

  return (
    <div className={`relative ${EDGE_MASK}`}>
      <div ref={emblaRef} className="overflow-hidden p-3">
        <div className="flex gap-3" style={{ touchAction: 'pan-y' }}>
          {loopItems.map((item, i) => (
            <MarqueeTile key={`${item.slug}-${i}`} item={item} gameSlug={gameSlug} />
          ))}
        </div>
      </div>
    </div>
  )
}
