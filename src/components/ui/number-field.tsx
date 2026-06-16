'use client'

/**
 * NumberField — accessible stepper control.
 *
 * Built on react-aria-components NumberField, themed with GV tokens.
 * Layout:  [−]  [box-with-number]  [+]
 *
 * Why not a hand-rolled stepper:
 *   - Locale-aware number formatting (commas, decimal separators)
 *   - Real keyboard support (Up/Down/PgUp/PgDn/Home/End)
 *   - Long-press repeat on the + / − buttons
 *   - Screen reader semantics out of the box (aria-valuenow / -min / -max)
 *   - Disabled / readonly / invalid states wired correctly
 *
 * Usage:
 *   <NumberField value={qty} onChange={setQty} minValue={1} maxValue={9999} />
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
}

export const NumberField = React.forwardRef<HTMLDivElement, NumberFieldProps>(
  ({ className, ariaLabel, ...props }, ref) => {
    return (
      <RACNumberField {...props} aria-label={ariaLabel ?? props['aria-label']}>
        <RACGroup
          ref={ref}
          className={cn(
            // R14 — reverted to rounded-md; transparent fill kept.
            'flex h-10 w-full items-stretch overflow-hidden rounded-md border border-border-default bg-transparent',
            'transition-colors focus-within:border-lime focus-within:ring-2 focus-within:ring-lime-tint-bg',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            className
          )}
        >
          <RACButton
            slot="decrement"
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-r border-border-default text-text-secondary transition-colors',
              'hover:bg-bg-raised-hover hover:text-text-primary',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent',
              'focus:outline-none'
            )}
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </RACButton>

          <RACInput
            className={cn(
              // Flex middle: the actual number readout
              'min-w-0 flex-1 bg-transparent px-3 text-center text-sm font-medium text-text-primary',
              'tabular-nums placeholder:text-text-tertiary',
              'focus:outline-none'
            )}
          />

          <RACButton
            slot="increment"
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-l border-border-default text-text-secondary transition-colors',
              'hover:bg-bg-raised-hover hover:text-text-primary',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent',
              'focus:outline-none'
            )}
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </RACButton>
        </RACGroup>
      </RACNumberField>
    )
  }
)
NumberField.displayName = 'NumberField'
