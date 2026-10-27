'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { BUY_CTA_LABEL } from '@/lib/config/purchases'
import { fmtUsd } from './BuyBox'

/**
 * Phones: the Buy bar docked at the bottom while the buy box's own button is
 * off screen (owner, 2026-10-26), the listing page's bar: a solid strip that
 * pads itself over the home-indicator area. Hidden while the footer shows.
 */
export function PhoneBuyBar({
  visible,
  label,
  total,
  onBuy,
  navigating,
  isOwn,
}: {
  visible: boolean
  /** "Fly Ride Parrot" */
  label: string
  total: number
  onBuy: () => void
  navigating: boolean
  isOwn: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { y: 72 }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: 72 }}
          transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 44 }}
          className="fixed inset-x-0 bottom-0 z-40 bg-bg-raised px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(0,0,0,0.45)] sm:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-text-tertiary" style={{ fontSize: 'var(--fs-caption)' }}>
                {label}
              </div>
              <div className="font-bold tabular-nums leading-tight text-text-primary" style={{ fontSize: 'var(--fs-price)' }}>
                {fmtUsd(total)}
              </div>
            </div>
            <BuyButton onClick={onBuy} loading={navigating} loadingLabel="Loading…" size="md">
              {isOwn ? 'Edit Listing' : BUY_CTA_LABEL}
            </BuyButton>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
