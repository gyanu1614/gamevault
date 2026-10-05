'use client'

/**
 * Adopt Me price trend: the shared PriceTrendChart, one series per variant of
 * the 8-form ladder (shared variant colours). It plots the variant selected
 * on the page (shared with the hero + stats via context, so picking NFR up top
 * reprices this chart); Compare adds other variants as extra lines.
 */

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { VARIANTS, VARIANT_LABEL } from '../../calculator/_adoptMeCalcTypes'
import type { PetPricePoint } from './_adoptMePetTypes'
import { variantColor } from './_adoptMeVariantColor'
import { useSelectedVariant } from './_SelectedVariantContext'
import { TrendChartPlaceholder } from '@/components/values/ValueItemHero'

// recharts is ~100KB and sits below the fold: load it after the page.
const PriceTrendChart = dynamic(
  () => import('@/components/values/PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false, loading: () => <TrendChartPlaceholder height={220} /> },
)

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatUsd = (v: number) => USD.format(v)

export function AdoptMePriceTrend({
  history,
}: {
  /** Daily history keyed by variant (from getAdoptMePet). */
  history: Record<string, PetPricePoint[]>
}) {
  const { selectedCode } = useSelectedVariant()

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
      series={series}
      selectedKey={selectedCode}
      formatValue={formatUsd}
      seriesNoun="variants"
      height={220}
      idPrefix="am-trend"
      emptyBody={(name) =>
        `We snapshot ${name}'s price every day. The trend line appears once we have a few days of data in this range.`
      }
    />
  )
}
