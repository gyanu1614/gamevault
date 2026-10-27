'use client'

import { useEffect, useState } from 'react'

/**
 * True while `query` matches (e.g. `(min-width: 1024px)`). False until
 * mounted (SSR), so render the phone version first and let desktop take over
 * after hydration — the same contract as useCoarsePointer.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [query])
  return matches
}
