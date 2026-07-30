'use client'

/**
 * "On this page" TOC. Desktop: a sticky sidebar with a green left-border mark
 * on the active section (scroll-spy). Mobile: a sticky horizontal chip rail
 * under the sub-nav. Both scroll to the heading anchors the body renderer set.
 *
 * Self-hides with fewer than two headings — a one-entry TOC is noise.
 */

import { useEffect, useRef, useState } from 'react'
import type { TocEntry } from './_articleBody'

/** Height of the fixed HubNav — the sidebar starts below it. */
const NAV_OFFSET = 76

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

  /**
   * At the top of the page the TOC sits with the content, top-aligned — a
   * vertically-centred box up there reads as floating in dead space, because
   * the article hasn't started yet. Once the reader is actually into the piece
   * it centres in the viewport and rides along with the scroll.
   */
  const [shift, setShift] = useState(0)
  const boxRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const recalc = () => {
      const box = boxRef.current
      if (!box) return
      // How far down the box would have to move to sit centred in the space
      // below the navbar. Applied as a transform, which IS animatable —
      // switching justify-content (the first attempt) can't tween, so the
      // sidebar visibly snapped downward the moment the threshold passed.
      const available = window.innerHeight - NAV_OFFSET
      const content = box.scrollHeight
      const centreOffset = Math.max(0, (available - content) / 2)
      setShift(window.scrollY > 320 ? centreOffset : 0)
    }
    recalc()
    window.addEventListener('scroll', recalc, { passive: true })
    window.addEventListener('resize', recalc)
    return () => {
      window.removeEventListener('scroll', recalc)
      window.removeEventListener('resize', recalc)
    }
  }, [entries])

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

      {/* Desktop: sticky sidebar — top-aligned at rest, centred once scrolled. */}
      <aside
        ref={boxRef}
        style={{ transform: `translateY(${shift}px)` }}
        className="sticky top-[76px] hidden flex-col gap-0.5 py-10 transition-transform duration-500 ease-out motion-reduce:transition-none lg:flex"
      >
        {/* Was 10px mono in #5E685E — near-invisible. Normal face, white. */}
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
      </aside>
    </>
  )
}
