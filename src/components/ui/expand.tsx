'use client'

/**
 * Expand — the one open/close motion for FAQ answers, seller details and the
 * other show-more panels: height + opacity with framer-motion, the same
 * 0.25 s ease-out as the account sidebar's groups.
 *
 * The content stays mounted while closed (height 0, inert), so answers that
 * are server-rendered stay in the HTML for search, and closing has something
 * to animate. Inert takes the hidden content out of the tab order and the
 * accessibility tree. Borders and padding belong on the content inside: a
 * border on this element would still draw a line at height 0.
 *
 * `pullUp` tucks the open content up into the trigger's bottom padding (a
 * negative top margin), animated with the height so the closed row keeps
 * its full padding. A plain -mt on the content would be clipped here.
 *
 * Works under Radix `Collapsible.Content forceMount asChild` too — props and
 * the ref are passed through so Radix can wire its id and data-state.
 */

import { forwardRef } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export const EXPAND_TRANSITION = { duration: 0.25, ease: 'easeOut' } as const

type ExpandProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'variants' | 'transition'> & {
  open: boolean
  /** Px to overlap the trigger above while open. */
  pullUp?: number
}

export const Expand = forwardRef<HTMLDivElement, ExpandProps>(function Expand(
  { open, pullUp, className, children, ...rest },
  ref,
) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      {...rest}
      initial={false}
      animate={
        open
          ? { height: 'auto', opacity: 1, ...(pullUp ? { marginTop: -pullUp } : {}) }
          : { height: 0, opacity: 0, ...(pullUp ? { marginTop: 0 } : {}) }
      }
      transition={reduce ? { duration: 0 } : EXPAND_TRANSITION}
      className={cn('overflow-hidden', className)}
      // React 18 has no boolean `inert`: `true` warns and is dropped. The
      // empty string renders the attribute (inert="").
      {...(!open ? { inert: '' as unknown as boolean } : {})}
    >
      {children}
    </motion.div>
  )
})
