'use client'

import { SubCard } from '../../ui/SubCard'
import { FieldHint } from '../../ui/form-fields'
import { QuantityInput, StockStepper } from '../../ui/quantity-inputs'
import type { Step4Props } from './types'

/**
 * Stock, and (flexible currency) the minimum order. Quantity comes before
 * Price: how much you have before what each unit costs.
 */
const numOr = (raw: string, fallback: number) => {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

export function QuantitySection({
  p,
  isCurrency,
  isBundleMode,
  suffix,
}: {
  p: Pick<Step4Props, 'quantity' | 'setQuantity' | 'minQuantity' | 'setMinQuantity' | 'adminMinQuantity'>
  isCurrency: boolean
  isBundleMode: boolean
  suffix: string | null
}) {
  const adminMin = Math.max(1, p.adminMinQuantity ?? 1)
  const stockNow = Number.isFinite(parseInt(p.quantity, 10)) ? parseInt(p.quantity, 10) : 1
  const typedMinNow = parseInt(p.minQuantity, 10)
  const minAboveStock = Number.isFinite(typedMinNow) && stockNow > 0 && typedMinNow > stockNow
  return (
<SubCard title="Quantity">
  {isCurrency && !isBundleMode ? (
    // Stock + minimum: two plain boxes, stock on the left. No
    // steppers here — at these magnitudes nobody steps by one,
    // and two stepper rows side by side crowd a phone.
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-text-secondary">
          Total Stock Available
        </label>
        <QuantityInput
          value={numOr(p.quantity, 1)}
          onChange={(n) => p.setQuantity(String(n))}
          min={1}
          max={10_000_000}
          suffix={suffix}
          ariaLabel="Total stock available"
        />
      </div>

      {/* Floor = the per-game admin minimum; ceiling = stock,
          since a minimum above stock can never sell. */}
      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-text-secondary">
          Minimum Offer Quantity
        </label>
        <QuantityInput
          value={numOr(p.minQuantity, adminMin)}
          onChange={(n) => p.setMinQuantity(String(n))}
          min={adminMin}
          max={Math.max(adminMin, stockNow)}
          suffix={suffix}
          ariaLabel="Minimum offer quantity"
        />
        {/* No tip: the label explains itself. Only the
            warning remains, because it reports a problem the
            seller can't otherwise see (it is fixed on save). */}
        {minAboveStock && (
          <FieldHint className="mt-2 text-warning">
            {`Above your stock. It will be lowered to ${stockNow.toLocaleString()} ${suffix ?? ''} when saved.`.replace('  ', ' ')}
          </FieldHint>
        )}
      </div>
    </div>
  ) : (
    // Stock alone (items, accounts, bundles): small counts,
    // where stepping by one is exactly what a seller does.
    <StockStepper
      value={numOr(p.quantity, 1)}
      onChange={(n) => p.setQuantity(String(n))}
      suffix={suffix}
      hint={isBundleMode ? 'Each unit is one bundle you can deliver.' : null}
    />
  )}
</SubCard>
  )
}
