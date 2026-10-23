'use client'

import type { CSSProperties, ReactNode } from 'react'
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle'

export interface RarityFilterOption {
  key: string
  label: string
  color: string
  count?: number
  icon?: ReactNode
}

/** The view key every value list uses for "items new in the game" (isNewItem). */
export const NEW_VIEW = 'new'

/**
 * The New tile, the same on every values hub (owner, 2026-10-23: "New in
 * green with an icon"). The lime accent, like the New tag. Callers drop it
 * when the count is 0.
 */
export function newFilterOption(count: number): RarityFilterOption {
  return { key: NEW_VIEW, label: 'New', color: 'var(--color-accent-default)', count, icon: <SparkleIcon aria-hidden size={15} weight="fill" /> }
}

/**
 * Filter row of filled tiles: each a dim tint of its colour at rest, solid
 * with dark ink when active. No outlines; stretches to the toolbar width and
 * scrolls sideways on phones.
 */
export function RarityFilterBar({
  options,
  value,
  onChange,
  label = 'Filter by rarity',
}: {
  options: RarityFilterOption[]
  value: string
  onChange: (key: string) => void
  label?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => {
        const active = o.key === value
        const style: CSSProperties = active
          ? { backgroundColor: o.color, color: '#0B0810' }
          : {
              backgroundColor: `color-mix(in srgb, ${o.color} 14%, transparent)`,
              color: `color-mix(in srgb, ${o.color} 78%, #E6EAE7)`,
            }
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            style={style}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2.5 text-body-sm font-semibold transition-[filter,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              active ? '' : 'hover:brightness-125'
            }`}
          >
            {o.icon}
            {o.label}
            {o.count != null && (
              <span className={active ? 'text-[#0C0F0E]/55' : 'opacity-60'}>{o.count.toLocaleString('en-US')}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
