'use client'

/**
 * The tools row (owner, 2026-10-23: one row max, motion to show more). One
 * Embla row: drag on touch, trackpad/wheel sideways, arrows on desktop, and a
 * wider fade on the right edge that says there is more. The featured tile
 * (the trade calculator) is twice as wide with the game's most valuable items
 * on it. Every tile is a real link in the server HTML; Embla only enhances.
 */
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { ArrowRightIcon } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { SilverIcon } from '@/components/ui/silver-icon'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { ToolTile } from '../types'
import { RailArrows, useRailNav } from './rail.client'

function Tile({ tile, art }: { tile: ToolTile; art: string[] }) {
  return (
    <Link
      href={tile.href}
      className={cn(
        'group relative flex h-full min-h-[208px] flex-col overflow-hidden rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-300 hover:-translate-y-1 sm:p-6',
        MARKET_CARD,
      )}
    >
      {tile.featured && (
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(125,180,255,0.24),transparent)]" />
      )}
      <SilverIcon
        src={tile.icon}
        alt=""
        className={cn('relative transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105', tile.featured ? 'h-16 w-16' : 'h-12 w-12')}
      />
      <span className="relative mt-4 text-[12.5px] font-bold" style={{ color: tile.accent }}>
        {tile.tag}
      </span>
      <span className={cn('relative mt-1 font-bold leading-tight tracking-[-0.015em] text-text-primary', tile.featured ? 'text-[24px] sm:text-[26px]' : 'text-[18px]')}>
        {tile.question}
      </span>
      <span className="relative mt-auto flex items-end justify-between gap-3 pt-5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[13.5px] font-semibold',
            tile.featured ? 'h-10 rounded-md bg-[#ECEEEA] px-4 font-extrabold text-[#0F1012]' : 'text-text-secondary group-hover:text-text-primary',
          )}
        >
          {tile.cta}
          <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
        {tile.featured && art.length > 0 && (
          <span aria-hidden className="flex">
            {art.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={72} height={72} loading="lazy" decoding="async" className={cn('h-[72px] w-[72px] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.6)]', i > 0 && '-ml-4')} />
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}

export function ToolsRail({ tiles, art }: { tiles: ToolTile[]; art: string[] }) {
  const [ref, api] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' }, [WheelGesturesPlugin()])
  const { canPrev, canNext } = useRailNav(api)
  return (
    <div className="relative">
      <div className="absolute -top-14 right-0">
        <RailArrows api={api} canPrev={canPrev} canNext={canNext} label="tools" />
      </div>
      <div className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0" ref={ref}>
        <div className="flex gap-4">
          {tiles.map((tile) => (
            <div key={tile.key} className={cn('min-w-0 shrink-0 grow-0', tile.featured ? 'basis-[86%] sm:basis-[440px]' : 'basis-[62%] sm:basis-[250px]')}>
              <Tile tile={tile} art={tile.featured ? art : []} />
            </div>
          ))}
        </div>
      </div>
      {/* Right-edge fade: the "there is more" hint (Raycast reel). */}
      {canNext && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#16171B] to-transparent sm:w-28" />
      )}
    </div>
  )
}
