/**
 * /support skeleton — mirrors page.tsx 1:1: centred hero with the search
 * field and quick chips, the 4-up contact row, 3-up topic cards, the FAQ
 * stack, the trust strip and the closing CTA card.
 */

import { cn } from '@/lib/utils'
import { MARKET_CARD } from '@/lib/ui/surfaces'

function Sk({ className }: { className: string }) {
  return <div className={cn('skeleton rounded', className)} />
}

export default function SupportLoading() {
  return (
    <main className="min-h-screen bg-bg-base" aria-busy="true" aria-label="Loading help centre">
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8" aria-hidden>
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <Sk className="h-3.5 w-28" />
          <Sk className="mt-4 h-9 w-72 max-w-full sm:h-12 sm:w-96" />
          <Sk className="mt-5 h-4 w-80 max-w-full" />
          <Sk className="mt-7 h-14 w-full max-w-2xl rounded-lg" />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['w-16', 'w-20', 'w-16', 'w-24', 'w-20'].map((w, i) => (
              <Sk key={i} className={cn('h-8 rounded-md', w)} />
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-3">
          <Sk className="h-6 w-32" />
          <Sk className="h-9 w-80 max-w-full rounded-md" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn('rounded-lg p-5', MARKET_CARD)}>
              <Sk className="h-10 w-10 rounded-md" />
              <Sk className="mt-4 h-4 w-28" />
              <Sk className="mt-2 h-3.5 w-36" />
              <Sk className="mt-3 h-3 w-full" />
              <Sk className="mt-1.5 h-3 w-2/3" />
            </div>
          ))}
        </div>

        <Sk className="mt-16 h-6 w-48" />
        <Sk className="mt-2 h-3.5 w-80 max-w-full" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn('rounded-lg p-5', MARKET_CARD)}>
              <div className="flex items-center gap-3">
                <Sk className="h-10 w-10 rounded-md" />
                <Sk className="h-4 w-36" />
              </div>
              <Sk className="mt-4 h-3 w-full" />
              <Sk className="mt-1.5 h-3 w-3/4" />
              <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-3">
                <Sk className="h-4 w-40" />
                <Sk className="h-4 w-44" />
                <Sk className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>

        <Sk className="mt-16 h-6 w-64" />
        <Sk className="mt-2 h-3.5 w-96 max-w-full" />
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Sk key={i} className="h-[72px] w-full rounded-[20px] sm:h-[88px]" />
          ))}
        </div>

        <div className={cn('mt-16 grid gap-px rounded-lg sm:grid-cols-2 lg:grid-cols-4', MARKET_CARD)}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3.5 p-5">
              <Sk className="h-10 w-10 shrink-0 rounded-md" />
              <div className="flex-1">
                <Sk className="h-4 w-32" />
                <Sk className="mt-2 h-3 w-full" />
              </div>
            </div>
          ))}
        </div>

        <div className={cn('mt-16 flex flex-col gap-5 rounded-lg p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8', MARKET_CARD)}>
          <div>
            <Sk className="h-6 w-44" />
            <Sk className="mt-2 h-3.5 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-11 w-36 rounded-md" />
            <Sk className="h-11 w-40 rounded-md" />
          </div>
        </div>
      </div>
    </main>
  )
}
