'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { staggerContainer, staggerItem, staggerItemFast } from '@/lib/animations/variants'
import { cn } from '@/lib/utils'

interface StaggerListProps {
  children: React.ReactNode
  className?: string
  /** How fast to stagger (default: 'normal') */
  speed?: 'fast' | 'normal'
  /** Delay before first item (seconds) */
  delay?: number
  /** Trigger on scroll into view (default: true) */
  onScroll?: boolean
  /** Only animate once (default: true) */
  once?: boolean
  /** HTML element to render as (default: 'div') */
  as?: 'div' | 'ul' | 'ol' | 'section'
}

/**
 * StaggerList — wraps a list of children and staggers their entrance animations.
 * Children must be wrapped in <StaggerItem> for the effect to work.
 *
 * @example
 * <StaggerList>
 *   {listings.map(l => (
 *     <StaggerItem key={l.id}>
 *       <ListingCard {...l} />
 *     </StaggerItem>
 *   ))}
 * </StaggerList>
 */
export function StaggerList({
  children,
  className,
  speed = 'normal',
  delay = 0,
  onScroll = true,
  once = true,
  as = 'div',
}: StaggerListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-40px' })

  const containerVariant = {
    ...staggerContainer,
    show: {
      ...staggerContainer.show,
      transition: {
        staggerChildren: speed === 'fast' ? 0.04 : 0.07,
        delayChildren: delay,
      },
    },
  }

  const MotionComponent = motion[as] as typeof motion.div

  return (
    <MotionComponent
      ref={ref as React.RefObject<HTMLDivElement>}
      variants={containerVariant}
      initial="hidden"
      animate={onScroll ? (isInView ? 'show' : 'hidden') : 'show'}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  )
}

interface StaggerItemProps {
  children: React.ReactNode
  className?: string
  /** Use a faster, simpler animation (scale only, no blur) */
  fast?: boolean
  /** HTML element to render as (default: 'div') */
  as?: 'div' | 'li' | 'article'
}

/**
 * StaggerItem — individual item inside a <StaggerList>.
 */
export function StaggerItem({ children, className, fast = false, as = 'div' }: StaggerItemProps) {
  const variant = fast ? staggerItemFast : staggerItem
  const MotionComponent = motion[as] as typeof motion.div

  return (
    <MotionComponent
      variants={variant}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  )
}

export default StaggerList
