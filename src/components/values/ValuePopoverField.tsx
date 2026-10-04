'use client'

import { useState, type ReactNode } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VALUE_FIELD, VALUE_PANEL } from './styles'

/**
 * Toolbar field that opens a custom panel (e.g. the Adopt Me two-axis variant
 * picker) on the shared Radix Popover: Escape / outside click close, portal,
 * collision-aware, always opens downward.
 */
export function ValuePopoverField({
  label,
  trigger,
  children,
  panelClassName = 'w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-3.5',
}: {
  label: string
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={`flex h-12 w-full items-center justify-between gap-2 px-3.5 text-body-sm ${VALUE_FIELD}`}
      >
        <span className="flex min-w-0 items-center gap-2">{trigger}</span>
        <CaretDownIcon
          aria-hidden
          size={14}
          weight="bold"
          className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        avoidCollisions={false}
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={`max-w-none text-body-sm ${VALUE_PANEL} ${panelClassName}`}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}
