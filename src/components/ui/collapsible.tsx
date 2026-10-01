'use client'

/**
 * Collapsible — thin shadcn-style wrapper over @radix-ui/react-collapsible.
 *
 * Radix keeps the trigger wiring (aria-expanded, aria-controls). The content
 * is force-mounted and opened/closed by the shared framer-motion Expand
 * (height + fade, like the account sidebar) instead of snapping, so Root
 * shares its open state with Content through a small context.
 */

import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { Expand } from '@/components/ui/expand'

const OpenContext = React.createContext(false)

function Collapsible({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolled
  return (
    <OpenContext.Provider value={open}>
      <CollapsiblePrimitive.Root
        {...props}
        open={open}
        onOpenChange={(next) => {
          if (openProp === undefined) setUncontrolled(next)
          onOpenChange?.(next)
        }}
      />
    </OpenContext.Provider>
  )
}

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  { children?: React.ReactNode; className?: string }
>(function CollapsibleContent({ children, className }, ref) {
  const open = React.useContext(OpenContext)
  return (
    <CollapsiblePrimitive.CollapsibleContent forceMount asChild>
      <Expand ref={ref} open={open} className={className}>
        {children}
      </Expand>
    </CollapsiblePrimitive.CollapsibleContent>
  )
})

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
