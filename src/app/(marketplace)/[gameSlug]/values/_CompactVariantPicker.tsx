'use client'

/**
 * The ONE two-axis Adopt Me variant picker — a Tier row (Default / Neon /
 * Mega) with a Potion row (Fly + Ride for Default; a single Fly Ride toggle
 * for Neon/Mega, which inherit the base pet's abilities). Resolves to one of
 * the 8 canonical codes via _adoptMeVariantAxes.
 *
 * Shared by the values-list cards, the list toolbar popover, the per-pet
 * hero and the WFL calculator so the control reads identically everywhere.
 * `accent` is the active-fill colour — callers pass the variant colour.
 *
 * Optional (added for the calculator, which used to carry its own copy):
 *  - `isAvailable(code)`: a choice whose resolved code is unavailable (no cash
 *    price) is greyed and can't be selected. A tier stays enabled when either
 *    its plain or its Fly Ride form is available.
 *  - `layout="inline"`: tier + potion groups on one row, no labels (dense
 *    calculator rows).
 */

import type { CSSProperties } from 'react'
import { VARIANT_LABEL, type Variant } from '../calculator/_adoptMeCalcTypes'
import {
  TIERS,
  tierHasSplitPotions,
  axesToVariant,
  variantToAxes,
  retierAxes,
  type VariantAxes,
} from '../calculator/_adoptMeVariantAxes'

export function CompactVariantPicker({
  variant,
  onChange,
  accent,
  onAccentText = '#0B0810',
  showSelected = true,
  isAvailable,
  layout = 'stacked',
}: {
  variant: Variant
  onChange: (v: Variant) => void
  accent: string
  onAccentText?: string
  showSelected?: boolean
  isAvailable?: (code: Variant) => boolean
  layout?: 'stacked' | 'inline'
}) {
  const axes = variantToAxes(variant)
  const split = tierHasSplitPotions(axes.tier)
  const onStyle: CSSProperties = { backgroundColor: accent, borderColor: accent, color: onAccentText }
  const btn =
    'flex-1 rounded-md border border-transparent bg-bg-overlay px-2 py-2 text-body-sm font-semibold text-text-secondary transition-[background-color,color,transform] hover:bg-bg-overlay-2 hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-bg-overlay disabled:active:scale-100'
  const label = 'mb-1.5 text-[11px] font-medium text-text-tertiary'
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn() }
  const unavailable = (code: Variant) => (isAvailable ? !isAvailable(code) : false)

  // Every change goes through here so an unavailable code is never emitted.
  const emit = (next: VariantAxes) => {
    const code = axesToVariant(next)
    if (unavailable(code)) return
    onChange(code)
  }
  const flyRideOn = axes.fly || axes.ride

  const tierRow = (
    <div className="flex gap-2">
      {TIERS.map((t) => {
        const active = axes.tier === t.value
        const dim =
          unavailable(axesToVariant(retierAxes(axes, t.value))) &&
          unavailable(axesToVariant({ ...retierAxes(axes, t.value), fly: true, ride: true }))
        return (
          <button
            key={t.value}
            type="button"
            onClick={stop(() => emit(retierAxes(axes, t.value)))}
            disabled={dim}
            aria-pressed={active}
            className={btn}
            style={active ? onStyle : undefined}
          >
            {t.short}
          </button>
        )
      })}
    </div>
  )

  const potionRow = (
    <div className="flex gap-2">
      {split ? (
        <>
          <button
            type="button"
            onClick={stop(() => emit({ ...axes, fly: !axes.fly }))}
            disabled={unavailable(axesToVariant({ ...axes, fly: !axes.fly }))}
            aria-pressed={axes.fly}
            className={btn}
            style={axes.fly ? onStyle : undefined}
          >
            Fly
          </button>
          <button
            type="button"
            onClick={stop(() => emit({ ...axes, ride: !axes.ride }))}
            disabled={unavailable(axesToVariant({ ...axes, ride: !axes.ride }))}
            aria-pressed={axes.ride}
            className={btn}
            style={axes.ride ? onStyle : undefined}
          >
            Ride
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={stop(() => emit({ ...axes, fly: !flyRideOn, ride: !flyRideOn }))}
          disabled={unavailable(axesToVariant({ ...axes, fly: !flyRideOn, ride: !flyRideOn }))}
          aria-pressed={flyRideOn}
          className={btn}
          style={flyRideOn ? onStyle : undefined}
        >
          Fly Ride
        </button>
      )}
    </div>
  )

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
        <div role="group" aria-label="Tier" className="min-w-0 flex-[3]">{tierRow}</div>
        <div role="group" aria-label="Potion" className="min-w-0 flex-[2]">{potionRow}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Tier">
        <p className={label}>Tier</p>
        {tierRow}
      </div>
      <div role="group" aria-label="Potion">
        <p className={label}>Potion</p>
        {potionRow}
      </div>
      {showSelected && (
        <p className="text-center text-caption text-text-tertiary">
          Showing <span className="font-semibold" style={{ color: accent }}>{VARIANT_LABEL[variant]}</span>
        </p>
      )}
    </div>
  )
}
