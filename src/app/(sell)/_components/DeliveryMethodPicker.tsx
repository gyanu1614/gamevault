'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DeliveryMethodInfo } from '@/components/marketplace/DeliveryMethodInfo'
import type { CurrencyDeliveryMethod } from '@/lib/types/category-configs'
import { cn } from '@/lib/utils'

/**
 * Currency "Delivery Method" (Gamepass, In-Game Shop Gifts, UID / Login …):
 * one per listing, from the game's admin list. Each option carries an (i)
 * with the admin's explanation. Rendered only when the game has it on.
 */
export function DeliveryMethodPicker({
  methods,
  value,
  onChange,
}: {
  methods: readonly CurrencyDeliveryMethod[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 sm:grid-cols-2" aria-label="Delivery method">
      {methods.map((m) => {
        const on = value === m.id
        return (
          <label
            key={m.id}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
              on ? 'border-lime bg-lime-tint-bg' : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover',
            )}
          >
            <RadioGroupItem value={m.id} />
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text-primary">{m.label}</span>
            <DeliveryMethodInfo label={m.label} description={m.description} />
          </label>
        )
      })}
    </RadioGroup>
  )
}
