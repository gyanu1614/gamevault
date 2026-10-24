'use client'

/**
 * The tools row: one Embla row in the homepage rail's pattern
 * (LatestListingsRail): drag and trackpad (wheel plugin), no arrows, and the
 * right edge fades with a mask only while there is more to scroll. Tiles are
 * the marketplace fill with 10px corners; hover lightens in place, nothing
 * moves (house design checklist). Every tile is a real link in the HTML.
 */
import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { ArrowRight } from 'lucide-react'
import Link from '@/components/navigation/AppLink'
import { SilverIcon } from '@/components/ui/silver-icon'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { ToolTile } from '../types'

const FADE = '56px'

export function Tile({ tile, art }: { tile: ToolTile; art: string[] }) {
  return (
    <Link href={tile.href} className={cn('group flex h-full min-h-[196px] flex-col overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)} style={{ padding: 'var(--gap-card)' }}>
      <SilverIcon src={tile.icon} alt="" className={tile.featured ? 'h-14 w-14' : 'h-11 w-11'} />
      <span className="mt-4 font-semibold" style={{ fontSize: 'var(--fs-meta)', color: tile.accent }}>
        {tile.tag}
      </span>
      <span className={cn('mt-1 font-semibold leading-tight tracking-[-0.01em] text-text-primary', tile.featured ? 'text-[22px]' : 'text-[17px]')}>{tile.question}</span>
      <span className="mt-auto flex items-end justify-between gap-3 pt-4">
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-text-secondary transition-colors group-hover:text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>
          {tile.cta}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </span>
        {tile.featured && art.length > 0 && (
          <span aria-hidden className="flex">
            {art.map((src, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={src} src={src} alt="" width={64} height={64} loading="lazy" decoding="async" className={cn('h-12 w-12 object-contain sm:h-16 sm:w-16', i > 0 && '-ml-3')} />
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}

export function ToolsRail({ tiles, art }: { tiles: ToolTile[]; art: string[] }) {
  const [ref, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true }, [WheelGesturesPlugin()])
  const [canNext, setCanNext] = useState(false)
  const onSelect = useCallback(() => {
    if (api) setCanNext(api.canScrollNext())
  }, [api])
  useEffect(() => {
    if (!api) return
    onSelect()
    api.on('select', onSelect).on('reInit', onSelect).on('scroll', onSelect)
    return () => {
      api.off('select', onSelect).off('reInit', onSelect).off('scroll', onSelect)
    }
  }, [api, onSelect])
  const mask = canNext ? `linear-gradient(to right, #000 calc(100% - ${FADE}), transparent 100%)` : undefined

  return (
    <div ref={ref} className="mt-8 overflow-hidden" style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
      <div className="flex touch-pan-y gap-3 sm:gap-4">
        {tiles.map((tile) => (
          <div key={tile.key} className={cn('min-w-0 shrink-0 grow-0', tile.featured ? 'basis-[84%] sm:basis-[420px]' : 'basis-[60%] sm:basis-[240px]')}>
            <Tile tile={tile} art={tile.featured ? art : []} />
          </div>
        ))}
      </div>
    </div>
  )
}
