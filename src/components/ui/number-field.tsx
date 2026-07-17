'use client'

/**
 * NumberField — accessible stepper control.
 *
 * Built on react-aria-components NumberField, themed with GV tokens.
 * Layout (RACGroup as the single focus-ring owner):
 *   [−]  [ number  suffix ]  [+]
 *
 * Why not a hand-rolled stepper:
 *   - Locale-aware number formatting (commas, decimal separators)
 *   - Real keyboard support (Up/Down/PgUp/PgDn/Home/End)
 *   - Long-press repeat on the + / − buttons
 *   - Screen reader semantics out of the box (aria-valuenow / -min / -max)
 *   - Disabled / readonly / invalid states wired correctly
 *
 * V19/P18 — Restructured so the optional `suffix` sits inside the
 * same flex row as the input (sharing the focus ring) and the value
 * stays visually centered as "{number} {suffix}", which reads as one
 * unit ("100 K") rather than two stacked tokens.
 *
 * Usage:
 *   <NumberField value={qty} onChange={setQty} minValue={1} suffix="K" />
 */

import * as React from 'react'
import {
  Button as RACButton,
  Group as RACGroup,
  Input as RACInput,
  NumberField as RACNumberField,
  type NumberFieldProps as RACNumberFieldProps,
} from 'react-aria-components'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NumberFieldProps extends Omit<RACNumberFieldProps, 'children'> {
  className?: string
  /** Optional ARIA label when no visible <Label/> is paired with the field */
  ariaLabel?: string
  /**
   * Static text suffix shown inside the input surface, immediately to
   * the right of the number. Decorative — readonly, not part of the
   * input value. Defaults to no suffix.
   */
  suffix?: string | null
}

export const NumberField = React.forwardRef<HTMLDivElement, NumberFieldProps>(
  ({ className, ariaLabel, suffix, ...props }, ref) => {
    return (
      <RACNumberField {...props} aria-label={ariaLabel ?? props['aria-label']}>
        <RACGroup
          ref={ref}
          className={cn(
            'flex h-10 w-full items-stretch overflow-hidden rounded-md border border-border-default bg-transparent',
            'transition-colors focus-within:border-lime focus-within:ring-2 focus-within:ring-lime-tint-bg',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            className,
          )}
        >
          <RACButton
            slot="decrement"
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-r border-border-default text-text-secondary transition-colors',
              'hover:bg-bg-raised-hover hover:text-text-primary',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent',
              'focus:outline-none focus-visible:shadow-none',
            )}
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </RACButton>

          {/*
            Centered value row. The input is content-width (right-aligned
            with no padding) and the suffix sits next to it; together
            they're centered as one unit inside the flexbox. When there's
            no suffix, the input fills the full width and centers itself.
          */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3">
            <RACInput
              size={suffix ? 6 : undefined}
              // V19/P24/P7.c — Select-all on focus so typing replaces
              // the current value instead of appending. Matches the
              // way native steppers feel in spreadsheets / Stripe.
              onFocus={(e) => e.currentTarget.select()}
              className={cn(
                // 16px below sm so iOS Safari doesn't auto-zoom on focus.
                'min-w-0 bg-transparent text-base font-medium text-text-primary sm:text-sm',
                'tabular-nums placeholder:text-text-tertiary',
                'focus:outline-none focus-visible:shadow-none',
                suffix ? 'w-auto text-right' : 'w-full text-center',
              )}
            />
            {suffix && (
              <span
                aria-hidden="true"
                className="select-none text-sm font-medium text-text-tertiary"
              >
                {suffix}
              </span>
            )}
          </div>

          <RACButton
            slot="increment"
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-l border-border-default text-text-secondary transition-colors',
              'hover:bg-bg-raised-hover hover:text-text-primary',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent',
              'focus:outline-none focus-visible:shadow-none',
            )}
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </RACButton>
        </RACGroup>
      </RACNumberField>
    )
  },
)
NumberField.displayName = 'NumberField'
