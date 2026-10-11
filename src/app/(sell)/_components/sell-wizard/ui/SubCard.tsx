import { cn } from '@/lib/utils'

import styles from '../sell-wizard.module.css'

/**
 * One section of the wizard: a soft card (house gradient, no outline) with a
 * header row: a numbered tile (inside a `numbered` container the number is a
 * CSS counter over the sections actually shown), the title, and an optional
 * right slot (a character count). Without a title it is a plain card (the
 * category and game pickers, whose title is the step bar's).
 */
export function SubCard({
  title,
  right,
  children,
}: {
  title?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={cn('scroll-mt-44', styles.card)}>
      {title && (
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <span aria-hidden className={styles.num} />
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight tracking-tight text-text-primary">{title}</h2>
          {right}
        </div>
      )}
      <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', title ? 'pt-4' : 'pt-4 sm:pt-5')}>{children}</div>
    </section>
  )
}

/** Wrap the Details sections so each SubCard header shows its running number. */
export const NUMBERED_SECTIONS = styles.numbered
