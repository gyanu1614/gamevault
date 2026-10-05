'use client'

/**
 * Adopt Me pet hero: the shared ValueItemHero with Adopt Me's data — BOTH
 * numbers (cash + trade) and the two-axis tier/potion picker (the same
 * CompactVariantPicker the value cards use) instead of SAB's mutation grid.
 * Default variant is FR — the trading benchmark.
 */

import { useMemo, useRef } from 'react'
import type { AdoptMePetVariant } from './_adoptMePetTypes'
import type { Variant } from '../../calculator/_adoptMeCalcTypes'
import { variantColor } from './_adoptMeVariantColor'
import { useSelectedVariant } from './_SelectedVariantContext'
import { CompactVariantPicker } from '../_CompactVariantPicker'
import { FreshnessBadge } from '@/lib/sab/FreshnessBadge'
import { marketSecondaryUsd } from '@/lib/values/pricing'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import { amVariantKey } from '@/lib/value-listings/catalogs'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueItemHero, HeroBadge, ConfidenceBadge } from '@/components/values/ValueItemHero'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

export default function AdoptMePetHero({
  name,
  rarityLabel,
  rarityColor,
  obtainabilityLabel,
  imageUrl,
  buy,
  variants,
}: {
  name: string
  rarityLabel: string
  rarityColor: string
  obtainabilityLabel: string
  imageUrl: string | null
  /** DropMarket's own live stock for this pet (drives the buy button). */
  buy: { itemSlug: string; categorySlug: string; stock: ItemStock | null }
  variants: AdoptMePetVariant[]
}) {
  // Selection is SHARED via context — the callout, stats strip and price chart
  // all read it, so picking a form here reprices the whole page below.
  const { selectedCode, setSelectedCode } = useSelectedVariant()
  const heroRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => variants.find((v) => v.variant === selectedCode) ?? variants[0],
    [variants, selectedCode],
  )

  function pick(code: Variant) {
    setSelectedCode(code)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // The button is DropMarket's own stock for the selected form, never the
  // market price above it (Bundle 2): see value-listings/buy-state.
  const cta = useBuyCta({
    gameSlug: 'adopt-me',
    categorySlug: buy.categorySlug,
    itemSlug: buy.itemSlug,
    variant: selected ? amVariantKey(selected.variant) : null,
    variantName: selected ? (selected.variant === 'N' ? 'Normal' : selected.label) : name,
    stock: buy.stock,
    surface: 'value_item',
  })

  if (!selected) return null

  const accent = variantColor(selected.variant)
  // CHEAPEST is the headline — the price a buyer acts on. MARKET (the typical
  // reputable price = average) shows as a quiet secondary ONLY when it sits a
  // meaningful step above the cheapest (MARKET_SECONDARY_GAP).
  const marketUsd = selected.averageUsd ?? selected.cashUsd
  const cheapestUsd = selected.cheapestUsd
  // Headline = cheapest when we have it, else the reputable market. When
  // neither exists we do NOT invent a dollar figure — we fall back to the
  // trade-points value.
  const headlineUsd = cheapestUsd ?? marketUsd
  const secondaryUsd = marketSecondaryUsd(cheapestUsd, marketUsd)
  // A reputable price exists whenever we priced an average from real listings.
  const hasReputable = selected.averageUsd != null
  const hasCash = headlineUsd != null
  const pointsValue = selected.tradeValue != null && selected.tradeValue > 0 ? selected.tradeValue : null
  // Pet name FIRST, variant as a readable suffix: "Bat Dragon - Normal",
  // "Bat Dragon - Neon Fly Ride". N reads as "Normal".
  const variantSuffix = selected.variant === 'N' ? 'Normal' : selected.label
  const displayName = `${name} - ${variantSuffix}`

  return (
    <ValueItemHero
      anchorRef={heroRef}
      accent={accent}
      art={{ src: imageUrl, alt: `${displayName} — Adopt Me` }}
      eyebrow={
        <>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: accent }} />
          {selected.variant === 'N' ? 'Normal (no potion)' : `${selected.label} variant`}
        </>
      }
      title={displayName}
      stats={[
        { label: 'Rarity', value: <span style={{ color: rarityColor }}>{rarityLabel}</span> },
        { label: 'Availability', value: obtainabilityLabel },
        { label: 'Trade Value', value: selected.tradeValue != null ? TRADE.format(selected.tradeValue) : '—' },
        { label: 'Listings Tracked', value: selected.listingsTracked > 0 ? String(selected.listingsTracked) : 'None yet' },
      ]}
      price={{
        // Market data, not DropMarket stock: the buy button carries ours.
        label: hasCash ? (hasReputable ? 'Market Price' : 'Cash Value') : pointsValue ? 'Trade Value' : 'Value',
        labelColor: accent,
        value: hasCash ? (
          USD.format(headlineUsd as number)
        ) : pointsValue ? (
          <>
            {TRADE.format(pointsValue)}
            <span className="ml-1.5 text-[15px] font-semibold text-text-tertiary">pts</span>
          </>
        ) : (
          'No data yet'
        ),
        children: (
          <>
            {/* Typical (market) price — only when it genuinely exceeds the
                cheapest headline (never a duplicate number). */}
            {secondaryUsd != null && (
              <p className="mt-1.5 text-[13px] tabular-nums text-text-tertiary">typically ~{USD.format(secondaryUsd)}</p>
            )}
            <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
              {hasReputable ? (
                <HeroBadge color="var(--color-success)">From verified sellers</HeroBadge>
              ) : hasCash ? (
                <ConfidenceBadge confidence={selected.confidence} />
              ) : pointsValue ? (
                <HeroBadge>Community trade value</HeroBadge>
              ) : null}
            </div>
          </>
        ),
      }}
      actions={
        // Sell door: no keep-figure — Adopt Me cash values are estimates, so we
        // never attach a $ payout here.
        <ValueBuyActions
          cta={cta}
          itemName={displayName}
          sell={{ href: '/adopt-me/sell?src=am-item-page', label: `Sell ${name} For Cash` }}
          align="end"
        />
      }
      footer={
        hasReputable && selected.lastPricedAt ? (
          // Live-freshness cue (SEO + trust): "Updated <time> UTC".
          <FreshnessBadge updatedAt={selected.lastPricedAt} />
        ) : (
          <span className="text-[12px] text-text-tertiary">
            {hasReputable
              ? 'Cheapest price from sellers with 100+ reviews'
              : hasCash
                ? 'Cheapest from tracked marketplace listings'
                : pointsValue
                  ? 'Community trade value — no cash listings tracked yet'
                  : 'No data tracked yet'}
          </span>
        )
      }
      // Tier (Default / Neon / Mega) over Potion (Fly / Ride) — picking a form
      // reprices the hero and every section below.
      picker={<CompactVariantPicker variant={selected.variant} onChange={pick} accent={accent} />}
    />
  )
}
