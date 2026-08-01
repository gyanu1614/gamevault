'use client'

/**
 * Two-axis Adopt Me variant picker — a tier selector (Default / Neon / Mega)
 * plus Fly / Ride toggles, resolving to one of the 8 canonical variant codes.
 *
 * Mirrors Adopt Me's real rules (see _adoptMeVariantAxes):
 *   • Default tier → independent Fly and Ride toggles (—, F, R, FR).
 *   • Neon / Mega  → a single "Fly Ride" toggle (plain ⇄ NFR/MFR); the split
 *     fly-only/ride-only forms don't exist in the data.
 *
 * A `pricedVariant` predicate greys out any resolved code with no cash value,
 * matching the calculator's existing "grey out unpriced" behaviour. Selecting a
 * greyed code is still allowed on the values/pet pages (they fall back to trade
 * value); the calculator can pass `disableUnpriced` to block it.
 */

import type { Variant } from './_adoptMeCalcTypes'
import {
  TIERS,
  tierHasSplitPotions,
  axesToVariant,
  variantToAxes,
  retierAxes,
  type VariantAxes,
} from './_adoptMeVariantAxes'

export function VariantAxisPicker({
  variant,
  onChange,
  hasCash,
  disableUnpriced = false,
  accent = '#B07BC9',
  onAccent = '#0B0810',
}: {
  /** Currently-selected canonical code. */
  variant: Variant
  /** Called with the newly-resolved canonical code. */
  onChange: (code: Variant) => void
  /** Does this pet have a cash value for the given code? Drives greying. */
  hasCash: (code: Variant) => boolean
  /** When true, unpriced (no-cash) resolved codes are non-selectable. */
  disableUnpriced?: boolean
  accent?: string
  onAccent?: string
}) {
  const axes = variantToAxes(variant)
  const split = tierHasSplitPotions(axes.tier)

  const emit = (next: VariantAxes) => {
    const code = axesToVariant(next)
    if (disableUnpriced && !hasCash(code)) return
    onChange(code)
  }

  const setTier = (tier: VariantAxes['tier']) => emit(retierAxes(axes, tier))
  const toggleFly = () => emit({ ...axes, fly: !axes.fly })
  const toggleRide = () => emit({ ...axes, ride: !axes.ride })
  // For Neon/Mega, one combined Fly-Ride toggle.
  const toggleFlyRide = () => {
    const on = !(axes.fly || axes.ride)
    emit({ ...axes, fly: on, ride: on })
  }

  const codeFor = (partial: Partial<VariantAxes>) =>
    axesToVariant({ ...axes, ...partial })

  return (
    // One row: tier group + potion group side by side. A thin divider between
    // the two axes keeps them legible without stacking onto a second line.
    <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
      {/* ── Tier axis ── */}
      <div className="flex min-w-0 flex-[3] border border-[#1E2723]">
        {TIERS.map((t, i) => {
          const active = axes.tier === t.value
          const plainCode = axesToVariant(retierAxes(axes, t.value))
          const priced =
            hasCash(plainCode) ||
            hasCash(axesToVariant({ ...retierAxes(axes, t.value), fly: true, ride: true }))
          const dim = disableUnpriced && !priced
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTier(t.value)}
              disabled={dim}
              className={`flex-1 px-2 py-2.5 text-[13px] font-semibold transition ${
                i > 0 ? 'border-l border-[#1E2723]' : ''
              } ${
                active
                  ? 'text-[color:var(--accent-on)]'
                  : dim
                    ? 'cursor-not-allowed text-[#4A574F]'
                    : 'text-[#9BA8A0] hover:bg-white/[0.04]'
              }`}
              style={
                active
                  ? ({ backgroundColor: accent, '--accent-on': onAccent } as React.CSSProperties)
                  : undefined
              }
            >
              {t.short}
            </button>
          )
        })}
      </div>

      {/* ── Potion axis ── (Default: Fly + Ride · Neon/Mega: single Fly Ride) */}
      {split ? (
        <div className="flex flex-[2] gap-2">
          <PotionToggle
            label="Fly"
            on={axes.fly}
            dim={disableUnpriced && !hasCash(codeFor({ fly: !axes.fly }))}
            onClick={toggleFly}
            accent={accent}
            onAccent={onAccent}
          />
          <PotionToggle
            label="Ride"
            on={axes.ride}
            dim={disableUnpriced && !hasCash(codeFor({ ride: !axes.ride }))}
            onClick={toggleRide}
            accent={accent}
            onAccent={onAccent}
          />
        </div>
      ) : (
        <div className="flex flex-[2]">
          <PotionToggle
            label="Fly Ride"
            on={axes.fly || axes.ride}
            dim={
              disableUnpriced &&
              !hasCash(axesToVariant({ ...axes, fly: !(axes.fly || axes.ride), ride: !(axes.fly || axes.ride) }))
            }
            onClick={toggleFlyRide}
            accent={accent}
            onAccent={onAccent}
            full
          />
        </div>
      )}
    </div>
  )
}

function PotionToggle({
  label,
  on,
  dim,
  onClick,
  accent,
  onAccent,
  full = false,
}: {
  label: string
  on: boolean
  dim: boolean
  onClick: () => void
  accent: string
  onAccent: string
  full?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dim}
      aria-pressed={on}
      className={`${full ? 'w-full' : 'flex-1'} border px-3 py-2 text-[13px] font-semibold transition ${
        on
          ? 'text-[color:var(--accent-on)]'
          : dim
            ? 'cursor-not-allowed border-[#161C18] text-[#4A574F]'
            : 'border-[#1E2723] text-[#9BA8A0] hover:bg-white/[0.04]'
      }`}
      style={
        on
          ? ({ backgroundColor: accent, borderColor: accent, '--accent-on': onAccent } as React.CSSProperties)
          : undefined
      }
    >
      {label}
    </button>
  )
}
