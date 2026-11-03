'use client'

/** GameWizard's four-step progress indicator. */

import { Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Identity',    description: 'Name, slug, display' },
  { id: 2, label: 'Branding',    description: 'Logo + cover' },
  { id: 3, label: 'Categories',  description: 'Currency, Items, Accounts, Top Up, Boosting' },
  { id: 4, label: 'Review',      description: 'Confirm and save' },
] as const

// ─── Step indicator ───────────────────────────────────────────────────────────

export function Stepper({
  current,
  completed,
  onJump,
}: {
  current: number
  completed: Set<number>
  /**
   * V17n — When provided, the stepper renders each step as a clickable
   * button. Used in edit mode so admins can hop straight to any step
   * since all data is already loaded. In create mode the parent leaves
   * this undefined, keeping the linear "Save and continue" flow.
   */
  onJump?: (id: number) => void
}) {
  // Flat stepper: one progress segment per step (done = success, current =
  // lime, ahead = neutral) over a numbered circle + label. Four equal
  // columns at every width; below sm the label sits under the circle so
  // "Categories" fits a 375px screen without truncating or scrolling.
  return (
    <nav aria-label="Setup Steps">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const done = completed.has(s.id) || current > s.id
          const active = current === s.id
          const clickable = !!onJump
          const Item = clickable ? 'button' : 'div'
          return (
            <li key={s.id} className="min-w-0">
              <Item
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onJump!(s.id) : undefined}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-2.5 rounded-md text-left',
                  clickable &&
                    '-m-1.5 w-[calc(100%+12px)] cursor-pointer p-1.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-1 w-full rounded-full transition-colors',
                    done ? 'bg-success' : active ? 'bg-lime' : 'bg-white/[0.08]',
                  )}
                />
                <span className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold tabular-nums transition-colors sm:h-7 sm:w-7 sm:text-[12px]',
                      done
                        ? 'bg-success-bg text-success'
                        : active
                          ? 'bg-lime text-text-inverse'
                          : 'bg-white/[0.06] text-text-tertiary',
                    )}
                  >
                    {done ? <Check aria-hidden weight="bold" className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <span className="block w-full min-w-0">
                    <span
                      className={cn(
                        'block truncate text-[12px] font-semibold sm:text-[13px]',
                        active ? 'text-text-primary' : done ? 'text-text-secondary' : 'text-text-tertiary',
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="hidden truncate text-[11.5px] text-text-tertiary md:block">{s.description}</span>
                  </span>
                </span>
              </Item>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
