'use client'

/**
 * "On this page" TOC. Desktop: a sticky sidebar with a green left-border mark
 * on the active section (scroll-spy). Mobile: a sticky horizontal chip rail
 * under the sub-nav. Both scroll to the heading anchors the body renderer set.
 *
 * Self-hides with fewer than two headings — a one-entry TOC is noise.
 */

import { useEffect, useState } from 'react'
import type { TocEntry } from './_articleBody'

export function ArticleToc({
  entries,
  buyHref,
  buyLabel,
}: {
  entries: TocEntry[]
  buyHref: string
  buyLabel: string
}) {
  const [active, setActive] = useState<string>(entries[0]?.id ?? '')

  useEffect(() => {
    if (entries.length === 0) return
    const els = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs
          .filter((o) => o.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) setActive(visible[0].target.id)
      },
      { rootMargin: '-100px 0px -66% 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [entries])

  if (entries.length < 2) return null

  return (
    <>
      {/* Mobile: sticky chip rail */}
      <nav className="sticky top-[60px] z-30 -mx-4 mb-6 border-b border-[#1A211A] bg-[#080B09] px-4 py-2.5 lg:hidden">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entries.map((e) => (
            <a
              key={e.id}
              href={`#${e.id}`}
              className="shrink-0 whitespace-nowrap border border-[#263026] px-3 py-2 font-mono text-[11px] text-[#98A398] transition-colors hover:text-[#F1F3F1]"
            >
              {e.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Desktop: sticky sidebar */}
      <aside className="sticky top-20 hidden flex-col gap-0.5 lg:flex">
        <div className="mb-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5E685E]">
          On this page
        </div>
        {entries.map((e) => {
          const isActive = active === e.id
          return (
            <a
              key={e.id}
              href={`#${e.id}`}
              className={`border-l-2 py-2 pl-3.5 text-[13px] leading-snug transition-colors ${
                isActive
                  ? 'border-[#4FB477] text-[#D7DED4]'
                  : 'border-[#1A211A] text-[#7C877C] hover:text-[#A7B1A5]'
              }`}
            >
              {e.label}
            </a>
          )
        })}
        <a
          href={buyHref}
          className="mt-5 bg-[#1B6B3F] px-4 py-3 text-center text-[12px] font-semibold text-white transition hover:bg-[#1f7a48]"
        >
          {buyLabel}
        </a>
      </aside>
    </>
  )
}
