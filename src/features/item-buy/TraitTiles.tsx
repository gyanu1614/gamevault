'use client'

import { useId } from 'react'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { motion, useReducedMotion } from 'framer-motion'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import type { TraitOption } from './model/offers'

/**
 * Adopt Me's trait picker (owner, 2026-10-27): every form on show at once as a
 * tile with the game's own badges and its cheapest price — StockX's size grid
 * with Starpets' badge chips. The picked form's name sits on the label row
 * (Apple's "Finish — Midnight") and a fill slides to its tile. A form nobody
 * sells says Notify Me; picking it turns the buy box into Notify Me.
 * Radix RadioGroup: one tab stop, arrow keys move the pick.
 */
export function TraitTiles({
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
  const current = options.find((o) => o.variant === value) ?? null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3" style={{ fontSize: 'var(--fs-body)' }}>
        <span id={`${id}-label`} className="text-text-tertiary">
          {noun}
        </span>
        {current ? (
          <span className="truncate font-semibold text-text-primary">
            <TraitName traitKey={current.count > 0 ? current.variant : null} label={current.label} />
          </span>
        ) : null}
      </div>

      <RadioGroup.Root aria-labelledby={`${id}-label`} value={value ?? ''} onValueChange={onChange} loop className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
        {options.map((o) => {
          const on = o.variant === value
          const price = o.minPriceUsd != null ? `$${formatStatPrice(o.minPriceUsd)}` : null
          return (
            <RadioGroup.Item
              key={o.variant}
              value={o.variant}
              aria-label={`${o.label}, ${price ? `from ${price}` : 'none for sale'}`}
              className={cn(
                'relative flex h-16 flex-col items-center justify-center gap-1.5 rounded-md bg-[#212228] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                !on && 'hover:bg-[#28292F]',
              )}
            >
              {on ? (
                <motion.span
                  layoutId={`${id}-pick`}
                  aria-hidden
                  className="absolute inset-0 rounded-md bg-lime-tint-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                />
              ) : null}
              <span className={cn('relative flex h-5 items-center', o.count === 0 && 'opacity-50 grayscale')}>
                {o.short ? (
                  <TraitMarks code={o.short} />
                ) : (
                  <span className="font-semibold text-text-secondary" style={{ fontSize: 'var(--fs-caption)' }}>
                    {o.label}
                  </span>
                )}
              </span>
              <span
                className={cn('relative tabular-nums', price ? cn('font-semibold', on ? 'text-lime-text' : 'text-text-primary') : 'text-text-tertiary')}
                style={{ fontSize: price ? 'var(--fs-meta)' : 'var(--fs-micro)' }}
              >
                {price ?? 'Notify Me'}
              </span>
            </RadioGroup.Item>
          )
        })}
      </RadioGroup.Root>
    </div>
  )
}
