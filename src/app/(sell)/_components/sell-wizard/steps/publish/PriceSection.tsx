'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { round2 } from '@/lib/fees'
import { previewSellerFee, type SellerFeePreview } from '@/lib/actions/fee-preview'
import { formatUnitPrice } from '@/lib/currency/price-format'
import { MarketPriceHint } from '@/app/(sell)/_components/MarketPriceHint'

import { FIELD_SURFACE, inputCls } from '../../styles'
import { SubCard } from '../../ui/SubCard'
import { FieldError, FieldHint, TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/**
 * Price, with everything that helps set it: the admin's accepted range
 * (currency), the seller's net after the fee, the original price on top-ups,
 * and the market price helper.
 */
export function PriceSection({
  p,
  isCurrency,
  isBundleMode,
  suffix,
}: {
  p: Pick<Step4Props, 'price' | 'setPrice' | 'originalPrice' | 'setOriginalPrice' | 'categorySlug' | 'gameCategoryId' | 'priceRules' | 'priceHintInput'>
  isCurrency: boolean
  isBundleMode: boolean
  suffix: string | null
}) {
  const priceNum = parseFloat(p.price || '0')
  // ONE fee resolver call per selected pair (not per keystroke); the
  // subtraction below uses checkout's rounding
  // (commission = round2(price × pct / 100); net = round2(price − commission)).
  const [feePreview, setFeePreview] = useState<SellerFeePreview | null>(null)
  useEffect(() => {
    let alive = true
    setFeePreview(null)
    if (!p.gameCategoryId) return
    previewSellerFee({ gameCategoryId: p.gameCategoryId }).then((r) => {
      if (alive) setFeePreview(r)
    })
    return () => {
      alive = false
    }
  }, [p.gameCategoryId])
  const discount =
    p.originalPrice && priceNum > 0 ? Math.round(((parseFloat(p.originalPrice) - priceNum) / parseFloat(p.originalPrice)) * 100) : 0
  // The error shows once the field has been left empty, not on first render.
  const [touched, setTouched] = useState(false)
  const priceInvalid = touched && !(parseFloat(p.price) > 0)
  return (
<SubCard title="Price">
  <div className="space-y-1.5">
    <label className="block text-[13px] font-medium text-text-secondary">
      {isBundleMode
        ? 'Price Per Bundle'
        : isCurrency && suffix
          ? `Price Per ${suffix}`
          : 'Price'}{' '}
      <span className="text-error">*</span>
    </label>
    <div
      className={cn(
        FIELD_SURFACE,
        'flex h-11 w-full items-center sm:h-10',
        priceInvalid && 'border-error hover:border-error focus-within:border-error',
      )}
    >
      <span aria-hidden className="flex shrink-0 items-center pl-3 pr-1 text-sm text-text-tertiary">$</span>
      {/* text + inputMode="decimal", not type="number": no
          spinner arrows, no value changing under a scroll
          wheel, and a decimal keypad on phones. Input is
          filtered to digits and one point, capped at the
          precision the price is stored at. */}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={p.price}
        onChange={(e) => {
          const places = isCurrency && !isBundleMode ? 4 : 2
          const v = e.target.value.replace(',', '.')
          if (new RegExp(`^\\d*(\\.\\d{0,${places}})?$`).test(v)) p.setPrice(v)
        }}
        onBlur={() => setTouched(true)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="0.00"
        aria-label="Price in US dollars"
        aria-invalid={priceInvalid || undefined}
        aria-required
        className="h-full min-w-0 flex-1 bg-transparent pr-2 text-base tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none sm:text-sm"
      />
      {/* Currency as quiet text inside the field, the same way
          Stock shows its unit. The old separate near-black
          slab with its own divider read as a second control
          bolted onto the input. */}
      <span className="shrink-0 pr-3 text-sm font-medium text-text-tertiary">USD</span>
    </div>
    {priceInvalid && <FieldError>This field is required.</FieldError>}
    {/* D2/D3 — the admin range, in the same unit as the label. */}
    {(() => {
      const r = p.priceRules
      if (!isCurrency || !r || (r.min == null && r.max == null)) return null
      const per = isBundleMode ? 'bundle' : suffix ?? 'unit'
      const n = Number(p.price)
      const below = n > 0 && r.min != null && n < r.min
      const above = n > 0 && r.max != null && n > r.max
      const range =
        r.min != null && r.max != null
          ? `${formatUnitPrice(r.min)} to ${formatUnitPrice(r.max)} per ${per}`
          : r.min != null
            ? `at least ${formatUnitPrice(r.min)} per ${per}`
            : `at most ${formatUnitPrice(r.max as number)} per ${per}`
      return (
        <p className={cn('text-[12px] leading-snug', below || above ? 'text-warning' : 'text-text-tertiary')}>
          {below || above ? `This game accepts ${range}.` : `Accepted price: ${range}.`}
        </p>
      )
    })()}
    {/* Fee spec §1 — the seller sees their exact commission
        and estimated net proceeds before publishing. The rate
        is the resolver's answer for THIS seller on THIS pair
        (fee engine PR 5, D1) — never a constant. */}
    {Number(p.price) > 0 && feePreview?.ok && (() => {
      const price = Number(p.price)
      const net = round2(price - round2((price * feePreview.pct) / 100))
      // A sub-cent per-unit price (Robux $0.0055) rounds to
      // $0.00 above; the estimate then shows the per-unit net
      // unrounded. Display only: payouts are computed per order.
      const netText = price < 0.01
        ? formatUnitPrice(price * (1 - feePreview.pct / 100))
        : `$${net.toFixed(2)}`
      return (
        <p className="text-[12px] text-text-tertiary">
          You receive{' '}
          <span className="font-semibold text-lime-text">{netText}</span>
          {isBundleMode ? ' per bundle' : isCurrency ? ` per ${suffix}` : ''} ({feePreview.pct}% fee
          {feePreview.foundingApplied ? ', founding rate' : feePreview.rankPts > 0 ? `, ${feePreview.rank} rank` : ''}).
        </p>
      )
    })()}
    {Number(p.price) > 0 && feePreview && !feePreview.ok && (
      <p className="text-[12px] text-text-tertiary">{feePreview.error}.</p>
    )}
  </div>

  {/* Top-up original price — the discount badge depends on it. */}
  {p.categorySlug === 'top-up' && (
    <div className="mt-4 space-y-1.5">
      <label className="block text-[13px] font-medium text-text-secondary">
        Original Price{' '}
        <span className="font-normal normal-case tracking-normal text-text-disabled">
          (optional)
        </span>
      </label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">$</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={p.originalPrice}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            if (/^\d*(\.\d{0,2})?$/.test(v)) p.setOriginalPrice(v)
          }}
          placeholder="0.00"
          className={cn(inputCls, 'pl-7')}
        />
      </div>
      {discount > 0 && (
        <FieldHint className="text-success">
          {discount}% Discount Badge Will Show
        </FieldHint>
      )}
    </div>
  )}

  <MarketPriceHint
    input={p.priceHintInput}
    unit={isBundleMode ? 'bundle' : isCurrency ? suffix : null}
  />

  {!isCurrency && (
    <TipBox>Competitive prices rank higher in the offer list.</TipBox>
  )}
</SubCard>
  )
}
