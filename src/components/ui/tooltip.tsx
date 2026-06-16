'use client'

/**
 * Tooltip — Radix primitive wrapper themed with GV tokens.
 *
 * Mount the TooltipProvider at the app root once (usually in
 * src/app/providers.tsx), then use Tooltip/Trigger/Content anywhere.
 *
 * Usage:
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <button aria-label="Help">?</button>
 *     </TooltipTrigger>
 *     <TooltipContent>Explanation text</TooltipContent>
 *   </Tooltip>
 */

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs overflow-hidden rounded-md border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[11px] leading-snug text-text-primary shadow-elevated',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
