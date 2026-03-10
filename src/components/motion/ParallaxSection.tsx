'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ParallaxSectionProps {
  children: React.ReactNode
  className?: string
  /** Vertical offset range — e.g. [-50, 50] means moves 50px up to 50px down */
  offset?: [number, number]
  /** Direction of parallax (default: 'y') */
  direction?: 'y' | 'x'
  /** Scale the element as it scrolls (default: none) */
  scale?: [number, number]
  /** Opacity range tied to scroll (default: none) */
  opacity?: [number, number]
}

/**
 * ParallaxSection — applies a subtle parallax scroll effect to its children.
 * Keep offset small (< 60px) for a natural feel.
 *
 * @example
 * // Subtle background parallax
 * <ParallaxSection offset={[-30, 30]} className="absolute inset-0">
 *   <BackgroundImage />
 * </ParallaxSection>
 *
 * // Floating hero element
 * <ParallaxSection offset={[-20, 20]} scale={[1, 1.05]}>
 *   <HeroImage />
 * </ParallaxSection>
 */
export function ParallaxSection({
  children,
  className,
  offset = [-40, 40],
  direction = 'y',
  scale,
  opacity,
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const yTransform = useTransform(scrollYProgress, [0, 1], direction === 'y' ? offset : [0, 0])
  const xTransform = useTransform(scrollYProgress, [0, 1], direction === 'x' ? offset : [0, 0])
  const scaleTransform = useTransform(scrollYProgress, [0, 1], scale ?? [1, 1])
  const opacityTransform = useTransform(scrollYProgress, [0, 1], opacity ?? [1, 1])

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      <motion.div
        style={{
          y: yTransform,
          x: xTransform,
          scale: scaleTransform,
          opacity: opacityTransform,
        }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default ParallaxSection
