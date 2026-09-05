'use client'

/**
 * The two-axis Adopt Me variant picker in its finished form — a Tier row
 * (Default / Neon / Mega) over a Potion row (Fly + Ride for Default; a single
 * Fly-Ride toggle for Neon/Mega, which inherit the base pet's abilities).
 *
 * Shared by the values-list cards, the list toolbar dropdown, and the per-pet
 * hero so the control reads identically everywhere. `accent` is the active-fill
 * colour — callers pass the variant colour (cards/hero) or forest (toolbar).
 */

import type { CSSProperties, ReactNode } from 'react'
import { VARIANT_LABEL, type Variant } from '../calculator/_adoptMeCalcTypes'
import {
  TIERS,
  tierHasSplitPotions,
  axesToVariant,
  variantToAxes,
  retierAxes,
} from '../calculator/_adoptMeVariantAxes'

export function CompactVariantPicker({
  variant,
  onChange,
  accent,
  onAccentText = '#0B0810',
  showSelected = true,
}: {
  variant: Variant
  onChange: (v: Variant) => void
  accent: string
  onAccentText?: string
  showSelected?: boolean
}) {
  const axes = variantToAxes(variant)
  const split = tierHasSplitPotions(axes.tier)
  const onStyle: CSSProperties = { backgroundColor: accent, borderColor: accent, color: onAccentText }
  const btn =
    'flex-1 rounded-md border border-[#232A2F] bg-white/[0.02] px-2 py-2 text-body-sm font-semibold text-[#9BA8A0] transition hover:bg-white/[0.06] hover:text-[#E6EAE7]'
  const label = 'mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D7A72]'
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn() }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className={label}>Tier</p>
        <div className="flex gap-2">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={stop(() => onChange(axesToVariant(retierAxes(axes, t.value))))}
              className={btn}
              style={axes.tier === t.value ? onStyle : undefined}
            >
              {t.short}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Potion</p>
        <div className="flex gap-2">
          {split ? (
            <>
              <button type="button" onClick={stop(() => onChange(axesToVariant({ ...axes, fly: !axes.fly })))} className={btn} style={axes.fly ? onStyle : undefined}>
                Fly
              </button>
              <button type="button" onClick={stop(() => onChange(axesToVariant({ ...axes, ride: !axes.ride })))} className={btn} style={axes.ride ? onStyle : undefined}>
                Ride
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={stop(() => { const v = !(axes.fly || axes.ride); onChange(axesToVariant({ ...axes, fly: v, ride: v })) })}
              className={btn}
              style={axes.fly || axes.ride ? onStyle : undefined}
            >
              Fly Ride
            </button>
          )}
        </div>
      </div>
      {showSelected && (
        <p className="text-center text-caption text-[#6D7A72]">
          Showing <span className="font-semibold" style={{ color: accent }}>{VARIANT_LABEL[variant]}</span>
        </p>
      )}
    </div>
  )
}
