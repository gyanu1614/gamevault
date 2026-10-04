'use client'

/**
 * Adopt Me price trend: the shared PriceTrendChart in single-line mode, one
 * series per variant of the 8-form ladder (shared variant colours), with
 * range tabs. The selected variant is SHARED with the hero + stats via
 * context: the hero reprices this chart, and the chart's own dropdown writes
 * back (so the hero follows too).
 */

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { VARIANTS, VARIANT_LABEL, type Variant } from '../../calculator/_adoptMeCalcTypes'
import type { PetPricePoint } from './_adoptMePetTypes'
import { variantColor } from './_adoptMeVariantColor'
import { useSelectedVariant } from './_SelectedVariantContext'
import { TrendChartPlaceholder } from '@/components/values/ValueItemHero'
import type { TrendRange } from '@/components/values/PriceTrendChart'

// recharts is ~100KB and sits below the fold: load it after the page.
const PriceTrendChart = dynamic(
  () => import('@/components/values/PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false, loading: () => <TrendChartPlaceholder height={220} /> },
)

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatUsd = (v: number) => USD.format(v)

const RANGES: TrendRange[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: null },
]

export function AdoptMePriceTrend({
  history,
}: {
  /** Daily history keyed by variant (from getAdoptMePet). */
  history: Record<string, PetPricePoint[]>
}) {
  const { selectedCode, setSelectedCode } = useSelectedVariant()

  const series = useMemo(
    () =>
      VARIANTS.map((v) => ({
        key: v,
        name: VARIANT_LABEL[v],
        color: variantColor(v),
        points: (history[v] ?? []).map((p) => ({ date: p.date, value: p.price })),
      })),
    [history],
  )

  return (
    <PriceTrendChart
      mode="single"
      series={series}
      selectedKey={selectedCode}
      onSelect={(v) => setSelectedCode(v as Variant)}
      formatValue={formatUsd}
      ranges={RANGES}
      defaultRange="30d"
      showCurrent
      height={220}
      idPrefix="am-trend"
      emptyBody={(name) =>
        `We snapshot ${name}'s price every day. The trend line appears once we have a few days of data in this range.`
      }
    />
  )
}
