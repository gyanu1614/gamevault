'use client'

/**
 * "Similar pets" carousel for Adopt Me — a draggable Embla slider of the
 * value-list card treatment (framed art + rarity-tinted hover glow + name and
 * FR cash). All items share the page pet's rarity, so one accent colour drives
 * the whole rail. Prev/next arrows appear when there's more to scroll; links
 * stay on the Adopt Me hub.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface AdoptMeSimilarItem {
  slug: string
  name: string
  imageUrl: string | null
  frCashUsd: number | null
}

/** #RRGGBB → rgba() glow for the card's hover bloom. */
function glow(hex: string, alpha: number): string {
  const c = hex.replace('#', '')
  return `rgba(${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}, ${alpha})`
}

export function AdoptMeSimilar({
  rarityLabel,
  rarityColor = '#9BA8A0',
  items,
}: {
  rarityLabel: string
  /** The shared rarity accent for every card's hover glow. */
  rarityColor?: string
  items: AdoptMeSimilarItem[]
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
    <section className="border-t border-white/[0.07] pt-10">
      {/* dangerouslySetInnerHTML (not a JSX text child) so React doesn't escape
          the CSS quote chars in `content:''` — text-escaping them makes the
          server HTML differ from the client and throws a hydration mismatch. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .am-sim{background:linear-gradient(180deg,#141917 0%,#0D1110 100%);box-shadow:0 2px 6px -3px rgba(0,0,0,.55)}
        .am-sim::before{content:'';position:absolute;inset:0;z-index:0;opacity:0;transition:opacity .25s;pointer-events:none;background:radial-gradient(75% 48% at 50% 0%, var(--sg) 0%, transparent 62%)}
        .am-sim:hover{box-shadow:0 12px 24px -14px rgba(0,0,0,.7),0 0 16px -10px var(--sg)}
        .am-sim:hover::before{opacity:.4}
      `,
        }}
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-subheading font-bold text-[#F1F3F1]">Similar {rarityLabel} Pets</h2>
        <div className="flex items-center gap-3">
          <div className="hidden gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canPrev}
              aria-label="Previous pets"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1E2723] bg-white/[0.03] text-[#C6CEC9] transition hover:border-[#2C3A31] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeftIcon sx={{ fontSize: 20 }} />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canNext}
              aria-label="Next pets"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1E2723] bg-white/[0.03] text-[#C6CEC9] transition hover:border-[#2C3A31] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
          <Link href="/adopt-me/values" className="text-body-sm font-semibold text-[#8FBF9C] hover:underline">
            See All
          </Link>
        </div>
      </div>

      {/* Draggable rail — value-list card treatment (framed art + rarity glow). */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`/adopt-me/values/${item.slug}`}
              style={{ '--sg': glow(rarityColor, 0.5) } as React.CSSProperties}
              className="am-sim group relative isolate flex min-w-0 shrink-0 basis-[46%] flex-col overflow-hidden border border-[#1E2723] transition-colors duration-200 hover:border-[#2C3A31] sm:basis-[31%] lg:basis-[23%] xl:basis-[15.5%]"
            >
              <div className="relative z-10 aspect-square bg-black/20 p-3">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                  <img src={item.imageUrl} alt={`${item.name} — Adopt Me`} className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />
                )}
              </div>
              <div className="relative z-10 border-t border-white/[0.06] px-3 py-2.5">
                <p className="truncate text-body-sm font-semibold text-[#F1F3F1]">{item.name}</p>
                <p className="mt-0.5 text-caption tabular-nums text-[#9BA8A0]">
                  {item.frCashUsd != null ? `${USD.format(item.frCashUsd)} FR` : 'Price pending'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
