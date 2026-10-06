'use client'

/**
 * Reveal-in-view for one guide section: fade + 8px rise as it scrolls in,
 * staggered by `index`. Nothing is hidden in the server HTML or before
 * hydration: only a section that is still BELOW the screen when the page
 * hydrates is set hidden, and it comes back the moment it enters view.
 * Reduced motion: never hidden, never animated.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

export function GuideReveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode
  index?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const controls = useAnimationControls()
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (reduce || !el || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    controls.set({ opacity: 0, y: 8 })
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        void controls.start({ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: (index % 4) * 0.06 } })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [controls, index, reduce])

  return (
    <motion.div ref={ref} animate={controls} className={className}>
      {children}
    </motion.div>
  )
}
