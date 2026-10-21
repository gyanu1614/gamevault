'use client'

import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The line from one step to the next. It draws in once, in order, when the
 * row scrolls into view, so the steps read as a sequence; static under
 * reduced motion. Horizontal from md, vertical on phones.
 */
export function StepRail({ index, color }: { index: number; color: string }) {
  const reduce = useReducedMotion()
  const t = { duration: 0.55, delay: 0.2 + index * 0.3, ease: EASE }
  return (
    <>
      <motion.span
        aria-hidden
        className="absolute bottom-[-0.75rem] left-[calc(1.25rem+1rem-0.5px)] top-[calc(1.25rem+2rem+0.5rem)] w-px origin-top md:hidden"
        style={{ background: color }}
        initial={reduce ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={t}
      />
      <motion.span
        aria-hidden
        className="absolute left-[calc(1.5rem+2rem+0.75rem)] right-[-0.75rem] top-[calc(1.5rem+1rem-0.5px)] hidden h-px origin-left md:block"
        style={{ background: color }}
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={t}
      />
    </>
  )
}
