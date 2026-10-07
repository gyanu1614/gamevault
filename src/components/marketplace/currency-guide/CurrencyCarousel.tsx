'use client'

/**
 * A slow, endless row of other games' currency pages (Embla + AutoScroll):
 * each the currency's own icon floating over its name and game. Pauses on
 * hover and while dragged; still under reduced motion. A short list is
 * repeated so the loop never shows a gap.
 */

import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import Link from '@/components/navigation/AppLink'
import type { CurrencyPageCard } from '@/lib/currency-guides/server'

const MIN_ITEMS = 10

export function CurrencyCarousel({ items }: { items: CurrencyPageCard[] }) {
  const reduce = useReducedMotion()
  const slides = useMemo(() => {
    if (items.length === 0) return []
    const out = [...items]
    while (out.length < MIN_ITEMS) out.push(...items)
    return out
  }, [items])
  const [ref] = useEmblaCarousel(
    { loop: true, dragFree: true, align: 'start' },
    reduce ? [] : [AutoScroll({ speed: 0.6, startDelay: 400, stopOnInteraction: false, stopOnMouseEnter: true })],
  )
  if (slides.length === 0) return null

  return (
    <div className="relative mt-8">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-bg-base to-transparent sm:w-24" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-bg-base to-transparent sm:w-24" />
      <div ref={ref} className="overflow-hidden">
        <ul className="flex">
          {slides.map((c, i) => (
            <li key={`${c.gameSlug}-${i}`} className="min-w-0 shrink-0 grow-0 basis-[150px] px-2 sm:basis-[176px]" aria-hidden={i >= items.length || undefined}>
              <Link
                href={c.href}
                tabIndex={i >= items.length ? -1 : undefined}
                className="group flex flex-col items-center rounded-lg px-2 py-3 text-center transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {c.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded currency icon
                  <img
                    src={c.iconUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1"
                  />
                ) : (
                  <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-[18px] font-bold text-text-secondary">
                    {c.currencyName.slice(0, 1)}
                  </span>
                )}
                <span className="mt-2.5 text-[14px] font-semibold text-text-primary">{c.currencyName}</span>
                <span className="mt-0.5 line-clamp-1 text-[12.5px] text-text-tertiary">{c.gameName}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
