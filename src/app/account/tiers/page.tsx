/**
 * /account/tiers — Seller Tier Comparison Page
 *
 * Shows:
 *  1. Current tier + commission rate summary (top hero)
 *  2. Progress bars toward the next tier
 *  3. Full comparison grid of all 6 tiers
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, TrendingUp, Shield, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAllTierConfigs, getMyTierInfo } from '@/lib/actions/seller-tiers'
import TierBadge from '@/components/seller/tiers/TierBadge'
import TierCard, { type TierConfig } from '@/components/seller/tiers/TierCard'
import TierProgressBar from '@/components/seller/tiers/TierProgressBar'

export const metadata: Metadata = {
  title: 'Seller Tiers | GameVault',
  description: 'Understand your seller tier, commission rate, and how to level up.',
}

export default async function SellerTiersPage() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account/tiers')

  // ── Data ────────────────────────────────────────────────────────────────────
  const [allTiers, myData] = await Promise.all([
    getAllTierConfigs(),
    getMyTierInfo(),
  ])

  const currentTier = (myData?.tierInfo.current_tier ?? 'unverified') as string
  const eligibleTier = (myData?.tierInfo.eligible_tier ?? currentTier) as string
  const commissionPct = myData
    ? (myData.tierInfo.commission_rate * 100).toFixed(1)
    : '9.9'
  const listingLimit = myData?.tierInfo.listing_limit ?? 5

  // Build next-tier requirement object for TierProgressBar
  const nextTierConfig = myData?.tierInfo.next_tier
    ? (allTiers.find((t: TierConfig) => t.tier === myData.tierInfo.next_tier) ?? null)
    : null

  const nextTierForProgress = nextTierConfig
    ? {
        tier: nextTierConfig.tier,
        displayName: nextTierConfig.display_name,
        minSales: nextTierConfig.min_sales,
        minRating: nextTierConfig.min_rating,
        minAgeDays: nextTierConfig.min_age_days,
        minCompletionRate: nextTierConfig.min_completion_rate,
      }
    : null

  return (
    <div className="min-h-screen bg-black">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <Link
            href="/account/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Seller Tiers</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Complete more sales and maintain great ratings to earn lower commission rates.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 space-y-10">

        {/* ── Hero: current tier ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                Your Current Tier
              </p>
              <TierBadge tier={currentTier} size="md" />
              {eligibleTier !== currentTier && (
                <p className="mt-2 text-xs text-emerald-400">
                  You qualify for <strong>{eligibleTier}</strong> — upgrade runs daily at 3 AM UTC
                </p>
              )}
            </div>
            <div className="flex gap-6 sm:gap-8">
              <Stat label="Commission rate" value={`${commissionPct}%`} icon={<TrendingUp className="w-4 h-4" />} />
              <Stat
                label="Listing limit"
                value={listingLimit === null ? 'Unlimited' : String(listingLimit)}
                icon={<Zap className="w-4 h-4" />}
              />
              <Stat
                label="Completed sales"
                value={String(myData?.stats.totalSales ?? 0)}
                icon={<Shield className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>

        {/* ── Progress toward next tier ───────────────────────────────────── */}
        {myData && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <TierProgressBar
              stats={myData.stats}
              nextTier={nextTierForProgress}
            />
          </div>
        )}

        {/* ── Tier comparison grid ────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-4">
            All Tiers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allTiers.map((tier: TierConfig) => (
              <TierCard
                key={tier.tier}
                config={tier}
                isCurrent={tier.tier === currentTier}
                isEligible={tier.tier === eligibleTier && tier.tier !== currentTier}
              />
            ))}
          </div>
        </div>

        {/* ── How upgrades work ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">How tier upgrades work</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2">
              <span className="text-violet-400 flex-shrink-0">•</span>
              Tiers are checked automatically every day at 3 AM UTC.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400 flex-shrink-0">•</span>
              Upgrades are permanent — tiers never decrease once earned.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400 flex-shrink-0">•</span>
              Your new commission rate applies to all orders placed after the upgrade.
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400 flex-shrink-0">•</span>
              Completion rate is calculated from non-cancelled/refunded orders only.
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}

// ── Small stat cell ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="flex items-center gap-1.5 text-zinc-500 mb-0.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  )
}
