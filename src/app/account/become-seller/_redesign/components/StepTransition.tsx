/**
 * StepTransition — the Framer Motion wrapper for step content. Wrap the step
 * bodies in a single <AnimatePresence mode="wait"> at the parent, then render
 * one <StepTransition key={step} direction={dir}> per step. ~220ms directional
 * slide + fade: forward = new step enters from the right, back = from the left.
 */

'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export type StepDirection = 'forward' | 'back'

interface StepTransitionProps {
  /** Unique key for AnimatePresence — pass the step number. */
  stepKey: number | string
  direction: StepDirection
  children: ReactNode
}

const OFFSET = 24

export default function StepTransition({ direction, children }: StepTransitionProps) {
  const enterX = direction === 'forward' ? OFFSET : -OFFSET
  const exitX = direction === 'forward' ? -OFFSET : OFFSET

  return (
    <motion.div
      initial={{ opacity: 0, x: enterX }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: exitX }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
