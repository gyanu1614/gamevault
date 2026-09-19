'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { cn } from '@/lib/utils'
import { formatCash, formatIncome, formatMultiplier } from '@/lib/sab/format'
import { motion } from 'framer-motion'
import { mutationVisual, mutationOrder, shade } from '@/lib/sab/mutations'
import { sabHero } from '@/lib/sab/theme'
import { FreshnessBadge } from '@/lib/sab/FreshnessBadge'
import { MutationDot } from '@/lib/sab/MutationDot'
import dynamic from 'next/dynamic'
import { type PricePoint } from './_PriceTrendChart'

// recharts is ~100KB and the chart sits below the fold (often just a
// "collecting data" state early on). Lazy-load it so it doesn't bloat the
// item page's initial JS / hurt INP. Client-only — recharts needs the DOM.
const PriceTrendChart = dynamic(
  () => import('./_PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false },
)

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
  /**
   * Reputable-seller prices: cheapest (lowest 100+ review listing) and average
   * (typical). When present, the hero shows "Cheapest" + a headline "Market
   * price" (= average) instead of the raw value. Null until the reputable path
   * prices this mutation.
   */
  cheapestUsd?: number | null
  averageUsd?: number | null
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
  // CHEAPEST is the headline — the price a buyer acts on. Stored values from the
  // 3h crawl (≤6h fresh); no per-view live fetch.
  const marketUsd = selected.averageUsd ?? selected.marketValueUsd
  const cheapestUsd = selected.cheapestUsd
  // Headline = cheapest when we have it, else market.
  const headlineUsd = cheapestUsd ?? marketUsd
  const cash = formatCash(headlineUsd)
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

        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[176px_minmax(0,1fr)_240px] lg:items-center">
          {/* Art — floats on the hero, mutation-tinted glow behind it. */}
          <div
            className="mx-auto flex aspect-square w-36 items-center justify-center sm:w-40 lg:mx-0 lg:w-[176px]"
            style={{
              background: `radial-gradient(120% 120% at 50% 15%, ${visual.color}22, transparent 72%)`,
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={imageAlt || `${displayName} Steal a Brainrot`}
                className="h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)] [image-rendering:pixelated]"
              />
            ) : (
              <div className="text-[10px] text-[#3E6B52]">No image</div>
            )}
          </div>

          {/* Name + labeled stat rows with grey dividers. */}
          <div>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: visual.color }}
            >
              <MutationDot visual={visual} size={8} />
              {isDefault ? 'Default (no mutation)' : `${selected.name} mutation`}
            </span>
            <h1 className="mt-1.5 text-2xl font-semibold leading-[1.1] tracking-[-0.015em] text-[#F1F3F1] sm:text-[28px]">
              {displayName}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]">
              <span style={{ color: rarityColor(rarity) }}>{rarity}</span>
              <span className="text-[#3A423C]">·</span>
              <span className="text-[#5D6670]">{obtainability}</span>
            </p>

            {/* Fixed row set so the hero height never shifts between mutations.
                (Cheapest lives in the price column, so it's not repeated here.) */}
            <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              <StatRow label="Base income" value={formatIncome(selected.calculatedIncomePerSecond ?? baseIncomePerSecond)} />
              <StatRow label="Mutation" value={`${selected.name} · ${formatMultiplier(selected.multiplier)}`} />
              <StatRow label="In-game cost" value={ingameCost ?? 'Unknown'} />
            </dl>
          </div>

          {/* Price + CTA column. */}
          <div className="lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8FBF9C]">
              {cheapestUsd != null ? 'Cheapest price' : 'Market price'}
            </p>
            <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-[#F1F3F1] tabular-nums sm:text-[38px]">
              {cash ?? 'No data yet'}
            </p>
            {/* Freshness stamp — right under the price, like a receipt line. */}
            <div className="mt-2 lg:flex lg:justify-end">
              <FreshnessBadge updatedAt={selected.marketUpdatedAt ?? updatedAt} />
            </div>
            {/* Only surface a note when the price is estimated or missing — the
                clean priced case shows nothing extra. */}
            {(selected.isEstimated || !cash) && (
              <div className="mt-1 flex min-h-[20px] flex-wrap items-center gap-2 lg:justify-end">
                {selected.isEstimated ? (
                  <span className="inline-flex items-center gap-1.5 border border-[#3A3320] bg-[#2A2410]/40 px-2 py-0.5 text-[11px] font-semibold text-[#D9C27A]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D9C27A]" />
                    Estimated from multiplier
                  </span>
                ) : (
                  <span className="text-[12.5px] text-[#9BA8A0]">No priced listings yet</span>
                )}
              </div>
            )}

            {/* Buy — color-flowing gradient in the mutation hue, no chunky shadow. */}
            <Link
              href={listingHref}
              aria-label={`Buy ${displayName}`}
              className="group relative mt-4 inline-flex w-full items-center justify-center gap-1.5 overflow-hidden px-5 py-2.5 text-[13px] font-bold text-[#08110B] lg:w-auto"
              style={{
                background: `linear-gradient(110deg, ${shade(visual.color, -0.12)}, ${visual.color}, ${shade(visual.color, -0.12)})`,
                backgroundSize: '200% 100%',
              }}
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `linear-gradient(110deg, transparent 30%, ${shade(visual.color, 0.35)}66 50%, transparent 70%)` }}
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4 }}
              />
              {/* Price-led label stays short + one line even for long names. */}
              <span className="relative truncate whitespace-nowrap">
                {cash ? `Buy from ${cash}` : `Buy ${displayName}`}
              </span>
              <ArrowForwardIcon sx={{ fontSize: 17 }} className="relative shrink-0" />
            </Link>
            {/* Sell — same flowing style as Buy, in a fixed cash-green so the two
                actions read as distinct intents (green = cash out). */}
            <Link
              href="/steal-a-brainrot/sell?src=sab-item-page"
              aria-label={`Sell your ${displayName}`}
              className="group relative mt-2 inline-flex w-full items-center justify-center gap-1.5 overflow-hidden px-5 py-2.5 text-[13px] font-bold text-[#08110B] lg:w-auto"
              style={{
                background: 'linear-gradient(110deg, #2F8F57, #47C97C, #2F8F57)',
                backgroundSize: '200% 100%',
              }}
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(110deg, transparent 30%, #A6EFC466 50%, transparent 70%)' }}
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4 }}
              />
              <span className="relative truncate whitespace-nowrap">Sell Yours For Cash</span>
              <ArrowForwardIcon sx={{ fontSize: 15 }} className="relative shrink-0" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Mutation rail — pick a mutation, everything above updates. An EVEN
          grid (not flex-wrap) so rows always fill cleanly with no orphan chips:
          2 cols on mobile → 3 → 4 → 7 (14 mutations = two tidy rows of 7). ── */}
      <div>
        <p className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6D7A72]">
          Pick a mutation — everything updates
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {ordered.map((mutation) => {
            const mv = mutationVisual(mutation.slug)
            const active = mutation.slug === selected.slug
            return (
              <button
                key={mutation.slug}
                type="button"
                onClick={() => selectMutation(mutation.slug)}
                aria-pressed={active}
                className="flex min-w-0 items-center justify-center gap-2 border px-3 py-2.5 text-[13px] font-semibold transition hover:brightness-110"
                style={
                  active
                    ? { backgroundColor: mv.soft, borderColor: mv.color, color: mv.color }
                    : { backgroundColor: '#12171A', borderColor: '#232A2F', color: '#C3CCD4' }
                }
              >
                <MutationDot visual={mv} size={10} />
                <span className="truncate">{mutation.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Combined price trend — the hero-selected mutation is pre-lit; toggle
          legend chips to overlay/compare other mutations. Zoomed Y-axis. */}
      <PriceTrendChart
        selectedSlug={selected.slug}
        selectedName={selected.name}
        history={priceHistory}
        mutations={ordered.map((m) => ({ slug: m.slug, name: m.name }))}
      />
    </div>
  )
}

/** Rarity → accent, mirrors the value-list card colors. */
function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    Secret: '#E23B4E',
    'Brainrot God': '#FF8A3D',
    Mythic: '#A98BFF',
    Legendary: '#F5C542',
    Epic: '#7FE3F0',
    Rare: '#4FB477',
    Common: '#9BA8A0',
    OG: '#E7C6FF',
  }
  return map[rarity] ?? '#9BA8A0'
}

/** Labeled key/value row in the identity stat list. */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[14px]">
      <dt className="text-[#9BA8A0]">{label}</dt>
      <dd className="font-medium tabular-nums text-[#F1F3F1]">{value}</dd>
    </div>
  )
}
