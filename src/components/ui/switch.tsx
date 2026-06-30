'use client'

/**
 * Switch — shadcn-style wrapper around @radix-ui/react-switch.
 *
 * Themed with GV tokens (lime track when on, bg-bg-overlay when off).
 * Use anywhere a boolean toggle is needed; replaces the hand-rolled
 * `Toggle` we used to ship in settings/notifications.
 *
 * Usage:
 *   <Switch checked={enabled} onCheckedChange={setEnabled} />
 *   <Switch checked={enabled} onCheckedChange={setEnabled} disabled />
 */

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-tint-bg focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-lime data-[state=unchecked]:bg-bg-overlay',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
