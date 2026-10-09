'use client'

/**
 * The one checklist card on /founding. Four rows, one open at a time:
 * done rows collapse to a ticked line, upcoming rows are dim lines with a
 * time, the current row holds the step's form. A progress line sits on top
 * ("1 of 4 done · about 2 minutes left"). Rows are separated by hairlines —
 * one surface, no nested cards. Framer handles the open/close height and
 * the tick pop; reduced motion collapses both to a fade.
 */
import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { cn } from '@/lib/utils'
import type { FoundingStage, FoundingStepId } from '@/lib/founding/onboarding'

export const CHECKLIST_STEPS: ReadonlyArray<{ id: FoundingStepId; label: string; done: string; seconds: number }> = [
  { id: 1, label: 'Sign Up', done: 'Signed Up', seconds: 30 },
  { id: 2, label: 'Personal Details', done: 'Personal Details Added', seconds: 45 },
  { id: 3, label: 'Set Up Store', done: 'Store Set Up', seconds: 30 },
  { id: 4, label: 'Seller Agreement', done: 'Agreement Signed', seconds: 30 },
]

const EASE = [0.22, 1, 0.36, 1] as const

export function timeLeftLabel(stage: FoundingStage): string {
  if (stage >= 5) return 'All done'
  const secs = CHECKLIST_STEPS.filter((s) => s.id >= stage).reduce((n, s) => n + s.seconds, 0)
  if (secs < 60) return 'under a minute left'
  const mins = Math.round(secs / 60)
  return `about ${mins} ${mins === 1 ? 'minute' : 'minutes'} left`
}

function secondsLabel(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} sec`
}

export function StepChecklist({
  stage,
  open,
  onOpen,
  renderStep,
  renderDone,
}: {
  /** The next step to do (5 = finished). Everything below it is done. */
  stage: FoundingStage
  /** The row currently expanded (a done step can be re-opened to review). */
  open: FoundingStage
  onOpen: (id: FoundingStepId) => void
  renderStep: (id: FoundingStepId) => React.ReactNode
  renderDone: () => React.ReactNode
}) {
  const reduce = useReducedMotion()
  const doneCount = Math.min(stage - 1, 4)
  const pct = (doneCount / 4) * 100
  const finished = stage >= 5

  return (
    <div className="rounded-lg bg-bg-raised">
      {/* Progress */}
      <div className="px-5 pt-5 sm:px-6">
        <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
          <span className="font-semibold text-text-primary">{doneCount} of 4 done</span>
          <span aria-hidden className="text-text-tertiary">·</span>
          <span className="text-text-secondary">{timeLeftLabel(stage)}</span>
        </p>
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-bg-overlay"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={doneCount}
        >
          <motion.div
            className="h-full rounded-full bg-lime-text"
            initial={false}
            animate={{ width: `${Math.max(3, pct)}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
          />
        </div>
      </div>

      <ol className="mt-4" aria-label="Setup steps">
        {CHECKLIST_STEPS.map((step) => {
          const isDone = stage > step.id
          const isOpen = open === step.id && !finished
          const isUpcoming = !isDone && stage !== step.id
          return (
            <li key={step.id} className="border-t border-white/[0.07]">
              <RowHeader
                number={step.id}
                label={isDone && !isOpen ? step.done : step.label}
                time={secondsLabel(step.seconds)}
                state={isDone ? 'done' : isUpcoming ? 'upcoming' : 'current'}
                open={isOpen}
                onClick={isDone && !finished ? () => onOpen(step.id) : undefined}
                reduce={!!reduce}
              />
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0.15 : 0.32, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-6 pt-1 sm:px-6">{renderStep(step.id)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
        {finished && (
          <li className="border-t border-white/[0.07]">
            <div className="px-5 pb-6 pt-5 sm:px-6">{renderDone()}</div>
          </li>
        )}
      </ol>
    </div>
  )
}

function RowHeader({
  number,
  label,
  time,
  state,
  open,
  onClick,
  reduce,
}: {
  number: number
  label: string
  time: string
  state: 'done' | 'current' | 'upcoming'
  open: boolean
  onClick?: () => void
  reduce: boolean
}) {
  const tile = (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-caption font-semibold tabular-nums',
        state === 'done' && 'bg-lime-tint-bg text-lime-text',
        state === 'current' && 'bg-white text-black',
        state === 'upcoming' && 'bg-bg-overlay text-text-tertiary',
      )}
    >
      {state === 'done' ? (
        <motion.span
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }}
          className="inline-flex"
        >
          <Check weight="bold" className="h-3.5 w-3.5" />
        </motion.span>
      ) : (
        number
      )}
    </span>
  )
  const content = (
    <>
      {tile}
      <span className={cn('min-w-0 flex-1 truncate text-body-sm font-medium', state === 'upcoming' ? 'text-text-tertiary' : 'text-text-primary')}>
        {label}
      </span>
      {state === 'upcoming' && <span className="shrink-0 text-caption font-normal text-text-tertiary">{time}</span>}
      {state === 'done' && !open && onClick && <span className="shrink-0 text-caption font-normal text-text-tertiary">Change</span>}
    </>
  )
  const cls = cn(
    'flex h-14 w-full items-center gap-3 px-5 text-left sm:px-6',
    state === 'upcoming' && 'opacity-80',
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        className={cn(cls, 'transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft')}
      >
        {content}
      </button>
    )
  }
  return (
    <div className={cls} aria-current={state === 'current' ? 'step' : undefined}>
      {content}
    </div>
  )
}
