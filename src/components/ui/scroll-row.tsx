'use client'

/**
 * ScrollRow — a horizontally scrollable row that says it scrolls.
 *
 * Owner, 2026-09-28: a filter row that runs off the phone screen needs a cue.
 * Each edge with more content behind it fades into the row's ground (dark +
 * light blur) with a plain ‹ / › chevron in the row itself (owner,
 * 2026-09-29: GameBoost's style, not a floating round button); tapping it
 * scrolls by most of a screen. The cue disappears at that end (none at all
 * when nothing overflows, e.g. the desktop grid).
 *
 * The edges are sibling overlays, not a mask on the row: filter rows hold
 * dropdown panels (fixed on phones) that a mask would clip.
 *
 * `className` styles the scrolling element itself (flex/grid, gaps, and
 * `overflow-x-auto` where it should scroll); the wrapper is only `relative`.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrollRowProps {
  className?: string
  wrapperClassName?: string
  /**
   * The colour directly behind the row, which the clipped edge fades into.
   * Rows on the page ground use the default; a row inside a bar (tabs)
   * passes the bar's fill so the fade is seamless.
   */
  edgeColor?: string
  children: ReactNode
}

export function ScrollRow({
  className,
  wrapperClassName,
  edgeColor = 'rgba(var(--color-bg-base-rgb), 0.96)',
  children,
}: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const left = el.scrollLeft > 2
    const right = max > 2 && el.scrollLeft < max - 2
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update])

  // Labels change width (a picked filter), so re-measure after every render.
  useEffect(() => {
    update()
  })

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className={cn('relative', wrapperClassName)}>
      <div ref={ref} data-scrollrow="" className={className}>
        {children}
      </div>
      <EdgeCue side="left" visible={edges.left} onClick={() => scrollBy(-1)} color={edgeColor} />
      <EdgeCue side="right" visible={edges.right} onClick={() => scrollBy(1)} color={edgeColor} />
    </div>
  )
}

function EdgeCue({
  side,
  visible,
  onClick,
  color,
}: {
  side: 'left' | 'right'
  visible: boolean
  onClick: () => void
  color: string
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  const toward = side === 'left' ? 'to right' : 'to left'
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-y-0 z-10 flex w-14 items-center transition-opacity duration-200',
        side === 'left' ? 'left-0 justify-start' : 'right-0 justify-end',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* The clipped item fades into the row's own ground (dark + a touch of
          blur), so it reads as "more this way" without a floating control. */}
      <span
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{
          backgroundImage: `linear-gradient(${toward}, ${color} 38%, transparent)`,
          maskImage: `linear-gradient(${toward}, black 55%, transparent)`,
          WebkitMaskImage: `linear-gradient(${toward}, black 55%, transparent)`,
        }}
      />
      {/* Just the chevron, sitting in the row (GameBoost-style): no circle,
          no border. The whole edge strip is the tap target. */}
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        aria-label={side === 'left' ? 'Scroll Left' : 'Scroll Right'}
        onClick={onClick}
        className={cn(
          'relative flex h-full w-9 items-center text-text-secondary transition-colors hover:text-text-primary active:text-text-primary',
          side === 'left' ? 'justify-start pl-2' : 'justify-end pr-2',
          visible ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
