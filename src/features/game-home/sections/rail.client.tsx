'use client'

/**
 * Shared Embla state for the game-home carousel: whether each side can
 * scroll and the selected slide. Event-driven (Embla's select/scroll), never
 * a scroll listener.
 */
import { useCallback, useEffect, useState } from 'react'
import type { UseEmblaCarouselType } from 'embla-carousel-react'

/** The Embla API as the React hook returns it (embla-carousel itself is not a direct dependency). */
type EmblaCarouselType = NonNullable<UseEmblaCarouselType[1]>

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
