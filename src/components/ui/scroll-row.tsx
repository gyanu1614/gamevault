'use client'

/**
 * ScrollRow — a horizontally scrollable row that says it scrolls.
 *
 * Owner, 2026-09-28: a filter row that runs off the phone screen needs a cue.
 * Each edge with more content behind it gets a soft blur and a ‹ / › button
 * that scrolls by most of a screen; the cue disappears at that end (none at
 * all when nothing overflows, e.g. the desktop grid).
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
  children: ReactNode
}

export function ScrollRow({ className, wrapperClassName, children }: ScrollRowProps) {
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
      <div ref={ref} className={className}>
        {children}
      </div>
      <EdgeCue side="left" visible={edges.left} onClick={() => scrollBy(-1)} />
      <EdgeCue side="right" visible={edges.right} onClick={() => scrollBy(1)} />
    </div>
  )
}

function EdgeCue({ side, visible, onClick }: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-y-0 z-10 flex w-12 items-center transition-opacity duration-200',
        side === 'left' ? 'left-0 justify-start' : 'right-0 justify-end',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Blur + darken fading toward the content, so the clipped item reads as "more". */}
      <span
        className={cn(
          'absolute inset-0 backdrop-blur-[3px]',
          side === 'left'
            ? 'bg-gradient-to-r from-[rgba(12,14,18,0.85)] to-transparent [mask-image:linear-gradient(to_right,black_40%,transparent)]'
            : 'bg-gradient-to-l from-[rgba(12,14,18,0.85)] to-transparent [mask-image:linear-gradient(to_left,black_40%,transparent)]',
        )}
      />
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        aria-label={side === 'left' ? 'Scroll Left' : 'Scroll Right'}
        onClick={onClick}
        className={cn(
          'relative grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[rgba(24,27,33,0.9)] text-text-primary shadow-md transition-transform active:scale-95',
          visible ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
