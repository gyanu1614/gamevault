'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { cn } from '@/lib/utils'
import { formatCash, formatIncome, formatMultiplier } from '@/lib/sab/format'
import { motion } from 'framer-motion'
import { mutationVisual, mutationOrder, shade } from '@/lib/sab/mutations'
import { sabHero, sabInteractive } from '@/lib/sab/theme'
import { FreshnessBadge } from '@/lib/sab/FreshnessBadge'
import { MutationDot } from '@/lib/sab/MutationDot'
import { PriceTrendChart, type PricePoint } from './_PriceTrendChart'

export type MutationOption = {
  slug: string
  name: string
  multiplier: number
  availability: string
  calculatedIncomePerSecond: number | null
  incomeSource: string
  isVerifiedVariant: boolean
  marketValueUsd: number | null
  marketLowUsd: number | null
  marketHighUsd: number | null
  marketConfidenceLabel: string | null
  marketSampleSize: number
  marketUpdatedAt: string | null
  /** True when marketValueUsd is a derived estimate (no direct listings). */
  isEstimated?: boolean
}

interface ItemHeroProps {
  brainrotName: string
  rarity: string
  obtainability: string
  baseIncomePerSecond: number | null
  ingameCost: string | null
  imageUrl: string | null
  imageAlt: string | null
  mutations: MutationOption[]
  /** Base marketplace search URL for this brainrot. */
  listingsHref: string
  /** Fallback price-updated timestamp (default mutation) for the freshness badge. */
  updatedAt: string | null
  /** Daily price history keyed by mutation slug (may be empty until it accrues). */
  priceHistory: Record<string, PricePoint[]>
}

