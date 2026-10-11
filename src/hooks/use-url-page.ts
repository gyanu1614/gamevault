'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { pageCount, pageHref, pageSlice, parsePage } from '@/lib/pagination'

/**
 * One page of a client-side list, kept in the URL as `?page=N` so Back,
 * refresh and shared links land on the same page. Reading the URL goes
 * through `SearchParamsBridge` (render `<SearchParamsBridge onParams={onParams} />`):
 * useSearchParams() here would drop a static page's grid out of its HTML.
 *
 *   goTo(n)      push ?page=n, then smooth-scroll `topRef` into view
 *   resetKey     a string of the filter VALUES (not the list, which is
 *                rebuilt on unrelated renders); when it changes the list
 *                starts again at page 1. Ignored on mount so a ?page= link holds
 */
export function useUrlPage<T>(items: readonly T[], size: number, resetKey: string) {
  const [raw, setRaw] = useState<string | null>(null)
  const onParams = useCallback((params: URLSearchParams) => setRaw(params.get('page')), [])

  const totalPages = pageCount(items.length, size)
  const page = parsePage(raw, totalPages)
  const visible = useMemo(() => pageSlice(items, page, size), [items, page, size])
  const topRef = useRef<HTMLDivElement | null>(null)

  const goTo = useCallback((n: number) => {
    writePage(n, 'push')
    setRaw(String(n))
    scrollIntoViewSmooth(topRef.current)
  }, [])

  // Compared with the last key (not a first-run flag), so React's dev
  // double-run of effects can't wipe a ?page= the visitor arrived with.
  const lastKey = useRef(resetKey)
  useEffect(() => {
    if (lastKey.current === resetKey) return
    lastKey.current = resetKey
    setRaw(null)
    if (new URLSearchParams(window.location.search).has('page')) writePage(1, 'replace')
  }, [resetKey])

  return { page, totalPages, visible, goTo, onParams, topRef }
}

/**
 * Updates the URL without a Next navigation (no refetch, no re-render of the
 * page). Pass NO state: Next 14.2 patches history.pushState/replaceState to
 * attach its router tree and sync useSearchParams. Copying the current entry's
 * state (which carries Next's `__NA` marker) makes Next skip that sync, and
 * Back then restores the URL but not the page.
 */
export function writePage(page: number, mode: 'push' | 'replace') {
  const url = pageHref(window.location.pathname, window.location.search, page)
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

export function scrollIntoViewSmooth(el: HTMLElement | null) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'
  if (el) el.scrollIntoView({ behavior, block: 'start' })
  else window.scrollTo({ top: 0, behavior })
}
