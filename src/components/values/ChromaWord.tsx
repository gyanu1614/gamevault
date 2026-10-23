import type { ReactNode } from 'react'
import styles from './ChromaWord.module.css'

/** Which version of an item a value card shows (MM2: a Chroma is its own item). */
export type CardForm = 'standard' | 'chroma'

/**
 * MM2's chroma finish on a word: an iridescent sweep across the lettering
 * (the rarity label, the active half of FormSwitch, a price eyebrow), so every
 * "Chroma" on a card looks the same. Static under reduced motion.
 */
export function ChromaWord({ children }: { children: ReactNode }) {
  return <span className={styles.word}>{children}</span>
}
