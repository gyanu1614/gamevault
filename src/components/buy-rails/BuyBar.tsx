'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import CloseRounded from '@mui/icons-material/CloseRounded'
import StorefrontRounded from '@mui/icons-material/StorefrontRounded'
import { RailButton } from './RailButton'
import { track } from '@/lib/analytics/client'
import { safeSession } from '@/lib/safe-storage'
import { barVisible, type RailCard, type RailSurface } from '@/lib/buy-rails/model'
import { useSellHref } from './useSellHref'

/**
 * The phone + tablet buy bar (<1280px): one slim bar docked at the bottom —
 * thumbnail · name · "N offers from $X" · one button.
 *
 *   mode 'immediate'  value pages: shows at once.
 *   mode 'scroll'     blog posts: slides up after a third of the page and has
 *                     a close (x) that hides it for the rest of the session.
 *
 * Hides while the site footer is on screen (`[data-site-footer]`) and while a
 * text field has focus (the keyboard is up). An in-flow spacer of the bar's
 * height sits where the component is mounted (just above the footer), so the
 * bar never covers the last of the content. Motion: a critically damped
 * spring up from / back down to the bottom edge (same path both ways,
 * interruptible); reduced motion → a short cross-fade.
 */
const DISMISS_KEY = (surface: RailSurface) => `dm-buybar-closed:${surface}`
const DESKTOP = '(min-width: 1280px)'

function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true
  return t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'reset', 'file', 'color'].includes(t.type)
}

export function BuyBar({
  card,
  surface,
  mode,
  closable = false,
}: {
  card: RailCard
  surface: RailSurface
  mode: 'immediate' | 'scroll'
  closable?: boolean
}) {
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [scrolled, setScrolled] = useState(0)
  const [footerInView, setFooterInView] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const viewed = useRef(false)
  const sell = useSellHref(card, `bar-${surface}`)
  const href = card.variant === 'sell' ? sell : card.href
  const props = { surface, position: 'bar' as const, game: card.game, item: card.item, variant: card.variant }

  useEffect(() => {
    // Storage blocked → the bar just shows (safeSession never throws).
    if (closable && safeSession.get(DISMISS_KEY(surface)) === '1') setDismissed(true)
    const mq = window.matchMedia(DESKTOP)
    const onMq = () => setDesktop(mq.matches)
    onMq()
    mq.addEventListener('change', onMq)
    setReady(true)
    return () => mq.removeEventListener('change', onMq)
  }, [closable, surface])

  useEffect(() => {
    if (mode !== 'scroll') return
    let frame = 0
    const measure = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(max > 0 ? window.scrollY / max : 1)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [mode])

  useEffect(() => {
    const footer = document.querySelector('[data-site-footer]')
    if (!footer || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => setFooterInView(entries.some((e) => e.isIntersecting)))
    io.observe(footer)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onIn = (e: FocusEvent) => setInputFocused(isTextField(e.target))
    const onOut = () => setInputFocused(false)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])

  const show = ready && !desktop && barVisible({ mode, scrolled, footerInView, inputFocused, dismissed })

  useEffect(() => {
    if (show && !viewed.current) {
      viewed.current = true
      track('rail_viewed', props)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  // While the bar is up, keyboard focus / anchor jumps stop above it instead
  // of landing underneath (sticky UI must not cover the focused element).
  useEffect(() => {
    if (!show) return
    const root = document.documentElement
    const before = root.style.scrollPaddingBottom
    root.style.scrollPaddingBottom = 'calc(92px + env(safe-area-inset-bottom))'
    return () => {
      root.style.scrollPaddingBottom = before
    }
  }, [show])

  const close = () => {
    setDismissed(true)
    // Storage blocked → closed for this page view only.
    safeSession.set(DISMISS_KEY(surface), '1')
  }

  // Slide by `bottom`, not a transform: iOS 26 Safari extends the bar's colour
  // under its floating toolbar only for a bar sitting on the bottom edge, and
  // a transformed one is skipped (owner, 2026-10-12: the page showed under it).
  const hidden = reduce ? { opacity: 0 } : { bottom: -180 }
  const shown = reduce ? { opacity: 1 } : { bottom: 0 }

  return (
    <>
      {/* Reserves the bar's height above the footer so it never covers content. */}
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] xl:hidden" />
      {/* Portalled to <body>: iOS 26 Safari paints its floating toolbar in the
          bar's colour only for a fixed bar at the page's top level — nested in
          the page's stacking layers (the marketplace layout's isolate, the
          hero's z-20) it was skipped and the page showed under it (owner,
          2026-10-12, proven on a real iPhone: same bar top-level vs nested). */}
      {ready &&
        createPortal(
        <AnimatePresence initial={false}>
          {show && (
            <motion.aside
              key="buy-bar"
              aria-label={card.title}
              initial={hidden}
              animate={shown}
              exit={hidden}
              transition={reduce ? { duration: 0.2 } : { type: 'spring', bounce: 0, duration: 0.35 }}
              // Rounded top and room to breathe (owner, 2026-10-12).
              className="fixed inset-x-0 bottom-0 z-40 rounded-t-[16px] border-t border-white/[0.08] bg-[#1D1E23] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_32px_-16px_rgba(0,0,0,0.7)] xl:hidden"
            >
              <div className="mx-auto flex max-w-3xl items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#24252B]">
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image.src}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className={card.kind === 'items' ? 'h-full w-full object-cover' : 'h-10 w-10 object-contain'}
                    />
                  ) : (
                    <StorefrontRounded aria-hidden style={{ fontSize: 20 }} className="text-[#9A9DA6]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold leading-tight text-white">{card.variant === 'sell' ? card.title : card.name}</p>
                  <p className="mt-0.5 truncate text-body-sm tabular-nums text-[#9A9DA6]">{card.summary}</p>
                </div>
                <RailButton href={href} onClick={() => track('rail_clicked', props)} className="h-11 shrink-0 px-5 text-body-sm">
                  {card.cta}
                </RailButton>
                {closable && (
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="-mr-2 flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[6px] text-[#9A9DA6] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <CloseRounded aria-hidden style={{ fontSize: 20 }} />
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
