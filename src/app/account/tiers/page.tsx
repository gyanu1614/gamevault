/**
 * /account/tiers — Seller Ranks.
 *
 * Single-viewport composition (desktop): one compact header row with the
 * current rank + 90-day stats, the 5 rank columns side by side, one progress
 * strip, one footnote line. Rectangular checkout-modal surfaces throughout —
 * flat near-black panels, hairline borders, rounded-lg max, no scroll needed
 * on a laptop screen. Mobile stacks and scrolls naturally.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAllTierConfigs, getMyTierInfo } from '@/lib/actions/seller-tiers'
import { DEFAULT_TIER, tierLabel } from '@/lib/seller/tiers'
import TierBadge from '@/components/seller/tiers/TierBadge'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import RankCarousel from '@/components/seller/tiers/RankCarousel'
import type { TierConfig } from '@/components/seller/tiers/TierCard'
import TierProgressBar from '@/components/seller/tiers/TierProgressBar'

export const metadata: Metadata = {
  title: 'Seller Ranks',
  description: 'Understand your seller rank, fee discount, and how to level up.',
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

  const tierInfo = myData?.tierInfo ?? null
  const currentTier = tierInfo?.current_tier ?? DEFAULT_TIER
  const eligibleTier = tierInfo?.eligible_tier ?? currentTier
  const feeDiscountPct = Math.round((1 - (tierInfo?.fee_multiplier ?? 1)) * 100)
  const windowGmv = tierInfo?.window_gmv ?? 0
  const windowOrders = tierInfo?.window_orders ?? 0
  const strikes = tierInfo?.tier_strikes ?? 0

  return (
    // Screen-fit composition, natural height (no forced min-h, no dead
    // scroll). The rank rail is an Embla slider, so the standard max-w-7xl
    // container is back — cards get generous width from sliding, not squeezing.
    <div className="relative overflow-hidden">
      {/* Ambient lime glow — lifts the page off flat black (homepage direction). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-[12%] h-[360px] w-[640px] rounded-full bg-lime/[0.07] blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[6%] top-[45%] h-[300px] w-[520px] rounded-full bg-lime/[0.04] blur-[130px]"
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Header row: title + current rank + 90-day stats ────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <Link
              href="/account/dashboard"
              className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-white sm:text-2xl">Seller Ranks</h1>
              <TierBadge tier={currentTier} size="sm" />
            </div>
            <p className="mt-1 text-[12.5px] text-zinc-400">
              Sell more, pay less. Ranks track your last 90 days.
            </p>
          </div>

          <div className="flex items-stretch divide-x divide-border-subtle rounded-lg border border-border-subtle bg-gradient-to-b from-[#121212] to-[#0c0c0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center px-4">
              <SellerTierBadge tier={currentTier} size={44} />
            </div>
            <Stat label="Fee Discount" value={feeDiscountPct === 0 ? 'Base' : `${feeDiscountPct}% Off`} />
            <Stat label="Sales · 90d" value={`$${Math.round(windowGmv).toLocaleString()}`} />
            <Stat label="Orders · 90d" value={String(windowOrders)} />
          </div>
        </div>

        {/* ── Notices ─────────────────────────────────────────────────────── */}
        {eligibleTier !== currentTier && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2 text-[12px] text-emerald-300">
            <b className="font-semibold">{tierLabel(eligibleTier)} unlocked.</b> Applies at the next
            daily check.
          </div>
        )}
        {strikes > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2 text-[12px] text-amber-300">
            <b className="font-semibold">Rank at risk.</b> One more slow month and you drop down.
          </div>
        )}

        {/* ── Rank rail: draggable, center-snapped, opens on your rank ────── */}
        <RankCarousel
          tiers={allTiers as TierConfig[]}
          currentTier={currentTier}
          eligibleTier={eligibleTier}
        />

        {/* ── Progress strip ──────────────────────────────────────────────── */}
        {/* Floating — no panel; the bars sit directly on the page. */}
        {tierInfo && <TierProgressBar tierInfo={tierInfo} className="pt-1" />}

        {/* ── Footnote: three facts, scannable ────────────────────────────── */}
        <div className="flex flex-wrap gap-x-8 gap-y-1.5 pb-1 text-[11.5px] text-zinc-400">
          <span>
            <b className="font-semibold text-zinc-200">Rank up:</b> automatic, checked daily
          </span>
          <span>
            <b className="font-semibold text-zinc-200">Rank down:</b> only after 2 slow months
          </span>
          <span>
            <b className="font-semibold text-zinc-200">Top-Ups:</b> always the standard fee
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Compact stat cell ───────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[104px] flex-col justify-center px-4 py-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-[15px] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  )
}
