'use client'

import Link from 'next/link'
import { Store, Clock, ArrowRight, Rocket } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

/**
 * Beta C — Single, reactive Become-a-Seller CTA.
 *
 * One component reads useAuth().user.sellerApplicationStatus so all three
 * placements (navbar dropdown, buyer dashboard, become-seller banner) stay in
 * lock-step and flip WITHOUT a refresh the moment the realtime channel in
 * use-auth.tsx delivers a status change:
 *   - none / withdrawn / rejected(-expired) → "Become a Seller" → /account/become-seller
 *   - pending / under_review / info_requested → "Application Pending" → /account/seller-status
 *   - approved → renders nothing (seller menu takes over)
 *
 * Two visual variants:
 *   - `menu`  — the compact dropdown row used in the navbar
 *   - `card`  — the standalone lime-on-dark CTA used on dashboards/banners
 */

type Variant = 'menu' | 'card'

interface BecomeSellerCtaProps {
  variant?: Variant
  /** Fired on navigation — lets the navbar close its dropdown. */
  onNavigate?: () => void
  className?: string
}

export default function BecomeSellerCta({
  variant = 'menu',
  onNavigate,
  className,
}: BecomeSellerCtaProps) {
  const { user } = useAuth()
  const status = user?.sellerApplicationStatus ?? null

  // Approved sellers never see this CTA — the seller menu replaces it.
  if (user?.isApprovedSeller || status === 'approved') return null

  // Founding accounts get their own entry pointing at the Founding HQ, instead
  // of the generic seller CTA. Two signals, either qualifies:
  //   - `is_founding_applicant`: their email is on the waitlist (routing only)
  //   - `founding_seller`: admin-granted (also carries the 2% fee perk)
  // Both are real profiles columns (useAuth selects '*').
  const p = user?.profile as { founding_seller?: boolean; is_founding_applicant?: boolean } | null
  const isFounding = Boolean(p?.is_founding_applicant || p?.founding_seller)
  if (isFounding) {
    if (variant === 'menu') {
      return (
        <Link
          href="/founding"
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary',
            className,
          )}
        >
          <Rocket className="h-[18px] w-[18px] text-lime-text" />
          Founding Seller
        </Link>
      )
    }
    return (
      <div className={cn('rounded-lg border border-lime-tint-border bg-white/[0.04] p-6', className)}>
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-lime-text" />
          <h3 className="font-bold text-white">Founding Seller</h3>
        </div>
        <p className="mb-4 text-sm text-text-secondary">Your founding-seller setup — status, next steps, and the door to start selling.</p>
        <Link
          href="/founding"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime/90"
        >
          Open Founding HQ
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const isPending =
    status === 'pending' || status === 'under_review' || status === 'info_requested'

  const href = isPending ? '/account/seller-status' : '/account/become-seller'

  if (variant === 'menu') {
    return isPending ? (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          'mb-1 flex items-center gap-3 rounded-lg border border-yellow-500/20 px-4 py-2 text-sm text-yellow-400 transition-colors hover:bg-yellow-500/10',
          className,
        )}
      >
        <Clock className="h-4 w-4" />
        Application Pending
      </Link>
    ) : (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          'mb-1 flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary',
          className,
        )}
      >
        <Store className="h-[18px] w-[18px] text-lime-text" />
        Become a Seller
      </Link>
    )
  }

  // card variant — lime-on-dark, no purple/violet gradients
  return (
    <div
      className={cn(
        'rounded-lg border border-lime-tint-border bg-white/[0.04] p-6',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Store className="h-5 w-5 text-lime-text" />
        <h3 className="font-bold text-white">
          {isPending ? 'Application Pending' : 'Become a Seller'}
        </h3>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        {isPending
          ? "Your seller application is under review. We'll email you the moment there's an update."
          : 'Start selling your gaming accounts and earn money with the lowest fees in the industry.'}
      </p>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime/90"
      >
        {isPending ? 'View Status' : 'Get Started'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
