'use client'

import { useEffect, useState } from 'react'

/**
 * True on touch-first devices (phones, tablets): `(pointer: coarse)`.
 *
 * Pickers use it to NOT auto-focus their search box on open (owner,
 * 2026-09-28): on a phone that pops the keyboard, which covers the list and
 * shoves it to the top of the screen. There the list opens on its own and
 * the keyboard comes up only when the user taps the search box. Desktop
 * keeps the focus so typing filters at once. False until mounted (SSR).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)')
    if (!mq) return
    const sync = () => setCoarse(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return coarse
}
