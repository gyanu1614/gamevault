'use client'

/**
 * The "About" block's variant-reactive parts: the quick-answer callout + the
 * market-activity stats strip. Both follow the selected variant from
 * SelectedVariantContext, so switching form in the hero reprices them (Cheapest
 * (FR) → Cheapest (NFR), etc.). The heading and the description prose stay in
 * the server component (they don't change with the variant).
 */

import type { AdoptMePetVariant } from './_adoptMePetTypes'
import { VARIANT_LABEL } from '../../calculator/_adoptMeCalcTypes'
import { useSelectedVariant } from './_SelectedVariantContext'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import { amVariantKey } from '@/lib/value-listings/catalogs'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'
import { confidenceMeta } from '@/components/values/ValueItemHero'
import { VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')
/** Adopt Me's two price colours, as on the value cards. */
const CHEAPEST_TEAL = '#54DDBE'
const TRADE_GOLD = '#E8BD6A'

function ActivityCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`${VALUE_SURFACE} px-4 py-3.5`}>
      <dt className={VALUE_LABEL}>{label}</dt>
      <dd
        className="mt-1 text-subheading font-bold tabular-nums text-text-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

export function AdoptMeAboutStats({
  name,
  variants,
  buy,
}: {
  name: string
  variants: AdoptMePetVariant[]
  /** DropMarket's own live stock for this pet (drives the buy button). */
  buy: { itemSlug: string; categorySlug: string; stock: ItemStock | null }
}) {
  const { selectedCode } = useSelectedVariant()
  const v =
    variants.find((x) => x.variant === selectedCode) ??
    variants.find((x) => x.variant === 'FR') ??
    variants[0]
  const cta = useBuyCta({
    gameSlug: 'adopt-me',
    categorySlug: buy.categorySlug,
    itemSlug: buy.itemSlug,
    variant: v ? amVariantKey(v.variant) : null,
    variantName: v ? (v.variant === 'N' ? 'Normal' : VARIANT_LABEL[v.variant] ?? v.variant) : name,
    stock: buy.stock,
    surface: 'value_item',
  })
  if (!v) return null

  const code = v.variant
  const shortLabel = code === 'N' ? 'Normal' : VARIANT_LABEL[code] ?? code
  const headlineUsd = v.cheapestUsd ?? v.cashUsd

  return (
    <>
      {/* Quick-answer callout — reprices to the selected variant. */}
      {headlineUsd != null && (
        <div
          className={`${VALUE_SURFACE} mb-6 flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6`}
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-medium">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: CHEAPEST_TEAL }} />
              <span className="text-text-primary">{name}</span>
              <span className="text-text-tertiary">· {shortLabel} · Starting From</span>
            </p>
            <p className="mt-1.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums">
              {USD.format(headlineUsd)}
              {v.isEstimated && <span className="ml-2 align-middle text-body-sm font-medium text-text-tertiary">est.</span>}
            </p>
            <p className="mt-1.5 text-body-sm text-text-secondary">
              Cheapest {shortLabel} from Adopt Me sellers with 100+ reviews.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            {v.tradeValue != null && (
              <div className="sm:text-right">
                <p className={VALUE_LABEL}>Trade Value</p>
                <p className="mt-0.5 text-body font-semibold tabular-nums" style={{ color: TRADE_GOLD }}>
                  {TRADE.format(v.tradeValue)}
                </p>
              </div>
            )}
            <ValueBuyActions cta={cta} itemName={name} />
          </div>
        </div>
      )}

      {/* Stats strip — labels carry the selected variant code. */}
      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <ActivityCell
          label={`Cheapest (${code})`}
          value={v.cheapestUsd != null ? USD.format(v.cheapestUsd) : '—'}
          color={CHEAPEST_TEAL}
        />
        <ActivityCell
          label={`Trade Value (${code})`}
          value={v.tradeValue != null ? TRADE.format(v.tradeValue) : '—'}
          color={TRADE_GOLD}
        />
        <ActivityCell label="Listings Tracked" value={v.listingsTracked > 0 ? String(v.listingsTracked) : 'None yet'} />
        <ActivityCell label="Confidence" value={confidenceMeta(v.confidence).label} />
      </dl>
    </>
  )
}
