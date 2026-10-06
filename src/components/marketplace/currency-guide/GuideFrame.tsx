'use client'

/**
 * The guide's interactive shell: the desktop jump list and the fold.
 *
 *   - Jump list (lg+): a sticky left rail. IntersectionObserver lights the
 *     section being read; a click scrolls smoothly (instantly under reduced
 *     motion) and writes the #hash without a navigation. A folded section
 *     opens the fold first.
 *   - Fold: sections 1–2 stay open; the rest sit under "Read the Full <X>
 *     Guide" (Radix Collapsible + the shared framer Expand). Every word is
 *     server-rendered either way: the closed panel is height 0 + inert, never
 *     unmounted, so search sees the whole guide.
 *   - A link that lands on a folded section's #hash opens the fold.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { motion, useReducedMotion } from 'framer-motion'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Expand, EXPAND_TRANSITION } from '@/components/ui/expand'
import { cn } from '@/lib/utils'

export interface GuideNavItem {
  id: string
  label: string
  /** Lives under the fold. */
  folded: boolean
}

export function GuideFrame({
  nav,
  open: openContent,
  folded,
  foldLabel,
  foldHint,
}: {
  nav: GuideNavItem[]
  /** Sections shown from the start. */
  open: ReactNode
  /** Sections under the fold (still in the server HTML). */
  folded: ReactNode
  /** "Read the Full Robux Guide". */
  foldLabel: string
  /** One quiet line beside the button ("Delivery, safety and more"). */
  foldHint?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [active, setActive] = useState(nav[0]?.id ?? '')
  const reduce = useReducedMotion()
  const visible = useRef(new Set<string>())

  // Scroll spy: the first section (in page order) inside the reading band.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id)
          else visible.current.delete(e.target.id)
        }
        const first = nav.find((n) => visible.current.has(n.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    for (const n of nav) {
      const el = document.getElementById(n.id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [nav])

  // A #hash that points under the fold opens it.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!nav.some((n) => n.id === id && n.folded)) return
    setExpanded(true)
    const t = window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ block: 'start' }),
      EXPAND_TRANSITION.duration * 1000 + 40,
    )
    return () => window.clearTimeout(t)
  }, [nav])

  const go = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, item: GuideNavItem) => {
      e.preventDefault()
      const scroll = () => {
        document.getElementById(item.id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
        window.history.replaceState(null, '', `#${item.id}`)
        setActive(item.id)
      }
      if (item.folded && !expanded) {
        setExpanded(true)
        // Let the panel open (EXPAND_TRANSITION) before measuring the target.
        window.setTimeout(scroll, reduce ? 0 : EXPAND_TRANSITION.duration * 1000 + 40)
      } else scroll()
    },
    [expanded, reduce],
  )

  return (
    <div className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="In this guide" className="hidden lg:block">
        <div className="sticky top-[calc(var(--navbar-bottom)+24px)]">
          <p className="text-[12px] font-medium text-text-tertiary">In This Guide</p>
          <ol className="mt-3 space-y-0.5 border-l border-white/[0.08]">
            {nav.map((item, i) => {
              const on = item.id === active
              return (
                <li key={item.id} className="relative">
                  {on && (
                    <motion.span
                      layoutId="currency-guide-rail"
                      aria-hidden
                      className="absolute -left-px top-1 bottom-1 w-[2px] rounded-full bg-[#5EEAD4]"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => go(e, item)}
                    aria-current={on ? 'location' : undefined}
                    className={cn(
                      'flex gap-2 rounded-sm py-1.5 pl-3.5 pr-1 text-[13px] leading-[1.35] transition-colors duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      on ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
                    )}
                  >
                    <span aria-hidden className="w-3 shrink-0 tabular-nums opacity-70">
                      {i + 1}
                    </span>
                    <span>{item.label}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      </nav>

      <div className="min-w-0">
        {openContent}
        <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
          {!expanded && (
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.07] pt-6">
              <Collapsible.Trigger
                className={cn(
                  'group inline-flex h-10 items-center gap-2 rounded-md bg-bg-overlay px-4 text-[13.5px] font-semibold text-text-primary',
                  'transition-[background-color,transform] hover:bg-bg-overlay-2 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                )}
              >
                {foldLabel}
                <CaretDownIcon
                  aria-hidden
                  size={14}
                  weight="bold"
                  className="text-text-secondary transition-transform duration-200 group-hover:translate-y-0.5"
                />
              </Collapsible.Trigger>
              {foldHint && <span className="text-[13px] text-text-tertiary">{foldHint}</span>}
            </div>
          )}
          <Collapsible.Content forceMount asChild>
            <Expand open={expanded}>{folded}</Expand>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    </div>
  )
}
