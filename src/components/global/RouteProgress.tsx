'use client'

/**
 * V14t — Global route-progress bar.
 *
 * Shows a thin lime bar at the very top of the viewport while the app is
 * navigating between routes. Same pattern as Vercel / Linear / GitHub:
 * the bar grows quickly for the first ~60% (optimistic), holds, then
 * snaps to 100% the moment the new route paints.
 *
 * How it knows a nav started: we intercept anchor clicks on the document
 * (capture phase) — if the click hits a same-origin link to a different
 * pathname, we start the bar.
 *
 * How it knows a nav finished: we watch usePathname / useSearchParams for
 * changes. Once the URL changes AND the browser has run a rAF (so the
 * new route's first paint landed), we snap to 100% and fade.
 *
 * The bar is gated behind a 120ms delay so cached/instant navigations
 * don't flash a visible loader. Only genuinely slow transitions reveal
 * the bar.
 *
 * V14u — Previously the bar would get stuck at ~30% if the destination
 * page rendered before the finish-effect could compare URLs (Next's
 * streaming + Suspense made the timing flaky). Now we track navigation
 * via a single `navStartCounter`: every click bumps it, and the URL-
 * change effect finishes only if a nav is actually in flight, with a
 * 4s safety timeout so a runaway bar always recovers.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// V14u — Bumped from 120ms → 350ms. Cached App Router navs commonly land
// in 100-300ms; flashing the bar for those felt glitchy. Now only the
// genuinely slow transitions reveal the bar.
const VISIBILITY_DELAY_MS = 350
const COMPLETE_HOLD_MS = 200
const MAX_NAV_DURATION_MS = 4000

export default function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  // True while a navigation is in flight (click → URL settles).
  const navigatingRef = useRef(false)
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trickleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Visible state held in a ref so the finish() function (called from
  // an effect) always sees the latest value without re-binding.
  const visibleRef = useRef(false)
  useEffect(() => { visibleRef.current = visible }, [visible])

  const clearAllTimers = () => {
    if (visibilityTimerRef.current) {
      clearTimeout(visibilityTimerRef.current)
      visibilityTimerRef.current = null
    }
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current)
      trickleTimerRef.current = null
    }
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
  }

  const start = () => {
    // Coalesce: if a nav is already in flight, don't reset progress —
    // just keep going. New clicks just extend the timeout.
    if (navigatingRef.current) {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = setTimeout(finish, MAX_NAV_DURATION_MS)
      return
    }
    navigatingRef.current = true
    setProgress(0)

    visibilityTimerRef.current = setTimeout(() => {
      setVisible(true)
      setProgress(24)
      trickleTimerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 88) return p
          const remaining = 88 - p
          return p + Math.max(0.5, remaining * 0.04)
        })
      }, 220)
    }, VISIBILITY_DELAY_MS)

    // Safety net: if no URL change arrives in 4s, finish anyway. Prevents
    // a stuck bar on edge cases (hash-only navs, errors, etc).
    safetyTimerRef.current = setTimeout(finish, MAX_NAV_DURATION_MS)
  }

  const finish = () => {
    if (!navigatingRef.current) return
    navigatingRef.current = false

    // Cancel pending reveal + trickle + safety.
    clearAllTimers()

    if (!visibleRef.current) {
      // Instant nav — bar was never shown. Stay hidden.
      setProgress(0)
      return
    }
    // Snap to full, hold briefly, fade.
    setProgress(100)
    completeTimerRef.current = setTimeout(() => {
      setVisible(false)
      // Reset width AFTER opacity fade completes so the next nav starts clean.
      setTimeout(() => setProgress(0), 200)
    }, COMPLETE_HOLD_MS)
  }

  // V15r — Set scroll-restoration to manual SYNCHRONOUSLY on every render
  // so it's active before any click can fire. (useEffect runs too late —
  // by the time it runs after first paint, the browser has already
  // restored a stale scroll position on a back/forward nav.)
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  // Capture anchor clicks at the document level.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a') as HTMLAnchorElement | null
      if (!anchor || !anchor.href) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const targetPathSearch = `${url.pathname}${url.search}`
      const currentPathSearch = `${window.location.pathname}${window.location.search}`
      if (targetPathSearch === currentPathSearch) return

      // V15r — Hard-scroll BOTH window and the documentElement to top
      // immediately. This kills the "I clicked at the bottom of page A
      // and now see the footer of page B for a frame" bug: when Next
      // streams the new page in, the document's scroll position is
      // already 0, so the first paint lands at the top.
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      } catch {
        /* noop — defensive */
      }

      start()
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => {
      document.removeEventListener('click', onClick, { capture: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // V14u — On every pathname/searchParams change, if a nav is in flight,
  // wait one rAF to let the new route paint and then finish. This is more
  // reliable than comparing URL strings (Next can update searchParams in
  // odd orders during streaming render).
  // V15r — Also force-scroll to top when the URL changes. Catches the
  // programmatic `router.push()` path (Buy now button, ItemCard nav,
  // etc) which doesn't go through the click interceptor above.
  // V15s — Wait TWO rAFs before dropping the cover overlay: first frame
  // commits the scroll, second frame paints the new content at the
  // correct position. This is the only reliable way to hide App Router
  // streaming's commit-then-snap glitch on long pages.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    } catch {
      /* noop */
    }
    if (!navigatingRef.current) return
    const finishRaf = requestAnimationFrame(() => {
      finish()
    })
    return () => cancelAnimationFrame(finishRaf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [])

  // V15l — Sits at the very top of every page, above the floating navbar
  // (z-[100]). 3px height + lime gradient + diffused glow so it reads as a
  // proper system-level progress indicator rather than a thin hairline.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 220ms ease' }}
    >
      <div
        className="relative h-[3px]"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #B2E835 0%, #C6FF3D 60%, #DEFF8A 100%)',
          transition: visible
            ? 'width 240ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
          boxShadow:
            visible && progress > 0
              ? '0 0 12px rgba(198, 255, 61, 0.75), 0 0 2px rgba(198, 255, 61, 0.95)'
              : 'none',
        }}
      >
        {/* V15l — Trailing "comet" highlight on the leading edge so the
            bar reads as live progress, not just a static fill. */}
        {visible && progress > 0 && progress < 100 && (
          <span
            aria-hidden
            className="absolute right-0 top-0 h-full w-12 opacity-90"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.55))',
              filter: 'blur(2px)',
            }}
          />
        )}
      </div>
    </div>
  )
}
