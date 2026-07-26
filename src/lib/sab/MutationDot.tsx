'use client'

import { motion } from 'framer-motion'
import type { MutationVisual } from './mutations'

/**
 * Colored mutation indicator dot. Solid mutations render a static dot; the
 * Rainbow (multi-color) mutation gets a subtly FLOWING gradient — the
 * background position drifts so the colors shimmer without being distracting.
 */
export function MutationDot({
  visual,
  size = 10,
  className = '',
}: {
  visual: MutationVisual
  size?: number
  className?: string
}) {
  const style = { width: size, height: size }

  if (visual.gradient) {
    return (
      <motion.span
        className={`inline-block shrink-0 rounded-full ${className}`}
        style={{ ...style, backgroundImage: visual.gradient, backgroundSize: '300% 100%' }}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
      />
    )
  }

  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ ...style, backgroundColor: visual.color }}
    />
  )
}
