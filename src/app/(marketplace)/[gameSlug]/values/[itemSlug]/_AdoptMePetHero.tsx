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
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import { amVariantKey } from '@/lib/value-listings/catalogs'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueItemHero, HeroBadge, ConfidenceBadge } from '@/components/values/ValueItemHero'
import { ValueBuyPanel } from '@/components/values/ValueBuyPanel'
import { TradeValue } from '@/components/values/TradeValue'

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
  // Market = the typical reputable price (average), else the stored cash
  // value. The panel leads with OUR price when we list this form and keeps
  // the market as the reference under it; no stock → the market heads.
  const marketUsd = selected.averageUsd ?? selected.cashUsd
  // A reputable price exists whenever we priced an average from real listings.
  const hasReputable = selected.averageUsd != null
  const hasCash = (selected.cheapestUsd ?? marketUsd) != null
  const pointsValue = selected.tradeValue != null && selected.tradeValue > 0 ? selected.tradeValue : null
  const listed = cta.state === 'in_stock'
  // Pet name FIRST, variant as a readable suffix: "Bat Dragon - Normal",
  // "Bat Dragon - Neon Fly Ride". N reads as "Normal".
  const variantSuffix = selected.variant === 'N' ? 'Normal' : selected.label
  const displayName = `${name} - ${variantSuffix}`

  return (
    <ValueItemHero
      titleAs="h2"
      anchorRef={heroRef}
      accent={accent}
      art={{ src: imageUrl, alt: `${displayName} — Adopt Me` }}
      title={displayName}
      // The pet's facts (owner, 2026-10-12). Listings tracked stays out of the
      // card: the page's structured data (valuePage offers) still carries it.
      stats={[
        { label: 'Type', value: 'Pet' },
        { label: 'Rarity', value: <span style={{ color: rarityColor }}>{rarityLabel}</span> },
        { label: 'Availability', value: obtainabilityLabel },
        { label: 'Trade Value', value: selected.tradeValue != null ? <TradeValue>{TRADE.format(selected.tradeValue)}</TradeValue> : '—' },
      ]}
      panel={
        <ValueBuyPanel
          cta={cta}
          itemName={displayName}
          marketUsd={marketUsd ?? null}
          cheapestUsd={selected.cheapestUsd ?? null}
          marketLabel={hasReputable ? 'Market Price' : 'Cash Value'}
          // No dollar price at all: the trade-points value, never an invented figure.
          fallback={
            pointsValue
              ? {
                  label: 'Trade Value',
                  value: (
                    <>
                      <TradeValue>{TRADE.format(pointsValue)}</TradeValue>
                      <span className="ml-1.5 text-[15px] font-semibold text-text-tertiary">pts</span>
                    </>
                  ),
                }
              : { label: 'Value', value: 'No data yet' }
          }
          notes={
            <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
              {hasReputable ? (
                <HeroBadge color="var(--color-success)">From Verified Sellers</HeroBadge>
              ) : hasCash ? (
                <ConfidenceBadge confidence={selected.confidence} />
              ) : pointsValue && !listed ? (
                // Describes the trade-points headline; with our price heading
                // the panel it would label the wrong number.
                <HeroBadge>Community Trade Value</HeroBadge>
              ) : null}
            </div>
          }
          // No payout figure: Adopt Me cash values are estimates.
          sell={{ href: '/adopt-me/sell?src=am-item-page' }}
        />
      }
      footer={
        hasReputable && selected.lastPricedAt ? (
          // Live-freshness cue (SEO + trust): "Updated <time> UTC".
          <FreshnessBadge updatedAt={selected.lastPricedAt} />
        ) : (
          <span className="text-[12px] text-text-tertiary">
            {hasReputable
              ? 'Market price from sellers with 100+ reviews'
              : hasCash
                ? 'Market price from tracked marketplace listings'
                : pointsValue && !listed
                  ? 'Community trade value — no cash listings tracked yet'
                  : 'No market price tracked yet'}
          </span>
        )
      }
      // Tier (Default / Neon / Mega) over Potion (Fly / Ride) — picking a form
      // reprices the hero and every section below.
      // Under the art (owner, 2026-10-12): two even trays, no prices on the
      // options — the hero price updates on select.
      picker={
        <CompactVariantPicker variant={selected.variant} onChange={pick} accent={accent} showSelected={false} labels={false} fill />
      }
    />
  )
}
