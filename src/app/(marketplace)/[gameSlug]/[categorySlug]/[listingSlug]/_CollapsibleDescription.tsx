'use client'

/**
 * The seller's description, closed to ~6 lines with a fade and a
 * Show More / Show Less toggle (owner, 2026-09-28: long descriptions were
 * open by default and pushed everything down).
 *
 * The whole text is always in the HTML (only clipped), so crawlers and
 * "find in page" still see it. Short descriptions get no fade and no button:
 * the cue appears only after measuring that the text really overflows.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CollapsibleDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      // Only meaningful while clipped; once open the answer is already known.
      if (!open) setOverflows(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, text])

  return (
    <div>
      <p
        ref={ref}
        id="listing-description"
        className={cn(
          'whitespace-pre-wrap text-[15px] leading-[1.75] text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary',
          // 6 lines at 1.75 line-height = 10.5em.
          !open && 'max-h-[10.5em] overflow-hidden',
          !open && overflows && '[mask-image:linear-gradient(to_bottom,black_50%,transparent)]',
        )}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="listing-description"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-text-primary transition-colors hover:text-lime-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {open ? 'Show Less' : 'Show More'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      )}
    </div>
  )
}
