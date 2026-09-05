'use client'

/**
 * Auto-scrolling "Live Values" strip for the blog hub — the same continuous,
 * seam-free glide the Founding HQ game marquee uses (embla-carousel +
 * auto-scroll, both already dependencies). Each slide is a priced pet card with
 * its art, variant tag, price and 7-day change. Pauses on hover, and renders a
 * static row for prefers-reduced-motion.
 */

import Link from 'next/link'
import { useMemo } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import type { HubTeaserItem } from './_hubData'

function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** One priced-pet card in the strip. Fixed width so the marquee reads evenly. */
function ValueCard({ item, gameSlug }: { item: HubTeaserItem; gameSlug: string }) {
  return (
    <Link
      href={`/${gameSlug}/values/${item.slug}`}
      className="flex w-[268px] shrink-0 select-none items-center gap-3 border border-[#1A211A] bg-[#0B0F0C] p-4 transition-colors hover:bg-[#101710]"
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote item art
        <img
          src={item.imageUrl}
          alt=""
          className="h-11 w-11 shrink-0 border border-[#1A211A] bg-[#0E140F] object-contain"
          draggable={false}
        />
      ) : (
        <span className="h-11 w-11 shrink-0 border border-[#23291F] bg-[#0E140F]" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-[#E4EAE2]">
            {item.name}
          </span>
          {item.variant && (
            <span className="shrink-0 border border-[#26332C] bg-white/[0.04] px-1 py-px font-mono text-[10px] font-semibold text-[#8FBF9C]">
              {item.variant}
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-[#7C8A80]">{item.qualifier}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-[14px] font-bold tabular-nums text-[#8FBF9C]">
          {item.priceLabel}
        </span>
        {item.changePct != null && (
          <span
            className={`font-mono text-[11px] font-semibold tabular-nums ${
              item.changePct >= 0 ? 'text-[#5BC77E]' : 'text-[#E0736B]'
            }`}
          >
            {item.changePct >= 0 ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(0)}%
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
          <ValueCard key={item.slug} item={item} gameSlug={gameSlug} />
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Edge fades so cards glide in/out instead of getting clipped. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20"
        style={{
          background: 'linear-gradient(90deg,#0B0F0C 0%, rgba(11,15,12,0) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20"
        style={{
          background: 'linear-gradient(270deg,#0B0F0C 0%, rgba(11,15,12,0) 100%)',
        }}
      />
      <div ref={emblaRef} className="overflow-hidden p-3">
        <div className="flex gap-3" style={{ touchAction: 'pan-y' }}>
          {loopItems.map((item, i) => (
            <ValueCard key={`${item.slug}-${i}`} item={item} gameSlug={gameSlug} />
          ))}
        </div>
      </div>
    </div>
  )
}
