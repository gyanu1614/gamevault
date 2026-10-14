'use client'

/**
 * "On this page" (2026-10-12 revamp).
 *
 * Phones / tablets (< lg): one slim bar stuck UNDER the hub nav (both nav
 * rows: 97px, 109px from sm), never over its tabs. It names the section you
 * are in; tap to open the list, pick a section, it closes.
 *
 * Desktop (lg+): a sticky list in the left column with its own scroll, so a
 * long contents list is never cut off; the active section is marked. At xl
 * the currency rail card stacks under it.
 *
 * Shown only for posts with 3+ sections (fewer is noise).
 */

import { useEffect, useState, type ReactNode } from 'react'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { TOC_MIN_SECTIONS, type HeadingEntry } from '@/lib/blog/render/outline'
import { BLOG_CARD } from '@/lib/blog/render/surface'

export function ArticleToc({
  entries,
  rail,
  variant,
}: {
  entries: HeadingEntry[]
  rail?: ReactNode
  /** bar = the phone/tablet bar (placed in the article, under the cover); column = the desktop left column. */
  variant: 'bar' | 'column'
}) {
  const [active, setActive] = useState<string>(entries[0]?.id ?? '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (entries.length === 0) return
    const els = entries.map((e) => document.getElementById(e.id)).filter((el): el is HTMLElement => el !== null)
    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.filter((o) => o.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) setActive(visible[0].target.id)
      },
      // Below the nav + this bar; a section is "current" once its heading
      // passes the top third of the screen.
      { rootMargin: '-160px 0px -60% 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [entries])

  if (entries.length < TOC_MIN_SECTIONS) return null
  const current = entries.find((e) => e.id === active) ?? entries[0]

  const list = (onPick?: () => void) =>
    entries.map((e) => {
      const isActive = active === e.id
      return (
        <a
          key={e.id}
          href={`#${e.id}`}
          onClick={onPick}
          aria-current={isActive ? 'location' : undefined}
          className={`block border-l-2 py-2 pl-3.5 text-[14.5px] leading-snug transition-colors ${
            isActive
              ? 'border-[color:var(--color-accent-text)] font-semibold text-[color:var(--color-accent-text)]'
              : 'border-white/[0.08] text-text-secondary hover:text-text-primary'
          }`}
        >
          {e.text}
        </a>
      )
    })

  if (variant === 'bar') {
    return (
      <div className="sticky top-[97px] z-30 -mx-4 mb-2 border-b border-white/[0.06] bg-[#1C1D22] px-4 sm:-mx-6 sm:top-[109px] sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-12 w-full items-center gap-2 text-left"
        >
          <span className="shrink-0 text-[13px] font-semibold text-text-primary">On This Page</span>
          <span aria-hidden className="text-text-tertiary">·</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--color-accent-text)]">{current?.text}</span>
          <ExpandMoreRounded aria-hidden sx={{ fontSize: 20 }} className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <nav aria-label="On this page" className="max-h-[50vh] overflow-y-auto pb-3">{list(() => setOpen(false))}</nav>}
      </div>
    )
  }

  return (
      <aside aria-label="On this page" className="hidden self-stretch lg:block">
        <div className="sticky top-[136px] flex max-h-[calc(100vh-152px)] flex-col xl:top-[96px] xl:max-h-[calc(100vh-112px)]">
          {/* Boxed (Blog v2, like Eldorado's): the current section in the blog highlight colour. */}
          <div className={`blog-type ${BLOG_CARD} flex min-h-0 flex-col p-4`}>
            <p className="mb-2 text-[14px] font-bold text-text-primary">On This Page</p>
            <nav className="min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]">{list()}</nav>
          </div>
          {rail && <div className="mt-6 hidden shrink-0 xl:block">{rail}</div>}
        </div>
      </aside>
  )
}
