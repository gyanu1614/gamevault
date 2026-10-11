'use client'

import { useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

import { FIELD_SURFACE } from '../styles'
import { TipBox } from '@/app/(sell)/_components/sell-wizard/ui/form-fields'

// ─── FieldHint — small dim text under a control. No surface. ────────────────

/**
 * FieldHint — small surface containing dim text under a control.
 * R14: contained in a soft `bg-bg-inset` box with a subtle border so hints
 * no longer "float". Reverses the R7 "no surface" call after seller feedback
 * that bare grey text read as out-of-place.
 */
/**
 * QuantityInput — a plain numeric box for Stock and Minimum order.
 *
 * No +/- steppers: quantities here run from 1 to hundreds of thousands,
 * where stepping by one is useless and the buttons only ate width on a
 * phone. Instead the whole number is selected on focus, so the seller
 * types straight over it ("1K" -> click -> "1" is selected).
 *
 * Selecting in onFocus alone is not enough: Safari/iOS fire a mouseup
 * after focus that collapses the selection back to a caret. The first
 * mouseup after a focus is swallowed so the selection survives.
 *
 * The value is shown with thousands separators while idle and as raw
 * digits while editing; it is clamped to [min, max] on blur. Every
 * keystroke is also reported (unclamped) so a Save pressed mid-edit
 * sees what the seller typed.
 */
export function QuantityInput({
  value,
  onChange,
  min,
  max,
  suffix,
  ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  suffix?: string | null
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const swallowMouseUp = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const display = draft ?? value.toLocaleString('en-US')

  return (
    // Number + unit centred together ("1,000 K"), not number-left and
    // unit-right. The input is sized to its digits so the pair centres as
    // one; clicking the empty space either side still focuses the field
    // (and selects the number, via onFocus).
    <div
      onMouseDown={(e) => {
        if (e.target === inputRef.current) return
        e.preventDefault()
        inputRef.current?.focus()
        // Focus came from code, not a click on the input, so there is no
        // input mouseup to swallow.
        swallowMouseUp.current = false
      }}
      className={cn(FIELD_SURFACE, 'flex h-12 w-full cursor-text items-center justify-center gap-1.5 px-3 sm:h-11')}
    >
      <input
        ref={inputRef}
        style={{ width: `${Math.max(display.length, 1) + 0.5}ch` }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        onFocus={(e) => {
          const el = e.currentTarget
          swallowMouseUp.current = true
          setDraft(String(value))
          // After React swaps in the raw digits, select them.
          requestAnimationFrame(() => el.select())
        }}
        onMouseUp={(e) => {
          if (swallowMouseUp.current) {
            e.preventDefault()
            swallowMouseUp.current = false
          }
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
          setDraft(digits)
          const n = parseInt(digits, 10)
          if (Number.isFinite(n)) onChange(n)
        }}
        onBlur={() => {
          const n = parseInt(draft ?? '', 10)
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : Math.max(min, value))
          setDraft(null)
          swallowMouseUp.current = false
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-full min-w-0 max-w-full bg-transparent text-center text-base tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none sm:text-sm"
      />
      {suffix && (
        <span className="shrink-0 text-sm text-text-tertiary">{suffix}</span>
      )}
    </div>
  )
}

/**
 * StockStepper — the stock field when it stands alone.
 *
 * The − and + are separate square buttons on either side of the box, not
 * fused into it, so each reads as its own control and each gets a full
 * 44px touch target on a phone. The centre box is a QuantityInput, so a
 * seller with 250 units can still click and type instead of pressing +.
 */
export const STOCK_MAX = 10_000_000

export function StockStepper({
  value,
  onChange,
  suffix,
  hint,
}: {
  value: number
  onChange: (n: number) => void
  suffix?: string | null
  hint?: string | null
}) {
  const step = (d: number) => onChange(Math.min(STOCK_MAX, Math.max(1, value + d)))
  const btn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.07] bg-white/[0.05] text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11'
  return (
    <div className="flex flex-col items-center">
      <label className="mb-2 block text-[13px] font-medium text-text-secondary">
        Total Stock Available
      </label>
      <div className="flex w-full max-w-xs items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= 1}
          aria-label="Decrease stock"
          className={btn}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <QuantityInput
            value={value}
            onChange={onChange}
            min={1}
            max={STOCK_MAX}
            suffix={suffix}
            ariaLabel="Total stock available"
          />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= STOCK_MAX}
          aria-label="Increase stock"
          className={btn}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {hint && <TipBox className="w-full">{hint}</TipBox>}
    </div>
  )
}
