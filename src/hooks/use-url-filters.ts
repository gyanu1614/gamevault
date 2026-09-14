'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * STATE-011 — filter state that lives in the URL instead of useState.
 *
 * Ephemeral useState filters cannot be linked or bookmarked, are lost on
 * refresh, and are not restored by browser back/forward. The account pages
 * already read one dimension (`type`) from the URL, so this generalises the
 * pattern they were half-applying.
 *
 * Writes go through router.replace(..., { scroll: false }) so filtering does
 * not push a history entry per keystroke and does not jump the page to the top.
 * A value equal to its default is removed from the query string, keeping the
 * common URL clean.
 *
 * Purely ephemeral UI state (which dropdown is open, row selection) stays in
 * useState — it is not worth a URL and should not survive a refresh.
 */
export function useUrlFilters<T extends Record<string, string | number>>(
  defaults: T,
): {
  values: T
  setValue: <K extends keyof T>(key: K, value: T[K]) => void
  setValues: (next: Partial<T>) => void
  reset: () => void
} {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Stable key list so the memo below does not depend on object identity.
  const keys = useMemo(() => Object.keys(defaults) as (keyof T)[], [defaults])
  const search = searchParams.toString()

  const values = useMemo(() => {
    const params = new URLSearchParams(search)
    const out = { ...defaults }
    for (const key of keys) {
      const raw = params.get(String(key))
      if (raw === null) continue
      // Coerce back to the default's type so callers get numbers, not strings.
      out[key] = (
        typeof defaults[key] === 'number' ? (Number(raw) || defaults[key]) : raw
      ) as T[keyof T]
    }
    return out
  }, [search, defaults, keys])

  const write = useCallback(
    (next: Partial<T>) => {
      const params = new URLSearchParams(search)
      for (const [key, value] of Object.entries(next)) {
        const isDefault = value === undefined || value === defaults[key as keyof T]
        if (isDefault || value === '') params.delete(key)
        else params.set(key, String(value))
      }
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [router, search, defaults],
  )

  const setValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) =>
      write({ [key]: value } as unknown as Partial<T>),
    [write],
  )

  const reset = useCallback(() => {
    const params = new URLSearchParams(search)
    for (const key of keys) params.delete(String(key))
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, search, keys])

  return { values, setValue, setValues: write, reset }
}
