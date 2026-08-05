'use client'

/**
 * Interactive per-pet hero for Adopt Me — matches SAB's ItemHero aesthetic
 * (near-black hero stat-card + a tappable card grid below that reprices the
 * hero) but models Adopt Me: the grid is the 8-variant potion/Neon ladder, not
 * mutations, and the hero shows BOTH numbers (cash + trade). Default variant is
 * FR — the trading benchmark.
 */

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { AdoptMePetVariant, Variant } from './_adoptMePetData'
import { VariantAxisPicker } from '../../calculator/_VariantAxisPicker'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

/** Per-variant accent dot — Neon/Mega tiers read "hotter". */
const VARIANT_COLOR: Record<string, string> = {
  N: '#9BA8A0',
  F: '#7FE3F0',
  R: '#7FB0F0',
  FR: '#B07BC9',
  NEON: '#E86FD0',
  NFR: '#D66FE8',
  MEGA: '#F5A742',
  MFR: '#F5C542',
}

function variantColor(v: string) {
  return VARIANT_COLOR[v] ?? '#B07BC9'
}

export default function AdoptMePetHero({
  name,
  rarityLabel,
  rarityColor,
  obtainabilityLabel,
  imageUrl,
  buyHref,
  variants,
}: {
  name: string
  rarityLabel: string
  rarityColor: string
  obtainabilityLabel: string
  imageUrl: string | null
  buyHref: string
  variants: AdoptMePetVariant[]
}) {
  const defaultVariant = variants.find((v) => v.variant === 'FR') ?? variants[0]
  const [selectedCode, setSelectedCode] = useState<Variant>(defaultVariant?.variant ?? 'FR')
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

  if (!selected) return null

  const accent = variantColor(selected.variant)
  // Pet name FIRST, variant as a readable suffix: "Bat Dragon - Normal",
  // "Bat Dragon - FR", "Bat Dragon - Neon Fly Ride" — never "Mega Fly Ride Bat
  // Dragon". N reads as "Normal"; the potioned forms use their full label.
  const variantSuffix = selected.variant === 'N' ? 'Normal' : selected.label
  const displayName = `${name} - ${variantSuffix}`
  // The buy button / plain references still want just the pet name.
  const petName = name

  return (
    <div className="space-y-4">
      {/* Hero stat-card */}
      <div
        ref={heroRef}
        className="relative scroll-mt-20 overflow-hidden border border-[#1E2723] bg-[#101512]/[0.94] backdrop-blur-sm"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-1/4 -top-1/2 h-[150%] w-[80%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${accent}22, transparent)` }}
        />
        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[190px_minmax(0,1fr)_240px] lg:items-center">
          {/* Art */}
          <div className="mx-auto aspect-square w-40 overflow-hidden sm:w-44 lg:mx-0 lg:w-[190px]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote pet art
              <img src={imageUrl} alt={`${displayName} — Adopt Me`} className="h-full w-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.55)]" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-[#5E685E]">No image</div>
            )}
          </div>

          {/* Name + stat rows */}
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
              <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
              {selected.variant === 'N' ? 'Normal (no potion)' : `${selected.label} variant`}
            </span>
            <h1 className="mt-2 text-2xl font-semibold leading-[1.15] tracking-[-0.01em] text-[#F1F3F1] sm:text-[30px]">
              {displayName}
            </h1>

            <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              <StatRow label="Rarity" value={rarityLabel} valueColor={rarityColor} />
              <StatRow label="Availability" value={obtainabilityLabel} />
              <StatRow label="Trade value" value={selected.tradeValue != null ? TRADE.format(selected.tradeValue) : '—'} />
              <StatRow
                label="Listings tracked"
                value={selected.listingsTracked > 0 ? String(selected.listingsTracked) : 'None yet'}
              />
            </dl>
          </div>

          {/* Cash price + confidence + CTA */}
          <div className="lg:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
              {selected.label} cash value
            </p>
            <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-[#F1F3F1] tabular-nums">
              {selected.cashUsd != null ? USD.format(selected.cashUsd) : 'No data yet'}
            </p>
            <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
              {selected.isEstimated ? (
                <span className="inline-flex items-center gap-1.5 border border-[#26332C] bg-white/[0.03] px-2 py-1 text-[11.5px] font-semibold text-[#9BA8A0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#9BA8A0]" />
                  Estimated
                </span>
              ) : (
                <ConfidenceBadge label={selected.confidence} />
              )}
            </div>
            {/* Buy CTA is CHROME (same on every pet) → the shared forest accent,
                not the per-variant colour. Matches SAB's Buy button across the
                whole value hub. */}
            <Link
              href={buyHref}
              aria-label={`Buy ${displayName}`}
              className="group mt-4 inline-flex w-full items-center justify-center gap-1.5 bg-[#1B6B3F] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgba(27,107,63,0.6)] transition hover:bg-[#1f7a48] lg:w-auto"
            >
              Buy {name}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {/* Sell door — outline, quieter than Buy. No keep-figure: Adopt Me
                cash values are estimates, so we never attach a $ payout here. */}
            <Link
              href="/adopt-me/sell?src=am-item-page"
              aria-label={`Sell your ${name}`}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 border border-[#2F6B46] px-5 py-2.5 text-[13px] font-semibold text-[#8FBF9C] transition hover:border-[#3FA35C] hover:text-[#A6D9B6] lg:w-auto"
            >
              Sell {name} For Cash
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center border-t border-white/[0.06] px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#6D7A72]">
            Cash values estimated until we hold enough real sales
          </span>
        </div>
      </div>

      {/* Two-axis picker — the primary control: tier (Default/Neon/Mega) +
          Fly/Ride. Drives the hero price. The grid below stays as a full
          value-by-variant reference (and still taps to reprice). Both share
          selectedCode, so they always agree. */}
      <div className="border border-[#1E2723] bg-[#0E1211] p-3.5">
        <p className="mb-2.5 text-sm font-medium text-[#F1F3F1]">Choose a variant</p>
        <VariantAxisPicker
          variant={selectedCode}
          onChange={pick}
          hasCash={() => true}
          accent={accent}
          onAccent="#0B0810"
        />
      </div>

      {/* Tappable variant grid — the SAB "tap to update the price above" pattern */}
      <div>
        <p className="px-1 text-sm font-medium text-[#F1F3F1]">
          Value by variant <span className="font-normal text-[#6D7A72]">— tap to update the price above</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {variants.map((v) => {
            const active = v.variant === selected.variant
            const c = variantColor(v.variant)
            return (
              <button
                key={v.variant}
                type="button"
                onClick={() => pick(v.variant)}
                aria-pressed={active}
                // Neutral SAB base (never a per-game tint); the variant colour
                // shows ONLY on the dot + a subtle 1px accent border when active
                // — no bright ring. Matches SAB's mutation cards.
                className={`group flex min-h-[52px] items-center gap-2 border bg-[#111613] px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#2A3A31] ${active ? '' : 'border-[#1E2723]'}`}
                style={active ? ({ borderColor: c } as React.CSSProperties) : undefined}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                <span className="min-w-0 flex-1">
                  {/* Full readable name + short code, one line, larger normal
                      font (was a tiny mono code that was hard to read). */}
                  <span className="block truncate text-[15px] font-semibold" style={{ color: active ? c : '#E6EAE7' }}>
                    {v.label} <span className="font-normal text-[#9BA8A0]">({v.variant})</span>
                  </span>
                </span>
                <span className="text-right text-xs font-medium text-[#9BA8A0]">
                  {v.cashUsd != null ? (
                    <>
                      {USD.format(v.cashUsd)}
                      {v.isEstimated && <span className="ml-1 text-[10px] text-[#8B7BA0]">est</span>}
                    </>
                  ) : v.tradeValue != null ? (
                    <span className="text-[#8B7BA0]">{TRADE.format(v.tradeValue)} trade</span>
                  ) : (
                    '—'
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-[13.5px] text-[#8B978F]">{label}</dt>
      <dd className="text-[14px] font-semibold tabular-nums" style={{ color: valueColor ?? '#E6EAE7' }}>{value}</dd>
    </div>
  )
}

function ConfidenceBadge({ label }: { label: string }) {
  const map: Record<string, { text: string; color: string }> = {
    highly_accurate: { text: 'Highly Accurate', color: '#8FBF9C' },
    high: { text: 'High Confidence', color: '#8FBF9C' },
    medium: { text: 'Medium Confidence', color: '#E0B155' },
    low: { text: 'Low Confidence', color: '#9BA8A0' },
  }
  const c = map[label] ?? map.low
  return (
    <span className="inline-flex items-center gap-1.5 border px-2 py-1 text-[11.5px] font-semibold" style={{ borderColor: `${c.color}44`, color: c.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {c.text}
    </span>
  )
}
