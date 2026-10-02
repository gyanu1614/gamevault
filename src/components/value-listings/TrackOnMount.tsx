'use client'

import { useEffect, useRef } from 'react'
import { trackValueEvent } from '@/lib/value-listings/track'
import type { ValueEventInput } from '@/lib/value-listings/events'

/** Fires one funnel event when mounted (page view, fallback shown). */
export function TrackOnMount({ event }: { event: ValueEventInput }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    trackValueEvent(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [])
  return null
}
