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

      {/*
        Desktop: sticky, viewport-CENTRED TOC bounded by the article.

        The <aside> is the grid cell — with `items-start` on the parent grid its
        row height equals the (taller) prose column, so it spans the full
        article. The inner box is `sticky` at `top-[76px]` (clears the fixed nav)
        and a min-h-[calc(100vh-76px)] flex box that vertically CENTRES the TOC
        inside it. Effect: scrolling from the top, the TOC glides down and
        settles at the vertical centre (no jump-to-top-then-slide-back — the old
        JS transform did that); it rides along centred while you read; and
        because the sticky box lives inside the article-height cell, it stops
        exactly at the end of the content instead of overscrolling past it.
        Pure CSS — no scroll listeners, no layout thrash.
      */}
      <aside className="hidden self-stretch lg:block">
        <div className="sticky top-[76px] flex min-h-[calc(100vh-76px)] flex-col justify-center py-10">
          <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#F1F3F1]">
            On this page
          </div>
          {entries.map((e) => {
            const isActive = active === e.id
            return (
              <a
                key={e.id}
                href={`#${e.id}`}
                className={`border-l-2 py-2.5 pl-4 text-[14.5px] leading-snug transition-colors ${
                  isActive
                    ? 'border-[#4FB477] font-semibold text-[#FFFFFF]'
                    : 'border-[#1A211A] text-[#B7C0BA] hover:text-[#F1F3F1]'
                }`}
              >
                {e.label}
              </a>
            )
          })}
          {/* Same treatment as the navbar's Accounts button: outlined rather
              than filled, with the flowing gradient text. A solid green block
              here competed with the article's own CTA. */}
          <a
            href={buyHref}
            className="mt-6 flex items-center justify-center whitespace-nowrap border border-[#2F6B46] px-4 py-3.5 text-center text-[13.5px] font-semibold transition hover:border-[#3FA35C]"
          >
            <span className="animate-text-flow bg-[linear-gradient(110deg,#7Cd39a_0%,#F1F3F1_35%,#4FB477_60%,#7Cd39a_100%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:text-[#8FBF9C]">
              {buyLabel}
            </span>
          </a>
        </div>
      </aside>
    </>
  )
}
