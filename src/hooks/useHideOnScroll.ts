'use client'

import { useEffect, useState } from 'react'

export interface ScrollHideState {
  lastY: number
  hidden: boolean
}

/**
 * One scroll position → the next state: hide going down, show going up, always
 * show near the top. A move under `delta` keeps the state, so a bounce or a
 * shaky trackpad can't flicker it.
 */
export function scrollHideStep(state: ScrollHideState, y: number, { revealAt = 80, delta = 6 }: { revealAt?: number; delta?: number } = {}): ScrollHideState {
  if (y <= revealAt) return { lastY: y, hidden: false }
  const diff = y - state.lastY
  if (Math.abs(diff) < delta) return state
  return { lastY: y, hidden: diff > 0 }
}

/** True while a bar should be slid away (owner, 2026-11-04: GameBoost's sub-navbar). */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let state: ScrollHideState = { lastY: window.scrollY, hidden: false }
    let ticking = false
    const update = () => {
      state = scrollHideStep(state, window.scrollY)
      setHidden(state.hidden)
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}
