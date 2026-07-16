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
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
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
      label: 'Connect Your Payout Method',
      href: '/account/wallet/connect',
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
      href: onboarding.shopNamed ? null : '/account/settings',
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-6 rounded-lg border border-border-subtle card-frost p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Get Started</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {completeCount} of {steps.length} Complete
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-bg-raised hover:text-text-secondary"
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </button>
        </div>

        <div className="space-y-1">
          {steps.map((step) => {
            const StepIcon = step.done ? CheckCircle2 : Circle
            const inner = (
              <>
                <StepIcon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    step.done ? 'text-lime-text' : 'text-text-disabled',
                  )}
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
                    copied ? <Check className="h-4 w-4 text-lime-text" /> : <Copy className="h-4 w-4 text-text-tertiary" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-text-tertiary" />
                  ))}
              </>
            )

            const rowCls =
              'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-bg-raised'

            // Share step with a named shop = copy-to-clipboard button.
            if (step.key === 'share' && shopUrl) {
              return (
                <button key={step.key} onClick={handleShare} className={rowCls} disabled={step.done}>
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
      </motion.div>
    </AnimatePresence>
  )
}
