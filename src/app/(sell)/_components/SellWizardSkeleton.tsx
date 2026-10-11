/**
 * Sell wizard skeleton — the real wizard's shape, in plain blocks.
 *
 * Owner, 2026-09-28: /sell/new flashed an old skeleton (one big rounded box
 * of empty tiles) and then a different page. The old blocks used
 * an 80%-alpha overlay fill, which compiles to nothing (a CSS-variable colour takes
 * no opacity modifier), so only their borders showed. This one mirrors the
 * wizard as it is now (SellWizard.tsx):
 *   · the fixed wizard bar (brand, back link, step title + count, three rails);
 *   · `new`  → Step 1: centred title, "Choose A Category" panel with a 2×2
 *              tile grid, then the Bulk upload | Continue row;
 *   · `edit` → Step 3: game logo + title, field panels, then the action row.
 * Used by both route loading files.
 */
import { cn } from '@/lib/utils'

import styles from './sell-wizard/sell-wizard.module.css'

function Block({ className = '' }: { className?: string }) {
  // Solid bg-bg-inset: one step lighter than the panels, so blocks show.
  return <div className={`animate-pulse rounded-md bg-bg-inset ${className}`} />
}

function WizardBar({ activeStep }: { activeStep: 1 | 3 }) {
  return (
    <header className={cn('fixed inset-x-0 top-[var(--safe-top)] z-50', styles.bar)}>
      <div aria-hidden className={styles.aurora} />
      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark-white.avif" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <span className="text-[15px] font-bold text-text-primary">DropMarket</span>
          </div>
          <Block className="h-3.5 w-28" />
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-3.5 sm:px-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <Block className="h-[18px] w-40 sm:h-[21px]" />
          <Block className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className="min-w-0">
              <div className={cn(styles.rail, s < activeStep && styles.railDone)} />
              <Block className="mt-2 h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

function Panel({ titleWidth, children }: { titleWidth?: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      {titleWidth && (
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <Block className="h-8 w-8 shrink-0 rounded-[9px]" />
          <Block className={`h-[18px] ${titleWidth}`} />
        </div>
      )}
      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  )
}

function ActionRow() {
  return (
    <div className="mt-8 border-t border-border-subtle pt-5">
      <div className="flex w-full items-center justify-between gap-2">
        <Block className="h-12 w-32 rounded-[11px] sm:h-11" />
        <Block className="h-12 w-32 rounded-[11px] sm:h-11" />
      </div>
    </div>
  )
}

export function SellWizardSkeleton({ variant }: { variant: 'new' | 'edit' }) {
  return (
    <main
      aria-busy
      className={`mx-auto flex w-full max-w-3xl flex-col px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[10.5rem] sm:px-6 sm:pt-[11rem] ${
        variant === 'new' ? 'min-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))]' : ''
      }`}
    >
      <WizardBar activeStep={variant === 'new' ? 1 : 3} />

      {variant === 'new' ? (
        <>
          {/* "Create An Offer" — 24px / 30px at leading-tight. */}
          <div className="mb-4 flex justify-center sm:mb-5">
            <Block className="h-[30px] w-56 sm:h-[37.5px] sm:w-72" />
          </div>
          <Panel>
            <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
                  <Block className="h-10 w-10 shrink-0 rounded-lg sm:h-11 sm:w-11" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Block className="h-4 w-24" />
                    <Block className="h-3 w-32 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <>
          {/* Game logo + "{Game} {Category}" title. */}
          <div className="mb-4 flex items-center justify-center gap-3 sm:mb-5">
            <Block className="h-9 w-9 shrink-0 rounded-lg" />
            <Block className="h-[30px] w-56 sm:h-[37.5px] sm:w-72" />
          </div>
          <div className="space-y-4">
            {[3, 2, 2].map((rows, p) => (
              <Panel key={p} titleWidth={p === 0 ? 'w-32' : 'w-24'}>
                <div className="space-y-4">
                  {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Block className="h-3.5 w-28" />
                      <Block className="h-12 w-full rounded-[11px] sm:h-11" />
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}

      <ActionRow />
    </main>
  )
}
