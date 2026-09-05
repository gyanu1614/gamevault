'use client'

import { useEffect, useState } from 'react'

/**
 * Hydration-safe "current time".
 *
 * Returns null during SSR and the hydration render, then the client clock
 * after mount. Gate anything computed from the current time during render
 * (relative "2h ago" labels, "older than 24h" checks) on it: calling
 * Date.now()/new Date() directly in render produces different HTML on the
 * server and at hydration ("Just now" vs "1m ago"), which trips React's
 * hydration mismatch and bails the whole root out to client rendering —
 * that's what made /admin pages render with inert handlers.
 *
 * Usage: const now = useNow(); relative labels render '' (or a stable
 * fallback) while now == null and fill in on the post-mount render.
 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
  }, [])
  return now
}
