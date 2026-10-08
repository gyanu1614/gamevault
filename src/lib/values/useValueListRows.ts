'use client'

/**
 * The full rows of a value list, fetched from its static `rows.json` right
 * after hydration (contract: src/lib/values/lazy-list.ts). Until they land,
 * `rows` is the page's first page and `ready` is false.
 *
 * One request per game per tab: the promise is kept for the session, so
 * paging to an item and coming Back reuses it (and the browser/CDN cache
 * covers a reload).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { unpack } from '@/lib/serialize/columnar'
import { valueRowsUrl, type InitialValueList } from './lazy-list'

const inflight = new Map<string, Promise<unknown[]>>()

function loadRows(gameSlug: string): Promise<unknown[]> {
  let p = inflight.get(gameSlug)
  if (!p) {
    p = fetch(valueRowsUrl(gameSlug))
      .then((res) => {
        if (!res.ok) throw new Error(`rows.json ${res.status}`)
        return res.json()
      })
      .then((packed) => unpack<unknown[]>(packed))
    // A failed load is forgotten so the next attempt retries.
    p.catch(() => inflight.delete(gameSlug))
    inflight.set(gameSlug, p)
  }
  return p
}

export interface ValueListRowsState<T> {
  /** Every row once loaded; the page's first page until then. */
  rows: T[]
  ready: boolean
  failed: boolean
  retry: () => void
}

export function useValueListRows<T>(gameSlug: string, initial: InitialValueList): ValueListRowsState<T> {
  const firstPage = useMemo(() => unpack<T[]>(initial.rows), [initial.rows])
  const [all, setAll] = useState<T[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setFailed(false)
    loadRows(gameSlug)
      .then((rows) => live && setAll(rows as T[]))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [gameSlug, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { rows: all ?? firstPage, ready: all != null, failed, retry }
}