export default function ItemHero({
  brainrotName,
  rarity,
  obtainability,
  baseIncomePerSecond,
  ingameCost,
  imageUrl,
  imageAlt,
  mutations,
  listingsHref,
  updatedAt,
  priceHistory,
}: ItemHeroProps) {
  const ordered = useMemo(
    () => [...mutations].sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug)),
    [mutations],
  )
  const defaultSlug =
    ordered.find((m) => m.slug === 'default')?.slug ?? ordered[0]?.slug ?? ''
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug)
  const heroRef = useRef<HTMLDivElement>(null)

  // On mobile the chips sit far below the hero, so after picking a mutation
  // scroll the hero back into view so the updated price is visible.
  function selectMutation(slug: string) {
    setSelectedSlug(slug)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const selected = useMemo(
    () => ordered.find((m) => m.slug === selectedSlug) ?? ordered[0] ?? null,
    [ordered, selectedSlug],
  )

  if (!selected) return null

  const visual = mutationVisual(selected.slug)
  const isDefault = selected.slug === 'default'
  // Mutation-driven name: "Diamond Garama and Madundung"; plain for Default.
  const displayName = isDefault ? brainrotName : `${selected.name} ${brainrotName}`
  const cash = formatCash(selected.marketValueUsd)
  const low = formatCash(selected.marketLowUsd)
  const high = formatCash(selected.marketHighUsd)
  const range = low && high && low !== high ? `${low} – ${high}` : null
  const listingHref = `${listingsHref}${
    isDefault ? '' : `%20${encodeURIComponent(selected.name)}`
  }`

  return (
    <div className="space-y-4">
      {/* Hero — near-black card with a FLOWING mutation-tinted glow. The shared
          SAB backdrop image lives at the PAGE level (see page.tsx), not here. */}
      <div ref={heroRef} className={cn(sabHero, 'scroll-mt-20 bg-[#0E1211]/[0.94] backdrop-blur-sm')}>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-1/4 -top-1/2 h-[150%] w-[80%] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(closest-side, ${visual.color}22, transparent)`,
          }}
          animate={{ x: ['-6%', '10%', '-6%'], y: ['-4%', '6%', '-4%'], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
        />
        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[190px_minmax(0,1fr)_240px] lg:items-center">
          {/* Art — floats on the hero, larger, no nested border box */}
          <div className="mx-auto aspect-square w-40 overflow-hidden sm:w-44 lg:mx-0 lg:w-[190px]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={imageAlt || `${displayName} Steal a Brainrot`}
                className="h-full w-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.55)]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-[#3E6B52]">
                No image
              </div>
            )}
          </div>

          {/* Name + labeled stat rows with grey dividers (currency-CTA pattern) */}
          <div>
            {/* Always shown (Default too) so the hero height never shifts
                when switching mutations. */}
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: visual.color }}
            >
              <MutationDot visual={visual} size={8} />
              {isDefault ? 'Default (no mutation)' : `${selected.name} mutation`}
            </span>
            <h1 className="mt-2 text-2xl font-semibold leading-[1.15] tracking-[-0.01em] text-[#F1F3F1] sm:text-[30px]">
              {displayName}
            </h1>

            {/* Fixed set of rows — always the same count so the hero height
                never changes between mutations, even when data is missing. */}
            <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              <StatRow label="Base income" value={formatIncome(baseIncomePerSecond)} />
              <StatRow label="Mutation" value={`${selected.name} · ${formatMultiplier(selected.multiplier)}`} />
              <StatRow label="In-game cost" value={ingameCost ?? 'Unknown'} />
              <StatRow label="Market range" value={range ?? '—'} />
            </dl>
          </div>

          {/* Price + CTA float — no box, aligns with the currency Buy Now cards */}
          <div className="lg:text-right">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: visual.color }}
            >
              {selected.name} cash price
            </p>
            <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-[#F1F3F1] tabular-nums">
              {cash ?? 'No data yet'}
            </p>
            {/* Fixed-height row so the column doesn't resize between a priced
                mutation (badge) and an unpriced one (note). */}
            <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
              {selected.isEstimated ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#3A3320] bg-[#2A2410]/40 px-2 py-1 text-[11.5px] font-semibold text-[#D9C27A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D9C27A]" />
                  Estimated from multiplier
                </span>
              ) : cash ? (
                <ConfidenceBadge label={selected.marketConfidenceLabel ?? 'low'} />
              ) : (
                <span className="text-[13px] text-[#9BA8A0]">No priced listings yet</span>
              )}
            </div>
            <Link
              href={listingHref}
              className="group mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-bold text-black transition-transform duration-100 active:translate-y-0.5 lg:w-auto"
              style={{
                backgroundColor: visual.color,
                boxShadow: `0 4px 0 0 ${shade(visual.color, -0.35)}, 0 10px 20px -6px ${visual.color}66`,
              }}
            >
              Buy Now
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </Link>
          </div>
        </div>

        {/* Freshness signal — centered at the hero bottom */}
        <div className="relative flex items-center justify-center border-t border-white/[0.06] px-5 py-3">
          <FreshnessBadge updatedAt={selected.marketUpdatedAt ?? updatedAt} />
        </div>
      </div>

      {/* Mutation chips float directly on the page — no wrapping card, so we
          never nest bordered box-in-box. */}
      <div>
        <p className="px-1 text-sm font-medium text-[#F1F3F1]">
          Cash price by mutation{' '}
          <span className="font-normal text-[#6D7A72]">— tap to update the price above</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((mutation) => {
            const mv = mutationVisual(mutation.slug)
            const active = mutation.slug === selected.slug
            const price = formatCash(mutation.marketValueUsd)
            return (
              <button
                key={mutation.slug}
                type="button"
                onClick={() => selectMutation(mutation.slug)}
                aria-pressed={active}
                className={cn(
                  'group flex min-h-[48px] items-center gap-2 px-3 py-2 text-left',
                  sabInteractive,
                  active && 'ring-2',
                )}
                style={active ? ({ ['--tw-ring-color' as string]: mv.color } as React.CSSProperties) : undefined}
              >
                <MutationDot visual={mv} size={10} />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: active ? mv.color : '#D6DCD8' }}
                  >
                    {mutation.name}
                  </span>
                </span>
                <span className="text-right text-xs font-medium text-[#9BA8A0]">
                  {price ?? formatMultiplier(mutation.multiplier)}
                  {mutation.isEstimated && price && (
                    <span className="ml-1 text-[10px] text-[#6D7A72]">est</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Price trend for the selected mutation — follows the chip selection. */}
      <PriceTrendChart
        mutationSlug={selected.slug}
        mutationName={selected.name}
        points={priceHistory[selected.slug] ?? []}
      />
    </div>
  )
}

function ConfidenceBadge({ label }: { label: string }) {
  const tone =
    label === 'high'
      ? { fg: '#4FB477', bg: 'rgba(79,180,119,0.12)', bd: 'rgba(79,180,119,0.3)' }
      : label === 'medium'
        ? { fg: '#E0B155', bg: 'rgba(224,177,85,0.12)', bd: 'rgba(224,177,85,0.3)' }
        : { fg: '#9BA8A0', bg: 'rgba(155,168,160,0.1)', bd: 'rgba(155,168,160,0.25)' }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold capitalize"
      style={{ color: tone.fg, backgroundColor: tone.bg, border: `1px solid ${tone.bd}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.fg }} />
      {label} confidence
    </span>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-[#9BA8A0]">{label}</dt>
      <dd className="font-medium tabular-nums text-[#F1F3F1]">{value}</dd>
    </div>
  )
}
