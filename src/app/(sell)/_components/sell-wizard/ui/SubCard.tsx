import { cn } from '@/lib/utils'

import styles from '../sell-wizard.module.css'

/**
 * One section of the wizard: a soft card (house gradient, no outline) with a
 * header row: the title and an optional right slot (a character count).
 * Every step titles its card with the question ("Choose A Category",
 * "Choose A Game", "Offer Details").
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
    <section className={cn('scroll-mt-36', styles.card)}>
      {title && (
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight tracking-tight text-text-primary">{title}</h2>
          {right}
        </div>
      )}
      <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', title ? 'pt-4' : 'pt-4 sm:pt-5')}>{children}</div>
    </section>
  )
}

