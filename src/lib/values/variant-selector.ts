/**
 * The ONE variant selector's data (VariantSelector in components/values): a
 * list of groups, each a row of options. Every game builds its groups from
 * its own data here, so the control is identical everywhere and a new
 * mutation, tier or form shows up without new UI code:
 *
 *   Adopt Me   Tier (Default / Neon / Mega) + Potion (Fly, Ride | Fly Ride)
 *   SAB        Mutation (every mutation the brainrot has, in order)
 *   MM2 / ...  Form (Standard / Chroma), each a link to its own page
 *
 * Pure: no React, no server imports.
 */
import type { Variant } from '@/lib/adopt-me/variants'
import {
  TIERS,
  axesToVariant,
  retierAxes,
  tierHasSplitPotions,
  variantToAxes,
} from '@/app/(marketplace)/[gameSlug]/calculator/_adoptMeVariantAxes'

export interface SelectorOption {
  key: string
  label: string
  /** The option's own colour (mutation / rarity); the active pill takes it. */
  color?: string | null
  /** Small line under the label, e.g. the price this option switches to. */
  hint?: string | null
  active: boolean
  disabled?: boolean
  /** Options that are their own page (MM2 forms) are links. */
  href?: string | null
}

export interface SelectorGroup {
  id: string
  label: string
  /** single: one active (a radio group); toggle: each option on/off. */
  mode: 'single' | 'toggle'
  options: SelectorOption[]
}

type Format = (usd: number) => string

/**
 * Adopt Me's own colours (owner, 2026-10-12): the Fly potion is blue, the
 * Ride potion pink-red, Neon glows green, Mega Neon purple; Default is plain.
 */
export const AM_OPTION_COLOR: Record<string, string> = {
  default: '#C9CDD4',
  neon: '#4ADE80',
  mega: '#B57CFF',
  fly: '#4DA8FF',
  ride: '#FF5C8A',
  flyride: '#9F8CFF',
}

/* ── Adopt Me ─────────────────────────────────────────────────────────── */

export function amSelectorGroups(
  variant: Variant,
  opts: { format: Format; priceOf?: (v: Variant) => number | null | undefined; isAvailable?: (v: Variant) => boolean },
): SelectorGroup[] {
  const axes = variantToAxes(variant)
  const unavailable = (v: Variant) => (opts.isAvailable ? !opts.isAvailable(v) : false)
  const hint = (v: Variant) => {
    const p = opts.priceOf?.(v)
    return p != null && p > 0 ? opts.format(p) : null
  }

  const tier: SelectorGroup = {
    id: 'tier',
    label: 'Tier',
    mode: 'single',
    options: TIERS.map((t) => {
      const next = axesToVariant(retierAxes(axes, t.value))
      const withPotions = axesToVariant({ ...retierAxes(axes, t.value), fly: true, ride: true })
      return {
        key: t.value,
        label: t.short,
        color: AM_OPTION_COLOR[t.value],
        hint: opts.priceOf ? hint(next) : null,
        active: axes.tier === t.value,
        disabled: unavailable(next) && unavailable(withPotions),
      }
    }),
  }

  const flyRide = axes.fly || axes.ride
  const potion: SelectorGroup = {
    id: 'potion',
    label: 'Potion',
    mode: 'toggle',
    options: tierHasSplitPotions(axes.tier)
      ? [
          { key: 'fly', label: 'Fly', color: AM_OPTION_COLOR.fly, active: axes.fly, disabled: unavailable(amSelect(variant, 'potion', 'fly')) },
          { key: 'ride', label: 'Ride', color: AM_OPTION_COLOR.ride, active: axes.ride, disabled: unavailable(amSelect(variant, 'potion', 'ride')) },
        ]
      : [{ key: 'flyride', label: 'Fly Ride', color: AM_OPTION_COLOR.flyride, active: flyRide, disabled: unavailable(amSelect(variant, 'potion', 'flyride')) }],
  }

  return [tier, potion]
}

/** The code a pick resolves to (tier switch keeps a valid potion state). */
export function amSelect(variant: Variant, groupId: string, key: string): Variant {
  const axes = variantToAxes(variant)
  if (groupId === 'tier') return axesToVariant(retierAxes(axes, key as 'default' | 'neon' | 'mega'))
  if (key === 'fly') return axesToVariant({ ...axes, fly: !axes.fly })
  if (key === 'ride') return axesToVariant({ ...axes, ride: !axes.ride })
  const on = axes.fly || axes.ride
  return axesToVariant({ ...axes, fly: !on, ride: !on })
}

/* ── Steal a Brainrot ─────────────────────────────────────────────────── */

export function mutationGroup(
  mutations: ReadonlyArray<{ slug: string; name: string; color: string; priceUsd?: number | null }>,
  selectedSlug: string | null | undefined,
  format: Format,
): SelectorGroup {
  return {
    id: 'mutation',
    label: 'Mutation',
    mode: 'single',
    options: mutations.map((m) => ({
      key: m.slug,
      label: m.name,
      color: m.color,
      hint: m.priceUsd != null && m.priceUsd > 0 ? format(m.priceUsd) : null,
      active: m.slug === selectedSlug,
    })),
  }
}

/* ── Forms (MM2 Standard / Chroma, any linked variant) ────────────────── */

export function formGroup(
  forms: ReadonlyArray<{ key: string; label: string; href: string; priceUsd: number | null; color?: string | null; current: boolean }>,
  format: Format,
): SelectorGroup {
  return {
    id: 'form',
    label: 'Form',
    mode: 'single',
    options: forms.map((f) => ({
      key: f.key,
      label: f.label,
      href: f.href,
      color: f.color ?? null,
      hint: f.priceUsd != null && f.priceUsd > 0 ? format(f.priceUsd) : null,
      active: f.current,
    })),
  }
}
