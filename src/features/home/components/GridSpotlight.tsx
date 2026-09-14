'use client'

/**
 * GridSpotlight — a graph-paper grid that is invisible until the pointer
 * comes near, then reveals as a soft patch tracking the cursor.
 *
 * Full-bleed and taller than the section it sits behind, so the reveal mask
 * has room to fade to nothing well before any edge. It paints no background
 * of its own — the page ground shows through — so it can't draw a section
 * boundary.
 *
 * Pointer position is written to CSS custom properties rather than React
 * state: a mousemove-driven re-render would run on every frame, and only two
 * numbers in a gradient actually need to change.
 *
 * Hover-only by nature, so it's suppressed where hover doesn't exist (touch)
 * and under prefers-reduced-motion — see globals.css.
 */

import { useEffect, useRef } from 'react'

interface GridSpotlightProps {
  /** How far the layer extends above and below its parent section, in px. */
  bleed?: number
}

export function GridSpotlight({ bleed = 160 }: GridSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Fine pointers only: a spotlight that follows a finger is meaningless,
    // and the listener would run for nothing.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let frame = 0
    const onMove = (e: MouseEvent) => {
      // Coalesce to one write per frame — mousemove can fire far faster.
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
        el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
      })
    }

    const onEnter = () => el.style.setProperty('--spot-opacity', '1')
    const onLeave = () => el.style.setProperty('--spot-opacity', '0')

    // Listen on the parent section, not the layer: the layer is
    // pointer-events:none, so it never sees the pointer itself.
    const host = el.parentElement
    if (!host) return
    host.addEventListener('mousemove', onMove, { passive: true })
    host.addEventListener('mouseenter', onEnter)
    host.addEventListener('mouseleave', onLeave)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseenter', onEnter)
      host.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      data-grid-spotlight
      className="pointer-events-none absolute inset-x-0 -z-10"
      style={{ top: -bleed, bottom: -bleed }}
    />
  )
}
