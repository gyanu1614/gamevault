'use client'

/**
 * The value-list card's one form button (owner, 2026-10-21). It always offers
 * the OTHER form: on Standard it reads "Chroma" in MM2's iridescent finish;
 * tap it, the card switches, and the button flips over to "Standard".
 *
 * The flip is a critically damped spring on rotateX, so a second tap mid-flip
 * re-targets from where it is instead of jumping. The press shrinks on
 * pointer-down. Reduced motion swaps the faces instantly.
 */
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import styles from './ChromaFlipButton.module.css'

export type CardForm = 'standard' | 'chroma'

export function ChromaFlipButton({
  form,
  onToggle,
  chromaLabel = 'Chroma',
}: {
  form: CardForm
  onToggle: () => void
  chromaLabel?: string
}) {
  const reduce = useReducedMotion()
  const onChroma = form === 'chroma'
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
      aria-label={`Show ${onChroma ? 'Standard' : chromaLabel} version`}
      className="relative mx-auto block h-7 w-[7.5rem] rounded-md [perspective:600px] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateX: onChroma ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.45 }}
      >
        <span className={`${styles.face} ${styles.chroma}`}>
          <span className={styles.word}>{chromaLabel}</span>
        </span>
        <span className={`${styles.face} ${styles.standard}`}>Standard</span>
      </motion.span>
    </motion.button>
  )
}

/** The same chroma finish on a word ("Chroma" rarity label), so the card agrees with its button. */
export function ChromaWord({ children }: { children: ReactNode }) {
  return <span className={styles.word}>{children}</span>
}
