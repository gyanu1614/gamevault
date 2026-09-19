'use client'

/**
 * The "About" block's variant-reactive parts: the quick-answer callout + the
 * market-activity stats strip. Both follow the selected variant from
 * SelectedVariantContext, so switching form in the hero reprices them (Cheapest
 * (FR) → Cheapest (NFR), etc.). The heading and the description prose stay in
 * the server component (they don't change with the variant).
 */

import Link from 'next/link'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { AdoptMePetVariant } from './_adoptMePetData'
import { VARIANT_LABEL } from '../../calculator/_adoptMeCalcTypes'
import { useSelectedVariant } from './_SelectedVariantContext'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')
const CONFIDENCE_LABEL: Record<string, string> = {
  highly_accurate: 'Highly accurate',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function ActivityCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`px-4 py-3.5 ${accent ? 'bg-[#4FB477]/[0.07]' : 'bg-[#0E1211]'}`}>
      <dt className="text-caption font-semibold uppercase tracking-[0.1em] text-[#6D7A72]">{label}</dt>
      <dd className={`mt-1 text-subheading font-bold tabular-nums ${accent ? 'text-[#8FBF9C]' : 'text-[#E6EAE7]'}`}>
        {value}
      </dd>
    </div>
  )
}

export function AdoptMeAboutStats({
  name,
  slug,
  variants,
}: {
  name: string
  slug: string
  variants: AdoptMePetVariant[]
}) {
  const { selectedCode } = useSelectedVariant()
  const v =
    variants.find((x) => x.variant === selectedCode) ??
    variants.find((x) => x.variant === 'FR') ??
    variants[0]
  if (!v) return null

  const code = v.variant
  const shortLabel = code === 'N' ? 'Normal' : VARIANT_LABEL[code] ?? code
  const headlineUsd = v.cheapestUsd ?? v.cashUsd

  return (
    <>
      {/* Quick-answer callout — reprices to the selected variant. */}
      {headlineUsd != null && (
        <div className="mb-6 flex flex-col gap-5 border border-[#1E2723] bg-[#0E1211] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.1em]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
              <span className="text-[#E6EAE7]">{name}</span>
              <span className="text-[#6D7A72]">· {shortLabel} · Starting From</span>
            </p>
            <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-[#F1F3F1] tabular-nums">
              {USD.format(headlineUsd)}
              {v.isEstimated && <span className="ml-2 align-middle text-body-sm font-medium text-[#8B7BA0]">est.</span>}
            </p>
            <p className="mt-1.5 text-body-sm text-[#8B978F]">
              Cheapest {shortLabel} from Adopt Me sellers with 100+ reviews.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            {v.tradeValue != null && (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D7A72]">Trade Value</p>
                <p className="mt-0.5 text-body font-semibold text-[#C6CEC9] tabular-nums">{TRADE.format(v.tradeValue)}</p>
              </div>
            )}
            <Link
              href={`/adopt-me/buy-items?pet=${slug}`}
              className="inline-flex items-center justify-center gap-1.5 border border-[#2F6B46] bg-[#1B6B3F] px-4 py-2.5 text-body-sm font-semibold text-white transition hover:bg-[#1f7a48]"
            >
              Buy {name}
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </Link>
          </div>
        </div>
      )}

      {/* Stats strip — labels carry the selected variant code. */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#1E2723] bg-[#1E2723] sm:grid-cols-4">
        <ActivityCell label={`Cheapest (${code})`} value={v.cheapestUsd != null ? USD.format(v.cheapestUsd) : '—'} accent />
        <ActivityCell label={`Trade value (${code})`} value={v.tradeValue != null ? TRADE.format(v.tradeValue) : '—'} />
        <ActivityCell label="Listings tracked" value={v.listingsTracked > 0 ? String(v.listingsTracked) : 'None yet'} />
        <ActivityCell label="Confidence" value={CONFIDENCE_LABEL[v.confidence] ?? 'Low'} />
      </dl>
    </>
  )
}
