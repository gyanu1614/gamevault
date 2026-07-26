'use client'

/**
 * Mobile-only horizontal slider.
 *
 * Wraps any row/grid of cards so it swipes as a carousel on phones (below `md`)
 * and stays a plain CSS grid on desktop. Built on embla-carousel-react (already
 * the house carousel — see HeroCarousel / _TrustMarquee) rather than a
 * hand-rolled scroller, so we get momentum, snapping, and pointer/touch
 * handling for free.
 *
 * Why it can't flicker: the markup is IDENTICAL at every width, and the
 * grid↔row switch is pure CSS on the caller's container. Embla is handed
 * `active: false` with a `breakpoints` override that only turns it on below
 * `md`, so on desktop it never writes a transform at all. Nothing here
 * branches on a JS-measured viewport at render time, so there is no hydration
 * mismatch and no first-paint jump.
 *
 * Usage — the single child IS the embla container, so put the layout classes
 * on it (flex on mobile, grid at the breakpoint):
 *
 *   <MobileSlider activeIndex={i} itemCount={n}>
 *     <RadioGroup className="flex gap-3 md:grid md:grid-cols-4">
 *       {items.map(…)}   // each item: "min-w-0 shrink-0 basis-[42%]"
 *     </RadioGroup>
 *   </MobileSlider>
 *
 * Note that `basis-*`/`shrink-0` on the items are inert once the container
 * becomes a grid — flex sizing properties only apply to flex items — so the
 * same item classes serve both layouts without `md:` overrides.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { cn } from '@/lib/utils'

/**
 * Fixed at Tailwind's `md`. Not a prop: the viewport's overflow release is a
 * static `md:overflow-visible` class, and Tailwind can't extract a breakpoint
 * from a runtime value — a configurable width would silently desync from it.
 * Switching overflow off JS state instead would flash on first paint.
 */
const ACTIVE_BELOW = 768

export interface MobileSliderProps {
  children: ReactNode
  /**
   * Index of the currently selected item. When it changes, the slider brings
   * that item into view — so keyboard/programmatic selection can never leave
   * the chosen card parked off-screen.
   */
  activeIndex?: number
  /** Item count. Changing it re-initialises embla so snap points stay correct. */
  itemCount?: number
  className?: string
}

export function MobileSlider({
  children,
  activeIndex,
  itemCount,
  className,
}: MobileSliderProps) {
  const query = `(max-width: ${ACTIVE_BELOW - 0.02}px)`
  const [emblaRef, emblaApi] = useEmblaCarousel({
    // Off by default; the breakpoint override switches it on below `activeBelow`.
    active: false,
    breakpoints: { [query]: { active: true } },
    align: 'start',
    // Stops embla parking a half-empty frame at either end.
    containScroll: 'trimSnaps',
    // Without this, embla clamps every drag to the adjacent snap point, so a
    // hard flick feels identical to a light one. This lets fling velocity
    // carry past several cards, matching native swipe-carousel feel.
    skipSnaps: true,
  })
  const [isActive, setIsActive] = useState(false)
  // Don't yank the carousel on first mount — only on genuine selection changes.
  const lastIndex = useRef<number | undefined>(activeIndex)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setIsActive(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setIsActive(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  // Slide count changed (region/platform switch swaps the bundle list).
  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, itemCount])

  useEffect(() => {
    if (!emblaApi || !isActive || activeIndex == null) return
    if (lastIndex.current === activeIndex) return
    lastIndex.current = activeIndex
    emblaApi.scrollTo(activeIndex)
  }, [emblaApi, isActive, activeIndex])

  return (
    // overflow-hidden is embla's viewport requirement on mobile; released at
    // the breakpoint so desktop hover-lift and card shadows aren't clipped.
    <div
      ref={emblaRef}
      className={cn('overflow-hidden md:overflow-visible', className)}
    >
      {children}
    </div>
  )
}
