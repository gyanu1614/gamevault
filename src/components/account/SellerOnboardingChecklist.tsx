'use client'

/**
 * Seller "Get Started" onboarding checklist.
 *
 * A dismissible card shown at the top of the seller dashboard for new sellers.
 * Every step reflects a REAL completion signal computed by getSellerDashboard
 * (payout connected, ≥1 listing, delivery times set, shop named) — no fake
 * checkmarks. Auto-hides once all four are complete, and stays dismissed via a
 * per-user localStorage key.
 */

import { useEffect, useState } from 'react'
import Link from '@/components/navigation/AppLink'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Circle, X, Copy, Check, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import type { OnboardingSignals } from '@/lib/actions/seller-dashboard-v2'
import { cn } from '@/lib/utils'

const SHARE_KEY = (id: string) => `dm-seller-onboarding-shared:${id}`
const DISMISS_KEY = (id: string) => `dm-seller-onboarding-dismissed:${id}`

export default function SellerOnboardingChecklist({
  onboarding,
  userId,
}: {
  onboarding: OnboardingSignals
  userId: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [shared, setShared] = useState(false)
  const [copied, setCopied] = useState(false)
  const reduceMotion = useReducedMotion()

  // SSR-safe: read localStorage only after mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.localStorage.getItem(DISMISS_KEY(userId)) === '1')
    setShared(window.localStorage.getItem(SHARE_KEY(userId)) === '1')
  }, [userId])

  const shopUrl = onboarding.shopSlug ? `https://dropmarket.gg/shop/${onboarding.shopSlug}` : null

  const steps = [
    {
      key: 'payout',
      label: 'Add Your Payout Details',
      href: '/account/settings?tab=payouts',
      done: onboarding.payoutConnected,
    },
    {
      key: 'listing',
      label: 'Create Your First Listing',
      href: '/sell/new',
      done: onboarding.hasListing,
    },
    {
      key: 'delivery',
      label: 'Set Your Delivery Times',
      href: '/account/listings',
      done: onboarding.deliveryTimesSet,
    },
    {
      key: 'share',
      label: 'Share Your Shop',
      // Once named, this is a copy action; otherwise it links to name the shop.
      href: onboarding.shopNamed ? null : '/account/settings?tab=seller',
      done: onboarding.shopNamed && shared,
    },
  ]

  const completeCount = steps.filter((s) => s.done).length
  const allDone = completeCount === steps.length

  // Auto-hide when everything is genuinely complete.
  if (dismissed || allDone) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') window.localStorage.setItem(DISMISS_KEY(userId), '1')
  }

  const handleShare = async () => {
    if (!shopUrl) return
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      setShared(true)
      if (typeof window !== 'undefined') window.localStorage.setItem(SHARE_KEY(userId), '1')
      toast.success('Shop link copied', { description: shopUrl })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy the link', { description: 'Copy it manually from your shop page.' })
    }
  }

  const pct = Math.round((completeCount / steps.length) * 100)

  return (
    <section className="overflow-hidden rounded-lg bg-bg-raised">
      <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-text-primary">Get Started</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            {completeCount} of {steps.length} Complete
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          // ≥36px tap target: dismissal is sticky (localStorage).
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-secondary"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Dismiss
        </button>
      </div>

      <div className="mx-5 h-1 overflow-hidden rounded-full bg-white/[0.07] sm:mx-6" aria-hidden>
        {/* scaleX, not width: compositor-only, and still under reduced motion. */}
        <motion.div
          className="h-full origin-left rounded-full bg-lime"
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="grid gap-1 p-3 sm:grid-cols-2 sm:px-4">
        {steps.map((step) => {
          const StepIcon = step.done ? CheckCircle2 : Circle
          const inner = (
            <>
              <StepIcon
                className={cn('h-5 w-5 shrink-0', step.done ? 'text-lime-text' : 'text-text-disabled')}
                aria-hidden
              />
              <span
                className={cn(
                  'flex-1 text-sm font-medium',
                  step.done ? 'text-text-tertiary line-through' : 'text-text-primary',
                )}
              >
                {step.label}
              </span>
              {!step.done &&
                (step.key === 'share' && shopUrl ? (
                  copied ? <Check className="h-4 w-4 text-lime-text" aria-hidden /> : <Copy className="h-4 w-4 text-text-tertiary" aria-hidden />
                ) : (
                  <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden />
                ))}
            </>
          )

          const rowCls =
            'group flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-white/[0.05] disabled:hover:bg-transparent'

          // Share step with a named shop = copy-to-clipboard button.
          if (step.key === 'share' && shopUrl) {
            return (
              <button key={step.key} type="button" onClick={handleShare} className={rowCls} disabled={step.done}>
                {inner}
              </button>
            )
          }

          // Everything else (and the un-named share fallback) is a link.
          return (
            <Link key={step.key} href={step.href ?? '/account/settings'} className={rowCls}>
              {inner}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
