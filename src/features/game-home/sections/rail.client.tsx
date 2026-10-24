'use client'

/**
 * Shared Embla controls for the game-home rails (tools, guides): prev/next
 * buttons in the OfferRail style and a hook that tracks whether each side
 * can scroll. Event-driven (Embla's select/scroll), never a scroll listener.
 */
import { useCallback, useEffect, useState } from 'react'
import type { EmblaCarouselType } from 'embla-carousel'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

export function useRailNav(api: EmblaCarouselType | undefined) {
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [selected, setSelected] = useState(0)

  const sync = useCallback(() => {
    if (!api) return
    setCanPrev(api.canScrollPrev())
    setCanNext(api.canScrollNext())
    setSelected(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    sync()
    api.on('select', sync).on('reInit', sync).on('scroll', sync)
    return () => {
      api.off('select', sync).off('reInit', sync).off('scroll', sync)
    }
  }, [api, sync])

  return { canPrev, canNext, selected }
}

export function RailArrows({
  api,
  canPrev,
  canNext,
  label,
}: {
  api: EmblaCarouselType | undefined
  canPrev: boolean
  canNext: boolean
  /** What the buttons move through ("tools", "guides"), for their labels. */
  label: string
}) {
  if (!canPrev && !canNext) return null
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      {(['prev', 'next'] as const).map((dir) => {
        const Icon = dir === 'prev' ? CaretLeftIcon : CaretRightIcon
        const disabled = dir === 'prev' ? !canPrev : !canNext
        return (
          <button
            key={dir}
            type="button"
            aria-label={dir === 'prev' ? `Previous ${label}` : `Next ${label}`}
            onClick={() => (dir === 'prev' ? api?.scrollPrev() : api?.scrollNext())}
            disabled={disabled}
            className="grid h-9 w-9 place-items-center rounded-md bg-white/[0.06] text-text-secondary transition-[background-color,color,transform] hover:bg-white/[0.1] hover:text-text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-35"
          >
            <Icon size={15} weight="bold" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
