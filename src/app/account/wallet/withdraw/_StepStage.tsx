'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const

/**
 * One step at a time. The card's height follows the step with a spring and the steps
 * slide in the direction of travel, so it reads as one card moving on, not a page
 * swapping. Without motion the step simply changes.
 */
export function StepStage({ stepKey, direction, children }: { stepKey: number; direction: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const offset = reduceMotion ? 0 : 28
  return (
    <motion.div animate={{ height }} transition={reduceMotion ? { duration: 0 } : SPRING} className="overflow-hidden">
      <div ref={inner}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={stepKey}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * offset, opacity: 0 }),
              shown: { x: 0, opacity: 1 },
              leave: (d: number) => ({ x: d * -offset, opacity: 0 }),
            }}
            initial="enter"
            animate="shown"
            exit="leave"
            transition={reduceMotion ? { duration: 0 } : { x: SPRING, opacity: { duration: 0.14 } }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
