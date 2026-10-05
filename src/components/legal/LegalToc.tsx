'use client'

/**
 * "On This Page" table of contents for a legal document.
 *
 * - Desktop (`variant="sidebar"`): a list in the sticky left rail; the entry
 *   for the section currently in view is highlighted (IntersectionObserver
 *   scroll-spy — no scroll listeners).
 * - Phone (`variant="disclosure"`): a collapsed native <details> panel above
 *   the body, so it works before hydration and costs no layout on load.
 *   Choosing an entry closes the panel.
 *
 * Every entry is a plain #anchor link, so the TOC is in the static HTML and
 * works without JavaScript; the script only adds the active highlight.
 */

import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ListBulletsIcon } from '@phosphor-icons/react/dist/csr/ListBullets'
import { cn } from '@/lib/utils'
import type { LegalTocEntry } from './toc'

/** `idsKey` is the section ids joined by '|' — a string, so the effect runs once per document. */
function useActiveSection(idsKey: string): string | null {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : []
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        // The first heading (in document order) inside the reading band wins.
        const first = ids.find((id) => visible.get(id))
        if (first) setActive(first)
      },
      // Reading band: from just under the navbar to 35% down the viewport.
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [idsKey])
  return active
}

function EntryLabel({ entry }: { entry: LegalTocEntry }) {
  return (
    <>
      {entry.number && (
        <span className="w-6 shrink-0 tabular-nums text-text-tertiary">{entry.number}.</span>
      )}
      <span className="min-w-0">{entry.label}</span>
    </>
  )
}

export function LegalToc({
  entries,
  variant,
}: {
  entries: LegalTocEntry[]
  variant: 'sidebar' | 'disclosure'
}) {
  const active = useActiveSection(entries.map((e) => e.id).join('|'))
  const detailsRef = useRef<HTMLDetailsElement>(null)

  if (entries.length === 0) return null

  if (variant === 'disclosure') {
    return (
      <details ref={detailsRef} className="group rounded-lg bg-bg-raised print:hidden">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2.5 px-4 text-[14px] font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
          <ListBulletsIcon size={16} weight="bold" aria-hidden className="text-text-tertiary" />
          On This Page
          <span className="ml-1 text-[13px] font-normal text-text-tertiary">{entries.length} Sections</span>
          <CaretDownIcon
            size={14}
            weight="bold"
            aria-hidden
            className="ml-auto text-text-tertiary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <ol className="border-t border-white/[0.07] px-2 py-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                onClick={() => detailsRef.current?.removeAttribute('open')}
                className="flex gap-2 rounded-md px-2 py-2.5 text-[14px] leading-snug text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
              >
                <EntryLabel entry={entry} />
              </a>
            </li>
          ))}
        </ol>
      </details>
    )
  }

  return (
    <nav aria-label="On this page" className="print:hidden">
      <p className="px-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">On This Page</p>
      <ol className="mt-2 space-y-0.5">
        {entries.map((entry) => {
          const isActive = active === entry.id
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'flex gap-1.5 rounded-md px-3 py-1.5 text-[13px] leading-snug transition-colors',
                  isActive
                    ? 'bg-white/[0.06] text-text-primary'
                    : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
                )}
              >
                <EntryLabel entry={entry} />
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
