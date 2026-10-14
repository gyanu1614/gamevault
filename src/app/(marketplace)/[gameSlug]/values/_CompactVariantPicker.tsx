'use client'

/**
 * The ONE two-axis Adopt Me variant picker — Tier (Default / Neon / Mega) and
 * Potion (Fly + Ride for Default; one Fly Ride toggle for Neon/Mega, which
 * inherit the base pet's abilities). Resolves to one of the 8 canonical codes.
 *
 * Built on the universal VariantSelector (components/values), so Adopt Me
 * reads like SAB's mutations and MM2's forms everywhere it shows: the per-pet
 * hero, the values-list cards and toolbar, the WFL calculator. The groups and
 * the pick → code rule live in lib/values/variant-selector.
 *
 *  - `isAvailable(code)`: a choice whose code has no cash price is disabled
 *    (a tier stays enabled when either its plain or Fly Ride form has one).
 *  - `priceOf(code)`: each tier shows the price it would switch to.
 *  - `layout="inline"`: no labels, smaller (dense calculator rows).
 */

import type { Variant } from '../calculator/_adoptMeCalcTypes'
import { VariantSelector } from '@/components/values/VariantSelector'
import { amSelect, amSelectorGroups } from '@/lib/values/variant-selector'
import { formatUsd } from '@/lib/value-listings/format'
import { VARIANT_DISPLAY } from '@/lib/adopt-me/variants'

export function CompactVariantPicker({
  variant,
  onChange,
  accent,
  showSelected = true,
  isAvailable,
  priceOf,
  layout = 'stacked',
  labels = true,
  merged = false,
  fill = false,
  size,
}: {
  variant: Variant
  onChange: (v: Variant) => void
  accent: string
  /** Kept for callers; the selector's active pill sets its own text colour. */
  onAccentText?: string
  showSelected?: boolean
  isAvailable?: (code: Variant) => boolean
  priceOf?: (code: Variant) => number | null | undefined
  layout?: 'stacked' | 'inline'
  /** The item hero drops "Tier" / "Potion": the options say what they are. */
  labels?: boolean
  /** One tray for both groups (the item hero). */
  merged?: boolean
  /** Full-width trays, options shared evenly (the item hero, under the art). */
  fill?: boolean
  /** Chip size; defaults to sm inline, md stacked. xs inside a list card's popup. */
  size?: 'md' | 'sm' | 'xs'
}) {
  const groups = amSelectorGroups(variant, { format: formatUsd, isAvailable, priceOf })
  const select = (groupId: string, key: string) => {
    const next = amSelect(variant, groupId, key)
    if (isAvailable && !isAvailable(next)) return
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <VariantSelector
        groups={groups}
        onSelect={select}
        accent={accent}
        size={size ?? (layout === 'inline' ? 'sm' : 'md')}
        labels={labels && layout !== 'inline'}
        merged={merged}
        fill={fill}
      />
      {showSelected && layout !== 'inline' && (
        <p className="text-caption text-text-tertiary">
          Showing <span className="font-semibold" style={{ color: accent }}>{VARIANT_DISPLAY[variant]}</span>
        </p>
      )}
    </div>
  )
}
