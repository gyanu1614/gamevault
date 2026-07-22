'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks vertical scroll to drive hide-on-scroll chrome (navbar + sub-nav).
 *
 * Returns:
 *  - `hidden`  — true when the bar should slide up out of view (user is
 *                scrolling DOWN and is past `revealAt`px from the top).
 *  - `scrolled` — true once past `revealAt` (for solid-bar styling).
 *
 * Reveals immediately on any upward scroll, from anywhere on the page —
 * the "good mobile site" behaviour: scroll down → chrome slides away;
 * flick up → it comes back even deep in the page. Always visible near the
 * very top so the hero never loses its chrome.
 */
export function useScrollDirection({
  revealAt = 40,
  // Small threshold so tiny jitters / momentum bounces don't toggle it.
  delta = 6,
}: { revealAt?: number; delta?: number } = {}) {
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const update = () => {
      const y = window.scrollY
      setScrolled(y > revealAt)

      const diff = y - lastY
      if (Math.abs(diff) >= delta) {
        // Near the top: always show. Otherwise hide on down, show on up.
        if (y <= revealAt) setHidden(false)
        else setHidden(diff > 0)
        lastY = y
      }
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [revealAt, delta])

  return { hidden, scrolled }
}
