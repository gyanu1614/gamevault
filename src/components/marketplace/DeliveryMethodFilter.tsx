'use client'

import { DeliveryMethodInfo } from '@/components/marketplace/DeliveryMethodInfo'
import type { CurrencyDeliveryMethod } from '@/lib/types/category-configs'
import { cn } from '@/lib/utils'

/**
 * Buyer filter for currency delivery methods ("All Methods · Gamepass ·
 * UID / Login"). Only methods some live offer uses are passed in; each chip
 * carries the admin's (i) explanation. Neutral pills, like the sort tabs.
 */
export function DeliveryMethodFilter({
  methods,
  value,
  onChange,
}: {
  methods: readonly CurrencyDeliveryMethod[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  if (methods.length === 0) return null
  const chip = (on: boolean) =>
    cn(
      'inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
      on ? 'bg-white/[0.12] text-text-primary' : 'bg-bg-overlay text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
    )
  return (
    <div role="group" aria-label="Filter by delivery method" className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
        All Methods
      </button>
      {methods.map((m) => (
        <span key={m.id} className={cn(chip(value === m.id), 'pr-1.5')}>
          <button type="button" aria-pressed={value === m.id} onClick={() => onChange(value === m.id ? null : m.id)} className="py-2">
            {m.label}
          </button>
          <DeliveryMethodInfo label={m.label} description={m.description} />
        </span>
      ))}
    </div>
  )
}
