/**
 * GamesDirectoryCollapse — client shell for the game directory inside the
 * footer (see footer-game-links.tsx). Collapsed by default: the first rows
 * show, the rest sits under a frosted fade with a centred bold "Show All". The
 * link grid arrives as server-rendered children, so every <a href> is in the
 * initial HTML regardless of this state — the collapse is height only and
 * never unmounts.
 *
 * ANIMATION NOTES — the previous version was janky for three reasons, all
 * fixed here:
 *   1. It animated `max-height` from 210px to a guessed 4000px. The browser
 *      interpolates the whole declared range at a constant rate, so the
 *      content raced open in the first fraction of the transition and then
 *      the element sat still for the remainder. Now the real content height
 *      is measured and animated to exactly that, so the duration maps to the
 *      distance actually travelled.
 *   2. The fade was conditionally rendered, so it vanished on the first
 *      frame instead of fading out with the expansion.
 *   3. The button was positioned `bottom-5` / `bottom-0`, so it teleported
 *      between two places mid-animation. It now sits in normal flow beneath
 *      the panel, pulled up onto the fade by a margin that transitions.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/** Collapsed height in px. One game block is ~98px (22px logo row + 4px +
    4 categories at 18px), rows 20px apart, so this shows the first row whole
    plus the top of the second under the fade. */
const COLLAPSED = 158

export function GamesDirectoryCollapse({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fullHeight, setFullHeight] = useState<number | null>(null)

  // Measure the real content height, and keep it current as the grid reflows
  // (viewport resize changes the column count, so the height changes with it).
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setFullHeight(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // `settled` flips once the expand transition finishes, swapping the fixed
  // pixel height for `auto` so late reflows (font swap, lazy icons) are not
  // clipped by a stale measurement. Held in state, not written to the DOM
  // directly — an inline style set in an event handler is overwritten by the
  // next React render.
  const [settled, setSettled] = useState(false)

  const toggle = useCallback(() => {
    // Collapsing FROM `auto` does not animate — CSS cannot interpolate from
    // an intrinsic value. Pin the current pixel height first, then let the
    // next frame transition it down to COLLAPSED.
    if (open) {
      setSettled(false)
      requestAnimationFrame(() => setOpen(false))
      return
    }
    setOpen(true)
  }, [open])

  const height = open ? (settled ? 'auto' : (fullHeight ?? undefined)) : COLLAPSED

  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={{
          height,
          transition: 'height 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onTransitionEnd={(e) => {
          if (e.propertyName === 'height' && open) setSettled(true)
        }}
      >
        <div ref={innerRef}>{children}</div>

        {/* Always mounted, opacity-animated — a conditionally rendered fade
            disappeared on frame one and made the expansion look like a cut.
            A blur that strengthens toward the bottom plus a fade to the
            ground, so the Show All text sits on frosted black. Explicit
            rgba: a `/60` modifier on a token colour emits no CSS. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 transition-opacity duration-300"
          style={{
            opacity: open ? 0 : 1,
            background:
              'linear-gradient(to top, var(--color-bg-base) 12%, rgba(23,27,33,0.72) 55%, rgba(23,27,33,0) 100%)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            maskImage: 'linear-gradient(to top, #000 40%, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, #000 40%, transparent)',
          }}
        />
      </div>

      {/* Plain bold text, no box. Collapsed it rides up onto the frosted
          fade (negative margin); open it sits just under the grid. The
          margin transitions, so it glides rather than jumping. */}
      <div
        className="relative flex justify-center transition-[margin] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ marginTop: open ? 12 : -30 }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="inline-flex h-8 items-center gap-1.5 px-2 text-[14px] font-bold text-white transition-opacity duration-200 [text-shadow:0_1px_10px_rgba(0,0,0,0.8)] hover:opacity-80"
        >
          {open ? 'Show Less' : 'Show All'}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </div>
  )
}
