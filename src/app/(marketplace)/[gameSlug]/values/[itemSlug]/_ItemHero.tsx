'use client'

import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { formatCash, formatIncome, formatMultiplier } from '@/lib/sab/format'
import { mutationVisual, mutationOrder } from '@/lib/sab/mutations'
import { FreshnessBadge } from '@/lib/sab/FreshnessBadge'
import { MutationDot } from '@/lib/sab/MutationDot'
import { rarityMeta } from '@/lib/values/rarity'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueItemHero, HeroBadge, TrendChartPlaceholder } from '@/components/values/ValueItemHero'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'
import { VALUE_LABEL } from '@/components/values/styles'

// recharts is ~100KB and the chart sits below the fold (often just a
// "collecting data" state early on). Lazy-load it so it doesn't bloat the
// item page's initial JS / hurt INP. Client-only — recharts needs the DOM.
const PriceTrendChart = dynamic(
  () => import('@/components/values/PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false, loading: () => <TrendChartPlaceholder height={180} /> },
)

/** One daily median for a mutation (from sab_price_history). */
export type PricePoint = { date: string; median: number }

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
  /** DropMarket's own live stock for this brainrot (drives the buy button). */
  buy: { itemSlug: string; categorySlug: string; stock: ItemStock | null }
  /** Fallback price-updated timestamp (default mutation) for the freshness badge. */
  updatedAt: string | null
  /** Daily price history keyed by mutation slug (may be empty until it accrues). */
  priceHistory: Record<string, PricePoint[]>
}

const formatTrendCash = (v: number) => formatCash(v) ?? `$${v}`

/** Steal a Brainrot item hero: the shared ValueItemHero + SAB's mutation grid. */
export default function ItemHero({
  brainrotName,
  rarity,
  obtainability,
  baseIncomePerSecond,
  ingameCost,
  imageUrl,
  imageAlt,
  mutations,
  buy,
  updatedAt,
  priceHistory,
}: ItemHeroProps) {
  const ordered = useMemo(
    () => [...mutations].sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug)),
    [mutations],
  )
  const defaultSlug = ordered.find((m) => m.slug === 'default')?.slug ?? ordered[0]?.slug ?? ''
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

  // Chart series: every mutation, in display order, coloured as in-game.
  const series = useMemo(
    () =>
      ordered.map((m) => ({
        key: m.slug,
        name: m.name,
        color: mutationVisual(m.slug).color,
        points: (priceHistory[m.slug] ?? []).map((p) => ({ date: p.date, value: p.median })),
      })),
    [ordered, priceHistory],
  )

  // The button is DropMarket's own stock for this mutation, never the market
  // price above it (Bundle 2): three states, see value-listings/buy-state.
  const cta = useBuyCta({
    gameSlug: 'steal-a-brainrot',
    categorySlug: buy.categorySlug,
    itemSlug: buy.itemSlug,
    variant: selected?.slug ?? 'default',
    variantName: !selected || selected.slug === 'default' ? brainrotName : selected.name,
    stock: buy.stock,
    surface: 'value_item',
  })

  if (!selected) return null

  const visual = mutationVisual(selected.slug)
  const isDefault = selected.slug === 'default'
  // Mutation-driven name: "Diamond Garama and Madundung"; plain for Default.
  const displayName = isDefault ? brainrotName : `${selected.name} ${brainrotName}`
  // CHEAPEST is the headline — the price a buyer acts on. Stored values from the
  // 3h crawl (≤6h fresh); no per-view live fetch.
  const marketUsd = selected.averageUsd ?? selected.marketValueUsd
  const headlineUsd = selected.cheapestUsd ?? marketUsd
  const cash = formatCash(headlineUsd)

  return (
    <ValueItemHero
      anchorRef={heroRef}
      accent={visual.color}
      art={{ src: imageUrl, alt: imageAlt || `${displayName} Steal a Brainrot`, pixelated: true }}
      eyebrow={
        <>
          <MutationDot visual={visual} size={8} />
          {isDefault ? 'Default (no mutation)' : `${selected.name} mutation`}
        </>
      }
      title={displayName}
      meta={
        <>
          <span style={{ color: rarityMeta('steal-a-brainrot', rarity).color }}>{rarity}</span>
          <span aria-hidden className="text-text-disabled">
            ·
          </span>
          <span className="text-text-tertiary">{obtainability}</span>
        </>
      }
      // Fixed row set so the hero height never shifts between mutations.
      // (Cheapest lives in the price column, so it's not repeated here.)
      stats={[
        { label: 'Base Income', value: formatIncome(selected.calculatedIncomePerSecond ?? baseIncomePerSecond) },
        { label: 'Mutation', value: `${selected.name} · ${formatMultiplier(selected.multiplier)}` },
        { label: 'In-Game Cost', value: ingameCost ?? 'Unknown' },
      ]}
      price={{
        // Market data, not DropMarket stock: the buy button carries ours.
        label: 'Market Price',
        value: cash ?? 'No data yet',
        children: (
          <>
            <div className="mt-2 lg:flex lg:justify-end">
              <FreshnessBadge updatedAt={selected.marketUpdatedAt ?? updatedAt} />
            </div>
            {/* Only surface a note when the price is estimated or missing. */}
            {(selected.isEstimated || !cash) && (
              <div className="mt-1.5 flex min-h-[20px] flex-wrap items-center gap-2 lg:justify-end">
                {selected.isEstimated ? (
                  <HeroBadge color="var(--color-warning)">Estimated from multiplier</HeroBadge>
                ) : (
                  <span className="text-[12.5px] text-text-secondary">No priced listings yet</span>
                )}
              </div>
            )}
          </>
        ),
      }}
      actions={
        <ValueBuyActions
          cta={cta}
          itemName={displayName}
          sell={{ href: '/steal-a-brainrot/sell?src=sab-item-page', label: 'Sell Yours For Cash' }}
          align="end"
        />
      }
      // Mutation grid — pick a mutation, everything above updates. An EVEN grid
      // (not flex-wrap) so rows fill cleanly: 2 → 3 → 4 → 7 columns.
      picker={
        <>
          <p className={`${VALUE_LABEL} text-[12px]`}>Pick a Mutation — Everything Updates</p>
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
                  className={`flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-[background-color,color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    active ? '' : 'bg-bg-overlay text-text-secondary hover:bg-bg-overlay-2 hover:text-text-primary'
                  }`}
                  style={
                    active
                      ? { backgroundColor: `color-mix(in srgb, ${mv.color} 20%, var(--color-bg-overlay))`, color: mv.color }
                      : undefined
                  }
                >
                  <MutationDot visual={mv} size={10} />
                  <span className="truncate">{mutation.name}</span>
                </button>
              )
            })}
          </div>
        </>
      }
      // Combined price trend — the hero-selected mutation is pre-lit; toggle
      // legend chips to overlay/compare other mutations. Zoomed Y-axis.
      below={
        <PriceTrendChart
          mode="overlay"
          series={series}
          selectedKey={selected.slug}
          formatValue={formatTrendCash}
          seriesNoun="mutations"
          height={180}
          idPrefix="sab-trend"
          emptyBody={() =>
            "We snapshot each mutation's price every day. Trend lines appear once we have a few days of data."
          }
        />
      }
    />
  )
}
