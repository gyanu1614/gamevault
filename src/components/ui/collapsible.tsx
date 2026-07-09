'use client'

/**
 * Collapsible — thin shadcn-style wrapper over @radix-ui/react-collapsible.
 * Accessible expand/collapse with data-state attributes for styling.
 */

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
