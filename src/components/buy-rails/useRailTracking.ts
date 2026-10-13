'use client'

import { useCallback, useEffect, useRef } from 'react'
import { track } from '@/lib/analytics/client'
import type { RailPosition, RailSurface, RailVariant } from '@/lib/buy-rails/model'

export interface RailEventProps {
  surface: RailSurface
  position: RailPosition
  game: string
  item: string | null
  variant: RailVariant
}

/**
 * rail_viewed once, when at least half of the element is on screen (a rail
 * hidden below xl never intersects, so phones never log a desktop rail), and
 * rail_clicked on the button. Returns the ref to put on the card.
 */
export function useRailTracking<T extends HTMLElement>(props: RailEventProps) {
  const ref = useRef<T | null>(null)
  const { surface, position, game, item, variant } = props

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track('rail_viewed', { surface, position, game, item, variant })
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [surface, position, game, item, variant])

  const onClick = useCallback(() => {
    track('rail_clicked', { surface, position, game, item, variant })
  }, [surface, position, game, item, variant])

  return { ref, onClick }
}
