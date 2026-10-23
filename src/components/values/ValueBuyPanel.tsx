'use client'

import type { ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import type { useBuyCta } from '@/components/value-listings/useBuyCta'
import { buyPanel, noPriceFallback } from '@/lib/value-listings/buy-panel'
import { formatUsd } from '@/lib/value-listings/format'
import { HeroBadge } from './ValueItemHero'
import { VALUE_LABEL } from './styles'

type BuyCta = ReturnType<typeof useBuyCta>

/**
 * The item hero's price column (owner, 2026-10-14): one decision, top to
 * bottom. Our price when we have the variant (the number the button buys at),
 * else the typical market price; the market reference and the saving under it;
 * the per-game notes (freshness, estimate); one full-width Buy; the SafeDrop
 * line; and Sell as a quiet line — not a second big button competing with Buy.
 */
export function ValueBuyPanel({
  cta,
  itemName,
  marketUsd,
  cheapestUsd,
  marketLabel,
  fallback,
  notes,
  sell,
  format = formatUsd,
}: {
  cta: BuyCta
  itemName: string
  marketUsd: number | null
  cheapestUsd: number | null
  marketLabel?: string
  /** Headline when there is no dollar price at all: noPriceFallback (trade value, else "No Trades Yet"). */
  fallback?: { label: string; value: ReactNode }
  /** Lines under the reference: freshness, estimate and source badges. */
  notes?: ReactNode
  sell?: { href: string } | null
  format?: (usd: number) => string
}) {
  const panel = buyPanel({ kind: cta.state, ourUsd: cta.priceUsd, count: cta.count, marketUsd, cheapestUsd, marketLabel })
  const priced = panel.usd != null
  const noPrice = fallback ?? noPriceFallback({ isNew: false })
  const label = priced ? panel.label : noPrice.label
  const listed = cta.state === 'in_stock'
  // The column is ~260px: "See 4 Other Listings From $289.99" clipped, so
  // the button keeps the action and the price moves to the line under it.
  const others = cta.state === 'other_variants'
  const buyLabel = listed ? 'Buy Now' : others ? `See ${cta.count} Other ${cta.count === 1 ? 'Listing' : 'Listings'}` : cta.label
  const subline =
    others && cta.priceUsd != null ? `${cta.subline ?? ''}. Others from ${format(cta.priceUsd)}.`.replace(/^\. /, '') : cta.subline

  return (
    <div className="flex flex-col items-start lg:items-end">
      <p className={`${VALUE_LABEL} text-[12px]`}>{label}</p>
      <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums sm:text-[38px]">
        {panel.from && <span className="mr-0.5 text-[15px] font-semibold tracking-normal text-text-tertiary">From </span>}
        {priced ? format(panel.usd as number) : noPrice.value}
      </p>
      {(panel.reference || panel.saveUsd != null) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] tabular-nums text-text-tertiary lg:justify-end">
          {panel.reference && (
            <span>
              {panel.reference.label} <span className="font-semibold text-text-secondary">{format(panel.reference.usd)}</span>
            </span>
          )}
          {panel.saveUsd != null && <HeroBadge color="var(--color-success)">{format(panel.saveUsd)} Below Market</HeroBadge>}
        </div>
      )}
      {notes}

      <Link
        href={cta.href}
        onClick={cta.onClick}
        aria-label={cta.state === 'none' ? `Browse items similar to ${itemName}` : others ? `${buyLabel} of ${itemName}` : `Buy ${itemName}`}
        className="group mt-4 inline-flex w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <BuyButtonFace size="lg" className="w-full">
          <span className="truncate">{buyLabel}</span>
        </BuyButtonFace>
      </Link>
      {subline && <p className="mt-1.5 text-[12px] text-text-secondary lg:text-right">{subline}</p>}
      {cta.state !== 'none' && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
          <ShieldCheckIcon size={14} weight="fill" className="text-info" aria-hidden />
          <span>
            Covered by{' '}
            <Link href="/safedrop" className="font-medium text-text-primary underline-offset-2 hover:underline">
              SafeDrop Protection
            </Link>
          </span>
        </p>
      )}
      {sell && (
        <Link
          href={sell.href}
          aria-label={`Sell your ${itemName}`}
          className="group mt-3 inline-flex items-center gap-1.5 rounded-sm text-[13px] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Have One? <span className="font-semibold text-text-primary">{listed ? 'Sell Yours' : 'Be the First to List It'}</span>
          <ArrowRightIcon size={13} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
