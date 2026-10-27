'use client'

import { useId } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import { amTrait, withPotion, withTier } from './model/am-traits'
import type { TraitOption } from './model/offers'

/**
 * Adopt Me's trait picker as on/off filters (owner, 2026-10-27: "traits
 * should be like filter, on or off"; no prices before a pick). Two small
 * groups the way players think of a pet — Neon / Mega Neon, then the Fly and
 * Ride potions — each row the game's badge, its name and the house Switch in
 * the badge's colour. The picked form's name sits on the label row; the price
 * is the buy box's job. Neon and Mega exclude each other, and on those tiers
 * Fly and Ride switch together (model/am-traits).
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
  const t = amTrait(value)
  const current = options.find((o) => o.variant === value) ?? null

  const groups = [
    [
      { code: 'N', label: 'Neon', on: t?.tier === 'neon', set: (on: boolean) => onChange(withTier(value, on ? 'neon' : 'normal')), track: 'data-[state=checked]:bg-[#8DC54A]' },
      { code: 'M', label: 'Mega Neon', on: t?.tier === 'mega', set: (on: boolean) => onChange(withTier(value, on ? 'mega' : 'normal')), track: 'data-[state=checked]:bg-[#8B3CF6]' },
    ],
    [
      { code: 'F', label: 'Fly', on: !!t?.fly, set: () => onChange(withPotion(value, 'fly')), track: 'data-[state=checked]:bg-[#3298CB]' },
      { code: 'R', label: 'Ride', on: !!t?.ride, set: () => onChange(withPotion(value, 'ride')), track: 'data-[state=checked]:bg-[#EA2E77]' },
    ],
  ]

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

      <div className="mt-3 space-y-2">
        {groups.map((rows, g) => (
          <ul key={g} className="overflow-hidden rounded-lg bg-[#1F2025] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {rows.map((r, i) => {
              const rowId = `${id}-${r.code}`
              return (
                <li key={r.code} className={cn(i > 0 && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]')}>
                  <label htmlFor={rowId} className="flex h-12 cursor-pointer items-center gap-3 px-4 transition-colors hover:bg-white/[0.025]">
                    <TraitMarks code={r.code} size={22} className={cn('transition-[filter,opacity]', !r.on && 'opacity-60 grayscale')} />
                    <span className={cn('flex-1 font-semibold transition-colors', r.on ? 'text-text-primary' : 'text-text-secondary')} style={{ fontSize: 'var(--fs-body)' }}>
                      {r.label}
                    </span>
                    <Switch id={rowId} checked={r.on} onCheckedChange={r.set} className={cn('data-[state=unchecked]:bg-[#35363D]', r.track)} />
                  </label>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </div>
  )
}
