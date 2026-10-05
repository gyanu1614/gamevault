'use client'

import Link from '@/components/navigation/AppLink'
import { Store, ArrowRight, Rocket } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { StorefrontIcon, ClockIcon, RocketLaunchIcon } from '@phosphor-icons/react'
import { navMenuIconCls, navMenuRowCls } from '@/components/navbar/NavChrome'

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

/** Account card surface with the order page's lime-tint fill, no outline. */
const CARD_CLS =
  'rounded-lg bg-bg-raised bg-gradient-to-b from-[rgba(86,184,127,0.10)] to-[rgba(86,184,127,0.02)] p-5 sm:p-6'

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
          className={cn(navMenuRowCls, className)}
        >
          <RocketLaunchIcon size={18} weight="bold" aria-hidden className={navMenuIconCls} />
          Founding Seller
        </Link>
      )
    }
    return (
      <div className={cn(CARD_CLS, className)}>
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-lime-text" />
          <h3 className="text-[15px] font-semibold text-text-primary">Founding Seller</h3>
        </div>
        <p className="mb-4 text-sm text-text-secondary">Your founding-seller setup — status, next steps, and the door to start selling.</p>
        <Link
          href="/founding"
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-md bg-lime px-4 text-[13px] font-semibold text-text-inverse transition-[background-color,transform] hover:bg-lime-hover active:scale-[0.98]"
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
        className={cn(navMenuRowCls, className)}
      >
        <ClockIcon size={18} weight="bold" aria-hidden className="shrink-0 text-amber-400" />
        Application Pending
      </Link>
    ) : (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(navMenuRowCls, className)}
      >
        <StorefrontIcon size={18} weight="bold" aria-hidden className={navMenuIconCls} />
        Become a Seller
      </Link>
    )
  }

  // card variant — lime-on-dark, no purple/violet gradients
  return (
    <div className={cn(CARD_CLS, className)}>
      <div className="mb-3 flex items-center gap-2">
        <Store className="h-5 w-5 text-lime-text" />
        <h3 className="text-[15px] font-semibold text-text-primary">
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
        className="flex h-10 items-center justify-center gap-2 rounded-md bg-lime px-4 text-[13px] font-semibold text-text-inverse transition-[background-color,transform] hover:bg-lime-hover active:scale-[0.98]"
      >
        {isPending ? 'View Status' : 'Get Started'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
