'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { fadeUp, fadeIn } from '@/lib/animations/variants'
import { cn } from '@/lib/utils'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  /** Direction of entrance — default is 'up' */
  direction?: 'up' | 'in'
  /** Delay in seconds before animation starts */
  delay?: number
  /** Only trigger when scrolled into view (default: true) */
  onScroll?: boolean
  /** Threshold for IntersectionObserver — 0-1 (default: 0.1) */
  threshold?: number
  /** Only animate once (default: true) */
  once?: boolean
  /** Override animation duration (seconds) */
  duration?: number
}

/**
 * FadeIn — wraps children in a scroll-triggered or mount-triggered fade animation.
 *
 * @example
 * <FadeIn delay={0.2}>
 *   <ListingCard {...props} />
 * </FadeIn>
 */
export function FadeIn({
  children,
  className,
  direction = 'up',
  delay = 0,
  onScroll = true,
  threshold = 0.1,
  once = true,
  duration,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-40px', amount: threshold })

  const variant = direction === 'up' ? fadeUp : fadeIn

  const customVariant = duration
    ? {
        hidden: variant.hidden,
        show: {
          ...variant.show,
          transition: { duration, ease: [0.25, 0.1, 0.25, 1] },
        },
      }
    : variant

  return (
    <motion.div
      ref={ref}
      variants={customVariant}
      initial="hidden"
      animate={onScroll ? (isInView ? 'show' : 'hidden') : 'show'}
      transition={delay > 0 ? { delay } : undefined}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

export default FadeIn
