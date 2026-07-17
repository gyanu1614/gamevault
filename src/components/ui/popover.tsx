'use client'

/**
 * Popover — Radix primitive wrapper themed with GV tokens (matches
 * tooltip.tsx). Used for tap-to-open info surfaces on touch devices
 * where hover-only Tooltip never fires.
 *
 * Usage:
 *   <Popover>
 *     <PopoverTrigger asChild>
 *       <button aria-label="Help">?</button>
 *     </PopoverTrigger>
 *     <PopoverContent>Explanation text</PopoverContent>
 *   </Popover>
 */

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverClose = PopoverPrimitive.Close

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      // collisionPadding keeps the panel inside 360px viewports instead
      // of overflowing the page edge (zero horizontal scroll rule).
      collisionPadding={12}
      className={cn(
        'z-50 max-w-xs rounded-md border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[12px] leading-snug text-text-primary shadow-elevated outline-none',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent }
