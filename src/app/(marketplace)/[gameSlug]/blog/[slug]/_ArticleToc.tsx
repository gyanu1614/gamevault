'use client'

/**
 * "On this page" (2026-10-12 revamp).
 *
 * Phones / tablets (< lg): one slim bar stuck UNDER the hub nav (both nav
 * rows: 97px, 109px from sm), never over its tabs. It names the section you
 * are in; tap to open the list, pick a section, it closes.
 *
 * Desktop (lg+): the right sidebar (Blog v2, Eldorado's layout): a sticky
 * boxed list with its own scroll, so a long contents list is never cut off;
 * the active section is marked. At xl the buy card stacks under it.
 *
 * The list shows only for posts with 3+ sections (fewer is noise); the
 * sidebar still holds the buy card then.
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { TOC_MIN_SECTIONS, type HeadingEntry } from '@/lib/blog/render/outline'
import { BLOG_CARD } from '@/lib/blog/render/surface'
import { BLOG_SIDE_CELL } from '@/components/blog/layout'

/**
 * The sidebar list on a short window: it scrolls inside its box, fades at the
 * bottom while more is below (so it never reads as cut off), and keeps the
 * current section in view as the reader moves through the post.
 */
function useListScroll(ref: RefObject<HTMLElement | null>, active: string): boolean {
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [ref])
  useEffect(() => {
    const el = ref.current
    const item = el?.querySelector<HTMLElement>(`a[href="#${CSS.escape(active)}"]`)
    if (!el || !item) return
    // Scroll the list only (never the page): nudge the item inside the box.
    const box = el.getBoundingClientRect()
    const r = item.getBoundingClientRect()
    if (r.top < box.top) el.scrollTop -= box.top - r.top + 8
    else if (r.bottom > box.bottom) el.scrollTop += r.bottom - box.bottom + 8
  }, [ref, active])
  return more
}

export function ArticleToc({
  entries,
  rail,
  variant,
}: {
  entries: HeadingEntry[]
  rail?: ReactNode
  /** bar = the phone/tablet bar (placed in the article, under the cover); column = the desktop right sidebar. */
  variant: 'bar' | 'column'
}) {
  const [active, setActive] = useState<string>(entries[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLElement>(null)
  const more = useListScroll(listRef, active)

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

  const hasList = entries.length >= TOC_MIN_SECTIONS
  if (!hasList && (variant === 'bar' || !rail)) return null
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
          // Sidebar: compact rows so a long post's list fits (owner); the phone list keeps finger-sized rows.
          className={`block border-l-2 pl-3.5 transition-colors ${variant === 'column' ? 'py-1.5 text-[13px] leading-[1.4]' : 'py-2 text-[14.5px] leading-snug'} ${
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
        {open && <nav aria-label="On this page" className="max-h-[50vh] overflow-y-auto overscroll-contain pb-3">{list(() => setOpen(false))}</nav>}
      </div>
    )
  }

  return (
      <aside aria-label={hasList ? 'On this page' : 'Shop'} className={`hidden self-stretch lg:block ${BLOG_SIDE_CELL}`}>
        <div className="sticky top-[136px] flex max-h-[calc(100vh-152px)] flex-col gap-6 xl:top-[96px] xl:max-h-[calc(100vh-112px)]">
          {/* Boxed (Blog v2, like Eldorado's): the current section in the blog highlight colour. */}
          {hasList && (
            // min-h: on a short window the list keeps ~3 rows (it scrolls) rather than vanishing under the buy card.
            <div className={`blog-type ${BLOG_CARD} flex min-h-[180px] flex-col px-4 py-3.5`}>
              <p className="mb-1.5 text-[13px] font-bold text-text-primary">On This Page</p>
              <nav
                ref={listRef}
                className={`min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${more ? '[mask-image:linear-gradient(to_bottom,#000_calc(100%-36px),transparent)]' : ''}`}
              >
                {list()}
              </nav>
            </div>
          )}
          {rail && <div className="hidden shrink-0 xl:block">{rail}</div>}
        </div>
      </aside>
  )
}
