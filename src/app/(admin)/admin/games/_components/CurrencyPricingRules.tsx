'use client'

/**
 * Pricing Rules card of the per-game currency editor (rewritten 2026-10-04).
 *
 * One switch for how the currency sells, then only the fields that apply:
 *   Flexible Amount   price per unit (min, optional max, up to 8 decimals),
 *                     unit size, minimum order, quantity step
 *   Fixed Bundles     price per bundle (min, optional max)
 * Every field explains itself, a live example shows the rule in money, and
 * a short summary says what sellers will see. The amounts are kept as text
 * here and parsed on save (CurrencyConfigForm) through price-rule-form.ts,
 * the same reading the listing validator uses.
 *
 * Mode is DATA, not a setting: a currency sells in bundles exactly when it
 * has at least one bundle (the wizard, buyer page and validator all key off
 * that). The switch shows which fields apply and says what to change in the
 * Fixed Bundles card; it never deletes bundles on its own.
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { cn } from '@/lib/utils'
import { PanelHead } from '../../components/kit'
import type { CurrencyConfig } from '@/lib/types/category-configs'
import { currencyPricingMode, type PricingMode } from '@/lib/currency/price-rules'
import { formatUnitPrice, isRuleAmountInput } from '@/lib/currency/price-format'
import { quantityUnit } from '@/lib/currency/quantity-unit'
import {
  LISTING_PRICE_STEP,
  bundleExample,
  flexibleExample,
  parseRuleTexts,
  perSingleUnitText,
  type RuleTexts,
} from '@/lib/currency/price-rule-form'

const CARD = 'rounded-lg bg-bg-raised p-4 sm:p-5'
const NOTE = 'rounded-md bg-bg-overlay px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary'

export function CurrencyPricingRules({
  draft,
  patch,
  texts,
  onTexts,
  showErrors,
}: {
  draft: CurrencyConfig
  patch: (p: Partial<CurrencyConfig>) => void
  texts: RuleTexts
  onTexts: (t: RuleTexts) => void
  /** True after a save attempt, so errors show even on untouched fields. */
  showErrors: boolean
}) {
  const dataMode = currencyPricingMode(draft)
  const [view, setView] = useState<PricingMode>(dataMode)
  const [touched, setTouched] = useState<Partial<Record<keyof RuleTexts, boolean>>>({})
  const bundleCount = draft.bundles?.length ?? 0
  const unit = (draft.unit_label || 'unit').trim()
  const per = quantityUnit(draft.quantity_granularity, unit)
  const parsed = parseRuleTexts(texts)
  const errorOf = (k: keyof RuleTexts) =>
    !parsed.ok && (showErrors || touched[k]) ? parsed.errors[k] : undefined

  const setText = (k: keyof RuleTexts, raw: string) => {
    const v = raw.replace(',', '.').trim()
    if (isRuleAmountInput(v)) onTexts({ ...texts, [k]: v })
  }

  const amount = (
    k: keyof RuleTexts,
    id: string,
    label: string,
    hint: string,
    placeholder: string,
    /** Line under the box, e.g. the per-single-unit equivalent of a per-K price. */
    below?: string | null,
  ) => (
    <Field label={label} hint={hint} htmlFor={id} error={errorOf(k)}>
      <div
        className={cn(
          'flex h-10 items-center rounded-md bg-bg-overlay transition-colors focus-within:ring-2 focus-within:ring-focus-soft',
          errorOf(k) && 'ring-1 ring-error',
        )}
      >
        <span aria-hidden className="pl-3.5 pr-1 text-[14px] text-text-tertiary">$</span>
        {/* Text + decimal keypad, not type="number": a number input's step
            refused anything past its step (0.0001) and printed 1e-7. */}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texts[k]}
          placeholder={placeholder}
          onChange={(e) => setText(k, e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
          aria-invalid={errorOf(k) ? true : undefined}
          aria-describedby={errorOf(k) ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-base tabular-nums text-text-primary placeholder:text-text-disabled focus:outline-none sm:text-[14px]"
        />
      </div>
      {below && <p className="mt-1.5 text-[12px] tabular-nums leading-snug text-text-tertiary">{below}</p>}
    </Field>
  )

  const v = parsed.value
  const flexExample = flexibleExample({
    unitMin: v.unitMin,
    unitMax: v.unitMax,
    granularity: draft.quantity_granularity,
    unitLabel: unit,
    minQuantity: draft.min_quantity,
  })
  const firstBundle = [...(draft.bundles ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.amount - b.amount,
  )[0]
  const range = (min: number | null, max: number | null, what: string) =>
    min != null && max != null
      ? `${formatUnitPrice(min)} to ${formatUnitPrice(max)} ${what}`
      : min != null
        ? `${formatUnitPrice(min)} or more ${what}`
        : max != null
          ? `up to ${formatUnitPrice(max)} ${what}`
          : `any price ${what}`

  return (
    <section className={CARD}>
      <PanelHead
        title="Pricing Rules"
        subtitle="How sellers price this currency. The sell wizard shows these limits under the price, and the server refuses a listing outside them."
      />

      <div className="space-y-2">
        <SegmentedTabs
          tabs={[
            { id: 'flexible', label: 'Flexible Amount' },
            { id: 'bundles', label: 'Fixed Bundles' },
          ]}
          value={view}
          onChange={setView}
          layoutId="currency-pricing-mode"
          ariaLabel="How this currency sells"
        />
        <p className="text-[13px] leading-relaxed text-text-tertiary">
          {view === 'flexible'
            ? `Sellers list any amount and set a price per ${per}. Buyers choose how much to buy, like Robux.`
            : 'Sellers pick one of your bundles and set a price for the whole bundle. Buyers pick a bundle, like V-Bucks packs.'}
        </p>
      </div>

      {view !== dataMode && (
        <p className={cn(NOTE, 'mt-3')} role="status">
          {view === 'bundles'
            ? 'No bundles yet. Add at least one in Fixed Bundles below and save; until then sellers list flexible amounts.'
            : `This currency has ${bundleCount} ${bundleCount === 1 ? 'bundle' : 'bundles'} in Fixed Bundles below, so sellers still see bundles. Remove them and save to switch to flexible amounts. Bundle listings stop showing once their bundle is gone.`}
        </p>
      )}

      {view === 'flexible' ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Unit Size"
              hint={`What one unit of quantity is. Pick Thousand or Million when one ${unit} is worth very little.`}
              htmlFor="cc-granularity"
            >
              <Select
                value={draft.quantity_granularity ?? 'unit'}
                onValueChange={(g) => patch({ quantity_granularity: g as CurrencyConfig['quantity_granularity'] })}
              >
                <SelectTrigger
                  id="cc-granularity"
                  className="h-10 rounded-md border-0 bg-bg-overlay px-3.5 hover:bg-bg-overlay-2 data-[state=open]:ring-focus-soft"
                >
                  <SelectValue placeholder="Single Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Single Unit (1 {unit})</SelectItem>
                  <SelectItem value="thousand">Thousand (1 K = 1,000)</SelectItem>
                  <SelectItem value="million">Million (1 M = 1,000,000)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {amount(
              'unitMin',
              'cc-unit-min',
              `Minimum Price per ${per}`,
              'Optional. Up to 8 decimal places.',
              'No minimum',
              perSingleUnitText(v.unitMin, draft.quantity_granularity, unit),
            )}
            {amount(
              'unitMax',
              'cc-unit-max',
              `Maximum Price per ${per}`,
              'Optional. Leave blank for no maximum.',
              'No maximum',
              perSingleUnitText(v.unitMax, draft.quantity_granularity, unit),
            )}
            <Field label="Minimum Order" hint={`The smallest order a seller may offer, in ${per}.`} htmlFor="cc-min-quantity">
              <input
                id="cc-min-quantity"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={draft.min_quantity}
                onChange={(e) => patch({ min_quantity: Math.max(1, parseInt(e.target.value || '1', 10) || 1) })}
                className={cn(accountInputCls, 'tabular-nums')}
              />
            </Field>
            <Field label="Quantity Step" hint="How much the buyer’s + and − buttons add or remove." htmlFor="cc-quantity-step">
              <input
                id="cc-quantity-step"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={draft.quantity_step}
                onChange={(e) => patch({ quantity_step: Math.max(1, parseInt(e.target.value || '1', 10) || 1) })}
                className={cn(accountInputCls, 'tabular-nums')}
              />
            </Field>
          </div>

          {v.unitMin != null && v.unitMin < LISTING_PRICE_STEP && (
            <p className={NOTE}>
              Sellers price per {per} to 4 decimal places, so a minimum under $0.0001 has no effect.
              If one {per === unit ? unit : `${per} of ${unit}`} is worth less than that, set Unit Size to Thousand or Million.
            </p>
          )}
          {flexExample && <p className="text-[13px] leading-relaxed text-text-secondary">{flexExample}</p>}

          <Summary
            lines={[
              `The price box reads “Price Per ${per}”.`,
              `Accepted price: ${range(v.unitMin, v.unitMax, `per ${per}`)}.`,
              `Smallest order a seller may set: ${Math.max(1, draft.min_quantity || 1).toLocaleString('en-US')} ${per}.`,
            ]}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {amount('bundleMin', 'cc-bundle-min', 'Minimum Price per Bundle', 'Optional. Applies to every bundle.', 'No minimum')}
            {amount('bundleMax', 'cc-bundle-max', 'Maximum Price per Bundle', 'Optional. Leave blank for no maximum.', 'No maximum')}
          </div>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            {bundleExample({ bundleMin: v.bundleMin, bundleMax: v.bundleMax, bundleName: firstBundle?.name ?? null })}
          </p>
          <Summary
            lines={[
              bundleCount > 0
                ? `Sellers choose one of ${bundleCount} ${bundleCount === 1 ? 'bundle' : 'bundles'} and see “Price Per Bundle”.`
                : 'Sellers will choose from the bundles you add below.',
              `Accepted price: ${range(v.bundleMin, v.bundleMax, 'per bundle')}.`,
              'Each bundle sells whole: buyers buy one or more bundles.',
            ]}
          />
        </div>
      )}
    </section>
  )
}

function Summary({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-md bg-bg-overlay px-3.5 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-tertiary">What Sellers See</p>
      <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-text-secondary">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text-secondary">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{hint}</p>}
      </div>
      <div className="mt-auto">{children}</div>
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-[12px] leading-snug text-error">
          {error}
        </p>
      )}
    </div>
  )
}
