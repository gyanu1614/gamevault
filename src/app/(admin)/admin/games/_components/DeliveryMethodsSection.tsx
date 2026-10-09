'use client'

/**
 * Currency → "Delivery Method" (Gamepass, In-Game Shop Gifts, UID / Login …).
 * Off by default. When on, the seller wizard asks for one method per listing
 * and the buyer currency page shows + filters by it. Each method's tooltip
 * text is what sellers and buyers see behind the (i).
 *
 * Ids are generated once and stored on listings (delivery_method_type), so a
 * renamed method keeps its listings; a removed one simply stops matching.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { PanelHead, adminBtnSm } from '../../components/kit'
import { SwitchRow } from './form-bits'
import type { CurrencyDeliveryMethod, CurrencyDeliveryMethods } from '@/lib/types/category-configs'

const CARD = 'rounded-lg bg-bg-raised p-4 sm:p-5'
const ROW_INPUT = cn(accountInputCls, 'bg-white/[0.06]')
const ICON_BTN_DANGER =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors ' +
  'hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error'

const OFF: CurrencyDeliveryMethods = { enabled: false, options: [] }

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function DeliveryMethodsSection({
  value,
  onChange,
}: {
  value: CurrencyDeliveryMethods | undefined
  onChange: (next: CurrencyDeliveryMethods) => void
}) {
  const v = value ?? OFF
  const options = Array.isArray(v.options) ? v.options : []
  const set = (p: Partial<CurrencyDeliveryMethods>) => onChange({ ...v, options, ...p })
  const update = (i: number, p: Partial<CurrencyDeliveryMethod>) =>
    set({ options: options.map((o, idx) => (idx === i ? { ...o, ...p } : o)) })
  const remove = (i: number) => set({ options: options.filter((_, idx) => idx !== i) })
  const add = () => set({ options: [...options, { id: newId(), label: '', description: '' }] })

  return (
    <section className={CARD}>
      <PanelHead
        title="Delivery Method"
        subtitle="How sellers hand the currency over. Sellers pick one per offer; buyers see it and can filter by it."
        aside={
          <button type="button" onClick={add} className={adminBtnSm.secondary}>
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" /> Add Method
          </button>
        }
      />
      <div className="space-y-2">
        <SwitchRow
          label="Ask Sellers For A Delivery Method"
          hint={options.length === 0 ? 'Add at least one method below, then switch this on.' : 'Off = sellers are not asked and buyers see no method filter.'}
          checked={v.enabled === true}
          onCheckedChange={(enabled) => set({ enabled })}
        />
        {options.map((o, i) => (
          <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md bg-bg-overlay p-3">
            <div className="min-w-0 space-y-2">
              <input
                value={o.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Method name, e.g. Gamepass"
                aria-label={`Method ${i + 1} name`}
                maxLength={60}
                className={ROW_INPUT}
              />
              <textarea
                value={o.description}
                onChange={(e) => update(i, { description: e.target.value })}
                rows={3}
                placeholder="Tooltip: what this method means for the seller and the buyer"
                aria-label={`Method ${i + 1} tooltip`}
                maxLength={600}
                className={cn(ROW_INPUT, 'resize-none')}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className={cn(ICON_BTN_DANGER, 'self-start')}
              title="Remove"
              aria-label={`Remove method ${o.label || i + 1}`}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
