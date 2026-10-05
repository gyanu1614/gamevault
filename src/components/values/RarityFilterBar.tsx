'use client'

import type { CSSProperties } from 'react'

export interface RarityFilterOption {
  key: string
  label: string
  color: string
  count?: number
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
