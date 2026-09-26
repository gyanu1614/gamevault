'use client'

/**
 * CollapsibleText — soft-truncated body copy with a measured toggle.
 *
 * Replaces the per-page "guess if it overflows by counting characters"
 * blocks that used to live in the currency page clients. Those fired a
 * "Show more" button off a heuristic (`text.length > 180`), so a short
 * two-line blurb still rendered an ellipsis + toggle that expanded to
 * nothing, and a dense block of short lines could clip with no toggle
 * at all.
 *
 * Here the toggle is driven by real layout: a ResizeObserver compares
 * scrollHeight against clientHeight on the clamped paragraph, so the
 * control appears if and only if the copy is actually cut off. The
 * fade is a `mask-image` on the text itself rather than a gradient
 * <div> over it — it inherits whatever surface it is dropped onto, so
 * there is no colour seam to keep in sync with the panel background.
 *
 * The toggle is a centred grey chevron rather than a lime text link:
 * it sits inside a panel whose one accent is the Buy CTA, so the
 * affordance stays quiet. Its accessible name comes from aria-label.
 *
 * Collapsed height comes from `line-clamp`, which is also what the
 * mask is sized against. Expansion is an instant reflow rather than a
 * height animation: `line-clamp` drives the collapsed height, so there
 * is no fixed max-height to tween between without measuring and
 * pinning the expanded height first — which would fight the observer
 * that is measuring overflow on the same element.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * useLayoutEffect warns when React renders on the server. The first
 * measurement has to be synchronous on the client (see below), so use
 * the layout effect in the browser and a no-op on the server.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const CLAMP_CLASS: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

export interface CollapsibleTextProps {
  /** Body copy. Newlines are preserved (`whitespace-pre-line`). */
  children: React.ReactNode
  /** Lines shown while collapsed. Default 3. */
  lines?: 2 | 3 | 4 | 5 | 6
  /**
   * Accessible name for the expand control. The toggle is a bare
   * chevron, so this is the only name a screen reader announces — it
   * is not rendered visually. Default "Show more".
   */
  moreLabel?: string
  /** Accessible name for the collapse control. Default "Show less". */
  lessLabel?: string
  /** Extra classes for the text element (typography lives here). */
  className?: string
  /** Extra classes for the toggle button. */
  toggleClassName?: string
  /**
   * Collapses back to the clamped state whenever this value changes.
   * Pass the identity of the underlying copy (a listing id, or the
   * raw string) when the same mounted instance can be handed a
   * different seller's blurb — otherwise an expanded panel would stay
   * expanded across the swap. `children` cannot be used for this: it
   * is a fresh ReactNode on every render.
   */
  resetKey?: string | number
}

export function CollapsibleText({
  children,
  lines = 3,
  moreLabel = 'Show more',
  lessLabel = 'Show less',
  className,
  toggleClassName,
  resetKey,
}: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLParagraphElement | null>(null)
  const regionId = useId()

  /**
   * Overflow is only measurable while the clamp is applied, so this
   * runs against the collapsed box. When expanded we keep the last
   * measurement — the toggle must stay mounted to collapse again.
   */
  const measure = useCallback(() => {
    const el = textRef.current
    if (!el || expanded) return
    // 1px tolerance: sub-pixel line heights round inconsistently
    // across browsers and would otherwise flag a false overflow.
    setOverflows(el.scrollHeight - el.clientHeight > 1)
  }, [expanded])

  /**
   * Measure synchronously after layout rather than relying on the
   * ResizeObserver's initial callback. A browser starves rAF and
   * ResizeObserver in a background tab, so a page opened in one (a
   * middle-clicked listing, "open in new tab" from search) would
   * otherwise paint clipped copy with no toggle and only correct
   * itself once the visitor focused the tab.
   */
  useIsomorphicLayoutEffect(() => {
    const el = textRef.current
    if (!el) return

    measure()

    // Width changes (viewport resize, panel reflow, sidebar collapse)
    // change how the copy wraps, so re-measure on element resize
    // rather than on window resize alone.
    const ro = new ResizeObserver(measure)
    ro.observe(el)

    // Late-loading webfonts re-flow the text after first paint; the
    // initial measurement would be against fallback metrics.
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })

    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [measure])

  // Collapse when the panel is handed different copy (e.g. the buyer
  // picks another bundle and a new seller's blurb lands in the same
  // mounted instance).
  useEffect(() => {
    if (resetKey === undefined) return
    setExpanded(false)
  }, [resetKey])

  const clamped = !expanded && overflows

  return (
    <div>
      <p
        ref={textRef}
        id={regionId}
        className={cn(
          'whitespace-pre-line',
          !expanded && (CLAMP_CLASS[lines] ?? CLAMP_CLASS[3]),
          // The mask is the fade. It rides on the text element so it
          // picks up any background, and is removed the moment the
          // copy fits or is expanded — otherwise the last visible line
          // would sit under a permanent dimmer.
          clamped &&
            '[mask-image:linear-gradient(to_bottom,#000_calc(100%-2.1em),transparent_100%)]',
          className,
        )}
      >
        {children}
      </p>

      {overflows && (
        // Centred so the control reads as a divider closing the block
        // rather than a link hanging off the last line of copy.
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={regionId}
            // The chevron carries no text, so the label has to come
            // from here or the control is unusable on a screen reader.
            aria-label={expanded ? lessLabel : moreLabel}
            className={cn(
              // Neutral grey, not the lime: this is a quiet affordance
              // inside the panel and should not compete with the Buy
              // CTA for attention.
              'inline-flex h-7 w-7 items-center justify-center rounded-full',
              'text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-secondary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              // Pads the hit area out to the ~44px touch minimum without
              // visible padding that would push the layout around. The
              // pseudo-element needs an explicit inset (not just
              // `after:absolute`) to get a box to hit-test against.
              'relative after:absolute after:content-[""]',
              'after:left-[-9px] after:right-[-9px] after:top-[-9px] after:bottom-[-9px]',
              toggleClassName,
            )}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          </button>
        </div>
      )}
    </div>
  )
}
