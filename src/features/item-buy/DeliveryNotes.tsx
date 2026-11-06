'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CollapsibleText } from '@/components/ui/collapsible-text'
import { cn } from '@/lib/utils'

/**
 * The picked offer's delivery instructions (owner, 2026-10-28: "a good place
 * to show the Delivery Instructions"): the seller's own words, kept line for line.
 * A seller who wrote nothing gets the hand-over every order follows (`fallback`).
 *
 * Desktop (owner, 2026-11-06): the block takes the room beside the picture and buy
 * card and scrolls inside it, so a long description never makes the page taller with
 * empty space either side. Phones keep four lines and the chevron, because a scroll
 * inside a scroll is hard to use with a thumb. Another offer's text starts at the top.
 */
export function DeliveryNotes({ text, fallback, resetKey }: { text: string | null; fallback: string; resetKey: string }) {
  const body = text?.trim() || fallback
  return (
    <section aria-labelledby="delivery-notes" className="mt-6 flex min-h-0 flex-1 flex-col rounded-lg bg-white/[0.025] p-4 lg:mt-0">
      <h2 id="delivery-notes" className="shrink-0 text-[16px] font-semibold text-text-primary">
        Delivery Instructions
      </h2>
      <div className="lg:hidden">
        <CollapsibleText clampClassName="line-clamp-4" resetKey={resetKey} moreLabel="Show all instructions" lessLabel="Show fewer lines" className="mt-2 text-[14px] leading-relaxed text-text-secondary">
          {body}
        </CollapsibleText>
      </div>
      <ScrollingText resetKey={resetKey}>{body}</ScrollingText>
    </section>
  )
}

function ScrollingText({ children, resetKey }: { children: string; resetKey: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const measure = useCallback(() => {
    const el = ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = 0
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [resetKey, children, measure])

  return (
    <div
      ref={ref}
      onScroll={measure}
      // A keyboard user can scroll it too.
      tabIndex={0}
      className={cn(
        'mt-2 hidden min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-line pr-2 text-[14px] leading-relaxed text-text-secondary [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] focus-visible:outline-none lg:block',
        more && '[-webkit-mask-image:linear-gradient(to_bottom,#000_calc(100%-32px),transparent)] [mask-image:linear-gradient(to_bottom,#000_calc(100%-32px),transparent)]',
      )}
    >
      {children}
    </div>
  )
}
