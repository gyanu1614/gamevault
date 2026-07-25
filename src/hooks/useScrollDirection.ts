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
 *
 * `hideBelow` scopes the hide-away to small screens. Consumers animate a
 * transform, which is an inline style — Tailwind's `max-lg:` overrides can't
 * reach it — so the breakpoint has to be decided here in JS rather than in
 * CSS. It gates ONLY `hidden`; `scrolled` keeps tracking at every width,
 * because desktop still uses it for the resting-pill → full-width-bar morph.
 */
export function useScrollDirection({
  revealAt = 40,
  // Small threshold so tiny jitters / momentum bounces don't toggle it.
  delta = 6,
  // Max viewport width (px, exclusive) that may hide the chrome. Omit to
  // allow hiding at every width.
  hideBelow,
}: { revealAt?: number; delta?: number; hideBelow?: number } = {}) {
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const mql =
      hideBelow != null ? window.matchMedia(`(max-width: ${hideBelow - 0.02}px)`) : null

    // Default true when unscoped; when scoped, start from the live match so a
    // desktop load never hides on its first scroll frame.
    let canHide = mql ? mql.matches : true
    let lastY = window.scrollY
    let ticking = false

    const update = () => {
      const y = window.scrollY
      setScrolled(y > revealAt)

      const diff = y - lastY
      if (Math.abs(diff) >= delta) {
        // Near the top: always show. Otherwise hide on down, show on up.
        if (!canHide || y <= revealAt) setHidden(false)
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

    // Crossing into desktop (or rotating to a wide tablet) while the chrome is
    // mid-hide must reveal it immediately — otherwise the bar stays parked
    // off-screen until the next upward scroll.
    const onViewportChange = (e: MediaQueryListEvent) => {
      canHide = e.matches
      if (!canHide) setHidden(false)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    mql?.addEventListener('change', onViewportChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      mql?.removeEventListener('change', onViewportChange)
    }
  }, [revealAt, delta, hideBelow])

  return { hidden, scrolled }
}
