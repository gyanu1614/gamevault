'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { IconCheck, IconPaw } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import { amTrait, withPotion, withTier, type AmTier } from './model/am-traits'
import type { TraitOption } from './model/offers'

/** The badges' own colours (TraitMarks); Normal is neutral. */
const COLOR = { normal: '#C9CCD3', neon: '#8DC54A', mega: '#A970FF', fly: '#3298CB', ride: '#EA2E77' } as const
/** Normal's round badge: the N/F/R disc in a neutral grey. */
const NORMAL_DISC = '#7C808A'

interface Choice {
  key: string
  label: string
  code: string | null
  color: string
  on: boolean
  tap: () => void
}

/**
 * Adopt Me's trait picker. Owner rules: the pick is an outline in the
 * trait's own colour, never a full fill, and every badge keeps its colour
 * (2026-10-27/28). 2026-11-02 ("too big, congested"): the type is ONE
 * segmented control (Normal / Neon / Mega) whose outline glides to the pick,
 * and the potions are two slim toggles on one row — about half the old
 * height. No prices before a pick: the price is the buy box's job; the
 * picked form's name sits on the label row. Neon and Mega exclude each other,
 * and on those tiers Fly and Ride switch together (model/am-traits), so every
 * tap lands on a listed form.
 */
export function TraitSwitches({
  noun,
  options,
  value,
  onChange,
}: {
  noun: string
  options: TraitOption[]
  value: string | null
  onChange: (variant: string) => void
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const t = amTrait(value)
  const current = options.find((o) => o.variant === value) ?? null

  const tiers: Choice[] = (
    [
      { k: 'normal', label: 'Normal', code: null },
      { k: 'neon', label: 'Neon', code: 'N' },
      { k: 'mega', label: 'Mega', code: 'M' },
    ] as Array<{ k: AmTier; label: string; code: string | null }>
  ).map((x) => ({ key: x.k, label: x.label, code: x.code, color: COLOR[x.k], on: (t?.tier ?? 'normal') === x.k, tap: () => onChange(withTier(value, x.k)) }))
  const potions: Choice[] = (['fly', 'ride'] as const).map((p) => ({
    key: p,
    label: p === 'fly' ? 'Fly' : 'Ride',
    code: p === 'fly' ? 'F' : 'R',
    color: COLOR[p],
    on: !!t?.[p],
    tap: () => onChange(withPotion(value, p)),
  }))

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <div className="flex items-baseline justify-between gap-3" style={{ fontSize: 'var(--fs-body)' }}>
        <span id={`${id}-label`} className="text-text-tertiary">
          {noun}
        </span>
        {current ? (
          <span className="truncate font-semibold text-text-primary">
            <TraitName traitKey={current.variant} label={current.label} />
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-black/25 p-1">
        {tiers.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.on}
            onClick={c.tap}
            className={cn(
              'relative flex h-10 items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              c.on ? 'text-text-primary' : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
            )}
            style={{ fontSize: 'var(--fs-body)' }}
          >
            {c.on ? (
              <motion.span
                aria-hidden
                layoutId={`${id}-tier`}
                className="absolute inset-0 rounded-md bg-white/[0.08]"
                style={{ boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 }}
              />
            ) : null}
            <span className="relative flex items-center gap-2">
              {c.code ? (
                <TraitMarks code={c.code} size={18} className="shrink-0" />
              ) : (
                <span aria-hidden className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-white" style={{ background: NORMAL_DISC }}>
                  <IconPaw size={12} stroke={2.4} />
                </span>
              )}
              {c.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {potions.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.on}
            onClick={c.tap}
            className={cn(
              'flex h-10 items-center gap-2 rounded-md px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              c.on ? 'bg-white/[0.08] text-text-primary' : 'bg-black/25 text-text-secondary hover:bg-white/[0.05] hover:text-text-primary',
            )}
            style={{ fontSize: 'var(--fs-body)', ...(c.on ? { boxShadow: `inset 0 0 0 1.5px ${c.color}` } : {}) }}
          >
            <TraitMarks code={c.code ?? ''} size={18} className="shrink-0" />
            <span className="flex-1 text-left">{c.label}</span>
            <span
              aria-hidden
              className="grid h-[18px] w-[18px] place-items-center rounded-full transition-colors"
              style={c.on ? { background: c.color } : { boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.18)' }}
            >
              {c.on ? <IconCheck size={12} stroke={3} className="text-[#141519]" /> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
