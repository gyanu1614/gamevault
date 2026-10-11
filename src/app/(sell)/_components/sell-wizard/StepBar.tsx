'use client'

import { ChevronLeft } from 'lucide-react'

import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'

import { STEPS } from './constants'
import styles from './sell-wizard.module.css'

/**
 * The wizard's own top bar (the global navbar is stripped on /sell), design
 * "Aurora" as a full-width see-through glass bar: a slow green/teal glow drifting behind the bar. One bar carries
 * identity (logo), escape (back) and position: the three rails and their
 * labels. The step's question ("Choose A Game") is the card title below.
 * Completed steps are clickable, backwards only.
 */
export function StepBar({
  step,
  onJumpToStep,
  onBack,
  backLabel,
}: {
  step: number
  onJumpToStep: (target: number) => void
  onBack: () => void
  backLabel: string
}) {
  return (
    <header className="fixed inset-x-0 top-[var(--safe-top)] z-50">
      <div className={cn('relative', styles.bar)}>
      <div aria-hidden className={styles.aurora} />

      <div className="relative px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark-white.avif" alt="DropMarket" width={28} height={28} className="h-7 w-7 shrink-0" />
            <span className="text-[15px] font-bold text-text-primary">DropMarket</span>
          </Link>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1 rounded-md py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </button>
        </div>
      </div>

      {/* Centred at the form's width (max-w-3xl px-4 sm:px-6), so the rails line up with the fields. */}
      <nav aria-label="Progress" className="relative mx-auto w-full max-w-3xl px-4 pb-3.5 sm:px-6">
        <ol className="grid grid-cols-3 gap-1.5">
          {STEPS.map((s) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <li key={s.id} className="min-w-0">
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => done && onJumpToStep(s.id)}
                  aria-current={active ? 'step' : undefined}
                  aria-label={done ? `Back to step ${s.id}, ${s.label}` : `Step ${s.id}, ${s.label}${active ? ' (current)' : ''}`}
                  className={cn('group block w-full text-left', done ? 'cursor-pointer' : 'cursor-default')}
                >
                  <span className={cn(styles.rail, done && styles.railDone, active && styles.railActive, 'transition-colors duration-300')} />
                  <span
                    className={cn(
                      'mt-1.5 block truncate text-[11.5px] font-semibold transition-colors',
                      active && 'text-lime-text',
                      done && 'text-text-secondary group-hover:text-text-primary',
                      !done && !active && 'text-text-disabled',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      </div>
    </header>
  )
}
