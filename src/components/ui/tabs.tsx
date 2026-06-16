'use client'

/**
 * Tabs — Radix primitive wrapper themed with GV tokens.
 *
 * Two variants of TabsList style:
 *   - default (pill): inset bg-bg-inset with rounded-lime-tint active state.
 *     Good for narrow side-by-side tabs like Popular/Recent.
 *   - underline: lime underline on the active trigger, no background pill.
 *     Good for wider tab sets at the top of a page (dashboard, profile).
 *
 * Usage:
 *   <Tabs defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="orders">Orders</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *     <TabsContent value="orders">…</TabsContent>
 *   </Tabs>
 *
 *   <TabsList variant="underline">…</TabsList>
 */

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

type TabsVariant = 'pill' | 'underline'

const TabsVariantContext = React.createContext<TabsVariant>('pill')

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabsVariant
  }
>(({ className, variant = 'pill', ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === 'pill'
          ? 'inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-inset p-1'
          : 'flex items-center gap-1 border-b border-border-subtle',
        className,
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-tint-bg',
        variant === 'pill'
          ? 'h-8 rounded-md px-3 text-text-secondary hover:text-text-primary data-[state=active]:bg-lime-tint-bg data-[state=active]:text-lime-text'
          : '-mb-px h-10 border-b-2 border-transparent px-4 text-text-secondary hover:text-text-primary data-[state=active]:border-lime data-[state=active]:text-lime-text',
        className,
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-tint-bg',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
