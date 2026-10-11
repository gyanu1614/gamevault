'use client'

import { Clock, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SELLER_DELIVERY_WINDOWS, formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { DeliveryMethodPicker } from '@/app/(sell)/_components/DeliveryMethodPicker'

import { SubCard } from '../../ui/SubCard'
import { TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/**
 * Delivery: the time window (manual only; instant has none), the currency
 * delivery method when the game has them (Gamepass, UID / Login …), and
 * Manual / Instant. The promise comes before the mechanism.
 */
export function DeliverySection({
  p,
}: {
  p: Pick<Step4Props, 'deliveryMethod' | 'setDeliveryMethod' | 'deliveryTime' | 'setDeliveryTime' | 'allowedDeliveryModes' | 'deliveryMethods' | 'deliveryMethodType' | 'onDeliveryMethodType'>
}) {
  return (
    <>
{p.deliveryMethod === 'manual' && (
<SubCard title="Delivery Time">
  {(() => {
    // One dropdown instead of a wall of pills. The list is shared
    // with the listings-table bulk editor (SELLER_DELIVERY_WINDOWS),
    // so both surfaces offer exactly the same promises.
    //
    // An existing listing can hold a value we no longer offer
    // (instant, 5min, 20min, an old custom "45min"). Remapping it
    // silently would change a live promise the seller made to
    // buyers, so it is shown as its own "current" option until
    // they choose a new window.
    const offered = SELLER_DELIVERY_WINDOWS.some((w) => w.value === p.deliveryTime)
    return (
      <div className="space-y-2">
        <Select value={p.deliveryTime} onValueChange={(v) => p.setDeliveryTime(v)}>
          <SelectTrigger
            aria-label="Guaranteed delivery time"
            className="h-11 text-base sm:h-10 sm:text-sm focus:border-text-secondary focus:ring-0 data-[state=open]:border-text-secondary data-[state=open]:ring-0"
          >
            <SelectValue placeholder="Choose a delivery time" />
          </SelectTrigger>
          {/* ~5.5 rows visible: the half row at the bottom is the
              cue that the list scrolls. Rows stay 36px on touch
              screens and tighten to 32px with a mouse. */}
          <SelectContent className="max-h-[200px]">
            {!offered && p.deliveryTime && (
              <SelectItem value={p.deliveryTime} className="sm:py-1.5">
                {formatDeliveryLabel(p.deliveryTime)} (current)
              </SelectItem>
            )}
            {SELLER_DELIVERY_WINDOWS.map((w) => (
              <SelectItem key={w.value} value={w.value} className="sm:py-1.5">
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TipBox>The longest you will take. Faster windows rank higher.</TipBox>
      </div>
    )
  })()}
</SubCard>
)}

{/* Currency delivery method (Gamepass, UID / Login …), per game,
    admin-switched. The Manual / Instant card below is the
    Delivery Type. */}
{p.deliveryMethods.length > 0 && (
  <SubCard title="Delivery Method">
    <DeliveryMethodPicker
      methods={p.deliveryMethods}
      value={p.deliveryMethodType}
      onChange={p.onDeliveryMethodType}
    />
  </SubCard>
)}

<SubCard title="Delivery Type">
  <div>
    <RadioGroup
      value={p.deliveryMethod}
      onValueChange={(v) => p.setDeliveryMethod(v as 'manual' | 'instant')}
      className="grid gap-2 sm:grid-cols-2"
    >
      {(['manual', 'instant'] as const).map((m) => {
        const allowed = p.allowedDeliveryModes.includes(m)
        const on = p.deliveryMethod === m
        const Icon = m === 'manual' ? Clock : Zap
        return (
          <label
            key={m}
            className={cn(
              'relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
              !allowed && 'cursor-not-allowed opacity-40',
              on && allowed
                ? 'border-lime bg-lime-tint-bg'
                : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover',
            )}
          >
            <RadioGroupItem
              value={m}
              disabled={!allowed}
              className="sr-only"
            />
            <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-lime-text' : 'text-text-tertiary')} />
            <div>
              <div className="text-[13.5px] font-semibold text-text-primary">
                {m === 'manual' ? 'Manual Delivery' : 'Instant Delivery'}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-text-tertiary">
                {m === 'manual' ? 'You deliver within your chosen time window.' : 'Codes and credentials sent automatically.'}
              </div>
            </div>
          </label>
        )
      })}
    </RadioGroup>
  </div>

</SubCard>
    </>
  )
}
