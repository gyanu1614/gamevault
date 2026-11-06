'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { withFilterParams, type FilterValues } from '@/lib/navigation/filter-params'

const WRITE_DELAY_MS = 150

/**
 * A public listing page's search and filters, kept in the page's address (owner,
 * 2026-11-06: search "immortal", open it, go back, and the search was gone).
 *
 * Going back reopens the address, so the page reads its filters from there. That
 * costs nothing: no stored copy, no request to the server or the database, one short
 * string. These pages hold all their rows in the browser already. `useUrlFilters`
 * does the same for signed-in pages, which can read the address after they load.
 *
 * Read before paint with no `useSearchParams`, so the page stays in the static HTML.
 * The address is replaced, not pushed: Back leaves the page rather than stepping
 * through every letter typed.
 *
 * @param values what the page shows now, by address key. Set a key to null when it's off.
 * @param restore called once on opening, only when the address has something to read.
 * @returns whether the address has been read: pass it to useUrlPage so restoring isn't taken for a new filter.
 */
export function useFilterMemory(values: FilterValues, restore: (params: URLSearchParams) => void): boolean {
  const [restored, setRestored] = useState(false)
  const pathRef = useRef<string | null>(null)
  const restoreRef = useRef(restore)
  restoreRef.current = restore
  const valuesRef = useRef(values)
  valuesRef.current = values

  useLayoutEffect(() => {
    pathRef.current = window.location.pathname
    if (window.location.search) restoreRef.current(new URLSearchParams(window.location.search))
    setRestored(true)
  }, [])

  const key = JSON.stringify(values)
  useEffect(() => {
    if (!restored) return
    const timer = setTimeout(() => {
      // The visitor has already left: this address isn't ours to change.
      if (window.location.pathname !== pathRef.current) return
      const next = withFilterParams(window.location.search, valuesRef.current)
      // No state passed: Next attaches its own and keeps useSearchParams in step (use-url-page.ts).
      if (next !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${next}`)
    }, WRITE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key, restored])

  return restored
}
