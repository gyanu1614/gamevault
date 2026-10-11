'use client'

import { Clock, X as IconX } from 'lucide-react'
import { type SellerPublishPolicy } from '@/lib/actions/sell-wizard'

// ─── PolicyBanner — D1 moderation/cap status at the top of Step 3 ───────────

/**
 * D1 — Surfaces the seller's tier, moderation status, and active-listing
 * cap at the top of Step 3 so they know what to expect BEFORE they hit
 * Create Offer. Three states:
 *   1. needs_moderation  → amber  "Your first N listings need review."
 *   2. at_listing_limit  → red    "You're at your cap — pause one first."
 *   3. otherwise         → lime   "Auto-publishing as <Tier>."
 */
/**
 * Action-required states (cap reached, needs moderation) keep a small
 * banner so the seller can't miss them. The default "auto-publishing"
 * case is rendered as a tiny status footer beneath the Create Offer
 * button instead (see `<PolicyStatusFooter/>` below).
 */
export function PolicyBanner({ policy }: { policy: SellerPublishPolicy | null }) {
  if (!policy) return null

  if (policy.at_listing_limit) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-error)_40%,transparent)] bg-error-bg px-3 py-2.5">
        <IconX className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={3} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-error">
            At your listing cap ({policy.listing_limit}).
          </span>{' '}
          <span className="text-text-secondary">
            Pause one of your existing listings, or level up your tier.
          </span>
        </div>
      </div>
    )
  }

  if (policy.needs_moderation) {
    const remaining = Math.max(
      0,
      policy.pre_moderation_listings - policy.approved_listings,
    )
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-warning-bg px-3 py-2.5">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.5} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-warning">
            New seller — {remaining} review{remaining === 1 ? '' : 's'} left.
          </span>{' '}
          <span className="text-text-secondary">
            Your first {policy.pre_moderation_listings} listings are reviewed by our team before going live.
          </span>
        </div>
      </div>
    )
  }

  // Default ok state is NOT rendered here — see PolicyStatusFooter below.
  return null
}
