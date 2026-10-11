'use client'

import Link from '@/components/navigation/AppLink'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS } from '@/app/(sell)/_components/sell-wizard/constants'

// ─── Step bar (clickable step labels + lime progress rail) ───────────────────

/**
 * StepBar — three clickable step labels above a progress rail.
 *
 * R13 — Pill chrome dropped. Each step is now a plain text label with a
 * leading number/check badge. Active = lime text. Completed = clickable,
 * subtle hover bg. Future = dimmed. No bordered box around the label.
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
    // The wizard's own navbar. The global nav is stripped on /sell, so
    // without this the page had no brand anchor and no way out except a
    // back link floating in the body. One bar now carries all three:
    // identity (logo), escape (back), and position (the segments).
    <header className="fixed inset-x-0 top-[var(--safe-top)] z-50 border-b border-border-subtle bg-[rgba(10,10,15,0.85)] backdrop-blur">
      {/* The brand row spans the viewport like a real navbar; only the
          step segments stay on the form's measure, so the rails line up
          with the fields below them. */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Row 1 — brand left, back right. */}
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-white.avif"
              alt="DropMarket"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
            />
            <span className="text-[15px] font-bold text-text-primary">
              DropMarket
            </span>
          </Link>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1 rounded-md py-1.5 text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </button>
        </div>

        {/* Row 2 — the three step segments, flush to the bar's bottom
            edge so the rails read as one continuous progress strip. */}
      </div>

      {/* Segments use main's exact container (mx-auto max-w-3xl px-4
          sm:px-6) so each rail sits flush with the field edges below. */}
      <nav
        aria-label="Progress"
        className="mx-auto w-full max-w-3xl px-4 sm:px-6"
      >
        <ol className="flex gap-1.5">
            {STEPS.map((s) => {
              const done = step > s.id
              const active = step === s.id
              const clickable = done // only backwards, to a completed step

              return (
                <li key={s.id} className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onJumpToStep(s.id)}
                    aria-current={active ? 'step' : undefined}
                    aria-label={
                      clickable
                        ? `Back to step ${s.id}, ${s.label}`
                        : `Step ${s.id}, ${s.label}${active ? ' (current)' : ''}`
                    }
                    className={cn(
                      'group block w-full pb-2.5 text-left',
                      clickable ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'mb-2 block truncate text-[11px] font-semibold uppercase tracking-wider transition-colors',
                        active && 'text-lime-text',
                        done && 'text-text-tertiary group-hover:text-text-secondary',
                        !done && !active && 'text-text-disabled',
                      )}
                    >
                      {s.label}
                    </span>
                    <span
                      className={cn(
                        'block h-[3px] w-full rounded-full transition-colors duration-300',
                        // Explicit rgba, not `bg-lime/45`: the lime token is
                        // a CSS variable, and Tailwind's slash-opacity cannot
                        // apply an alpha channel to `var(...)`, so the
                        // completed segment rendered fully transparent.
                        done &&
                          'bg-[rgba(198,255,61,0.45)] group-hover:bg-[rgba(198,255,61,0.75)]',
                        active && 'bg-lime',
                        !done && !active && 'bg-border-default',
                      )}
                    />
                  </button>
                </li>
              )
          })}
        </ol>
      </nav>
    </header>
  )
}
