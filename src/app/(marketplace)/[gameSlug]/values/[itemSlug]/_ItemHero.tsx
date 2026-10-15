'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { formatCash, formatIncome, formatMultiplier } from '@/lib/sab/format'
import { mutationVisual, mutationOrder } from '@/lib/sab/mutations'
import { FreshnessBadge } from '@/lib/sab/FreshnessBadge'
import { MutationDot } from '@/lib/sab/MutationDot'
import { rarityMeta } from '@/lib/values/rarity'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueItemHero, HeroBadge, TrendChartPlaceholder } from '@/components/values/ValueItemHero'
import { ValueBuyPanel } from '@/components/values/ValueBuyPanel'
import { VariantSelector } from '@/components/values/VariantSelector'
import { mutationGroup } from '@/lib/values/variant-selector'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'

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

  // Deep links from the values directory carry ?mutation=<slug>: open the
  // hero (and the chart) on that mutation. Read after hydration through the
  // bridge so the page stays static.
  const onParams = useCallback(
    (params: URLSearchParams) => {
      const slug = params.get('mutation')
      if (slug && ordered.some((m) => m.slug === slug)) setSelectedSlug(slug)
    },
    [ordered],
  )

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
  // Market = the typical reputable price (stored from the 3h crawl, ≤6h
  // fresh; no per-view live fetch). The panel leads with OUR price when we
  // have this mutation and keeps the market as its reference.
  const marketUsd = selected.averageUsd ?? selected.marketValueUsd

  return (
    <ValueItemHero
      titleAs="h2"
      anchorRef={heroRef}
      accent={visual.color}
      art={{ src: imageUrl, alt: imageAlt || `${displayName} Steal a Brainrot`, pixelated: true }}
      title={displayName}
      // Fixed row set so the hero height never shifts between mutations.
      // (Cheapest lives in the price column, so it's not repeated here.)
      stats={[
        { label: 'Type', value: 'Brainrot' },
        { label: 'Rarity', value: <span style={{ color: rarityMeta('steal-a-brainrot', rarity).color }}>{rarity}</span> },
        { label: 'Base Income', value: formatIncome(selected.calculatedIncomePerSecond ?? baseIncomePerSecond) },
        { label: 'Mutation', value: `${selected.name} · ${formatMultiplier(selected.multiplier)}` },
        { label: 'In-Game Cost', value: ingameCost ?? 'Unknown' },
      ]}
      panel={
        <ValueBuyPanel
          cta={cta}
          itemName={displayName}
          marketUsd={marketUsd}
          cheapestUsd={selected.cheapestUsd ?? null}
          // Only surface a note when the market price is estimated or missing.
          notes={
            (selected.isEstimated || marketUsd == null) && (
              <div className="mt-2 flex min-h-[20px] flex-wrap items-center gap-2 lg:justify-end">
                {selected.isEstimated ? (
                  <HeroBadge color="var(--color-warning)">Estimated From Multiplier</HeroBadge>
                ) : (
                  <span className="text-[12.5px] text-text-secondary">No priced listings yet</span>
                )}
              </div>
            )
          }
          sell={{ href: '/steal-a-brainrot/sell?src=sab-item-page' }}
        />
      }
      footer={<FreshnessBadge updatedAt={selected.marketUpdatedAt ?? updatedAt} />}
      // The universal selector: every mutation of this brainrot, its colour and
      // a swipeable strip (14 mutations), the pill slides to the pick; the
      // price shows in the hero on select, not on every option.
      picker={
        <VariantSelector
          groups={[
            mutationGroup(
              ordered.map((m) => ({
                slug: m.slug,
                name: m.name,
                color: mutationVisual(m.slug).color,
              })),
              selected.slug,
              (n) => formatCash(n) ?? '',
            ),
          ]}
          onSelect={(_, slug) => selectMutation(slug)}
          labels={false}
        />
      }
      // Price trend of the hero-selected mutation (Compare adds others).
      below={
        <>
          <SearchParamsBridge onParams={onParams} />
          <PriceTrendChart
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
        </>
      }
    />
  )
}
