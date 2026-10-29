'use client'

import { useId } from 'react'
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

interface Tile {
  key: string
  label: string
  code: string | null
  color: string
  on: boolean
  tap: () => void
}

/**
 * Adopt Me's trait picker (owner, 2026-10-27, design lab version 1): three
 * type tiles (Normal / Neon / Mega) and two potion tiles (Fly / Ride). The
 * pick is an outline in the trait's own colour, never a full fill; every
 * badge keeps its colour (owner, 2026-10-28), Normal gets a round badge of
 * its own, and a potion gets a tick. No prices before a pick:
 * the price is the buy box's job, the picked form's name sits on the label
 * row. Neon and Mega exclude each other, and on those tiers Fly and Ride
 * switch together (model/am-traits), so every tap lands on a listed form.
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

  const tiers: Tile[] = (
    [
      { k: 'normal', label: 'Normal', code: null },
      { k: 'neon', label: 'Neon', code: 'N' },
      { k: 'mega', label: 'Mega', code: 'M' },
    ] as Array<{ k: AmTier; label: string; code: string | null }>
  ).map((x) => ({ key: x.k, label: x.label, code: x.code, color: COLOR[x.k], on: (t?.tier ?? 'normal') === x.k, tap: () => onChange(withTier(value, x.k)) }))
  const potions: Tile[] = (['fly', 'ride'] as const).map((p) => ({
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

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiers.map((tile) => (
          <TileButton key={tile.key} tile={tile} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {potions.map((tile) => (
          <TileButton key={tile.key} tile={tile} potion />
        ))}
      </div>
    </div>
  )
}

function TileButton({ tile, potion = false }: { tile: Tile; potion?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={tile.on}
      onClick={tile.tap}
      className={cn(
        'flex h-12 items-center gap-2.5 rounded-md bg-white/[0.04] px-3 font-semibold transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        !potion && 'justify-center',
        tile.on ? 'text-text-primary' : 'text-text-secondary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
      )}
      style={{ fontSize: 'var(--fs-body)', ...(tile.on ? { boxShadow: `inset 0 0 0 1.5px ${tile.color}` } : {}) }}
    >
      {tile.code ? (
        <TraitMarks code={tile.code} size={20} className="shrink-0" />
      ) : (
        <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ background: NORMAL_DISC }}>
          <IconPaw size={13} stroke={2.4} />
        </span>
      )}
      <span className={cn(potion && 'flex-1 text-left')}>{tile.label}</span>
      {potion ? (
        <span
          aria-hidden
          className="grid h-5 w-5 place-items-center rounded-full transition-colors"
          style={tile.on ? { background: tile.color } : { boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.18)' }}
        >
          {tile.on ? <IconCheck size={13} stroke={3} className="text-[#141519]" /> : null}
        </span>
      ) : null}
    </button>
  )
}
