'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  /** The target value to count up to */
  value: number
  /** Number of decimal places (default: 0) */
  decimals?: number
  /** Prefix to display before number (e.g. '$', '+') */
  prefix?: string
  /** Suffix to display after number (e.g. 'k', '%', '+') */
  suffix?: string
  /** Duration of animation in seconds (default: 1.5) */
  duration?: number
  /** Start from 0 or from current value (default: 0) */
  from?: number
  /** CSS class name */
  className?: string
  /** Trigger on scroll into view (default: true) */
  onScroll?: boolean
  /** Format large numbers with commas (default: true) */
  formatWithCommas?: boolean
  /** Abbreviate large numbers: 1000 → 1k, 1000000 → 1M (default: false) */
  abbreviate?: boolean
}

function formatNumber(
  n: number,
  decimals: number,
  formatWithCommas: boolean,
  abbreviate: boolean
): string {
  if (abbreviate) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  }

  if (formatWithCommas) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return n.toFixed(decimals)
}

/**
 * AnimatedCounter — smoothly animates a number from `from` to `value`.
 * Triggers on scroll by default (IntersectionObserver).
 *
 * @example
 * <AnimatedCounter value={1250} prefix="$" decimals={2} />
 * <AnimatedCounter value={4800} suffix="+ orders" abbreviate />
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.5,
  from = 0,
  className,
  onScroll = true,
  formatWithCommas = true,
  abbreviate = false,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  const motionValue = useMotionValue(from)
  const displayValue = useTransform(motionValue, (v) =>
    formatNumber(v, decimals, formatWithCommas, abbreviate)
  )

  useEffect(() => {
    if (!onScroll || isInView) {
      const controls = animate(motionValue, value, {
        duration,
        ease: [0.25, 0.1, 0.25, 1],
      })
      return controls.stop
    }
  }, [isInView, value, duration, motionValue, onScroll])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  )
}

export default AnimatedCounter
