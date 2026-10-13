'use client'

/**
 * The cookie bar (Cookie Policy, "Your choices"): ONE compact row, text then
 * two equally weighted buttons, on phones too (owner, 2026-10-11: the old
 * two-row card was too big). Phones get the short sentence; wider screens
 * the full one. Shown once, to visitors who have not chosen and
 * whose browser does not send Global Privacy Control. The footer's "Cookie
 * Settings" reopens it. Nothing here blocks the page; ignoring it keeps the
 * visitor cookieless.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import AppLink from '@/components/navigation/AppLink'
import { analyticsEnabled, setAnalyticsConsent } from '@/lib/analytics/client'
import { CONSENT_REOPEN_EVENT, hasGlobalPrivacyControl, readConsent, writeConsent } from '@/lib/analytics/consent'

const BTN =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/[0.14] bg-white/[0.06] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:min-w-[84px]'

export function ConsentBanner() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!analyticsEnabled() || hasGlobalPrivacyControl()) return
    // Wait a beat after load so the bar never competes with first paint.
    const t = window.setTimeout(() => { if (readConsent() === null) setOpen(true) }, 1500)
    const reopen = () => { writeConsent(null); setOpen(true) }
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen)
    return () => { window.clearTimeout(t); window.removeEventListener(CONSENT_REOPEN_EVENT, reopen) }
  }, [])

  const choose = (value: 'granted' | 'denied') => {
    setAnalyticsConsent(value)
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="region"
          aria-label="Cookie choices"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-[680px] items-center gap-2 rounded-xl border border-white/[0.08] bg-[rgba(22,23,27,0.94)] py-2 pl-3.5 pr-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:bottom-5 sm:gap-3 sm:pl-4"
        >
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-text-secondary">
            We use cookies<span className="hidden sm:inline"> to see how people use DropMarket and fix what breaks</span>.{' '}
            <AppLink href="/cookies" className="font-medium text-text-primary underline underline-offset-2 sm:no-underline sm:hover:underline">
              Policy
            </AppLink>
          </p>
          <button type="button" onClick={() => choose('denied')} className={BTN}>
            Reject
          </button>
          <button type="button" onClick={() => choose('granted')} className={BTN}>
            Accept
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Footer link: reopens the bar so a visitor can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))}>
      Cookie Settings
    </button>
  )
}
