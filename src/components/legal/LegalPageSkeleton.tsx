/**
 * Loading skeleton for the legal layout (LegalPage.tsx), mirrored 1:1: the
 * same container, desktop rail, header with the three-cell meta strip, the
 * phone "On This Page" bar, and the first sections of body text. Used by
 * src/app/(legal)/loading.tsx. Keep it in lockstep with LegalPage.
 */

import { cn } from '@/lib/utils'

function Sk({ className }: { className: string }) {
  return <div className={cn('skeleton rounded', className)} />
}

function Paragraph({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Sk key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function LegalPageSkeleton() {
  return (
    <main className="min-h-screen bg-bg-base pb-24" aria-busy="true" aria-label="Loading document">
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8" aria-hidden>
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <aside className="hidden lg:block">
            <Sk className="mx-3 h-3 w-24" />
            <div className="mt-3 space-y-1">
              {Array.from({ length: 10 }, (_, i) => (
                <Sk key={i} className={cn('mx-3 h-4', i % 3 === 0 ? 'w-40' : i % 3 === 1 ? 'w-48' : 'w-32')} />
              ))}
            </div>
          </aside>

          <div className="min-w-0 max-w-[72ch]">
            <div className="flex items-center justify-between">
              <Sk className="h-3.5 w-16" />
              <Sk className="hidden h-9 w-20 rounded-md sm:block" />
            </div>
            <Sk className="mt-4 h-9 w-3/4 sm:h-11" />
            <div className="mt-5 space-y-2">
              <Sk className="h-3.5 w-full" />
              <Sk className="h-3.5 w-5/6" />
            </div>
            <div className="mt-6 grid divide-y divide-white/[0.07] rounded-lg bg-bg-raised sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-4 py-3">
                  <Sk className="h-3 w-16" />
                  <Sk className="mt-2 h-4 w-28" />
                </div>
              ))}
            </div>
            <Sk className="mt-3 h-3 w-72 max-w-full" />

            <Sk className="mt-6 h-12 w-full rounded-lg lg:hidden" />

            <div className="mt-10 space-y-10">
              <Paragraph lines={3} />
              {[0, 1].map((i) => (
                <div key={i} className="space-y-4 border-t border-white/[0.07] pt-10">
                  <Sk className="h-6 w-56" />
                  <Paragraph lines={4} />
                  <Paragraph lines={3} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
