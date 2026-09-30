/**
 * Offers skeleton: the same viewport-locked frame as listings/page.tsx
 * (fixed under the navbar, right of the sidebar, standard max-w-7xl), header
 * with Add New Offer, the filter row (Game / Status / Bulk Actions triggers,
 * search, sort), then the results panel with rows and the pagination footer.
 */

import { Sk } from '@/components/account/AccountSkeletons'

export default function ListingsLoading() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--navbar-bottom)] z-[1] flex flex-col overflow-hidden lg:left-72"
      aria-busy
      aria-label="Loading offers"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-4 pt-7 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Sk className="h-8 w-52 rounded-md" />
          <Sk className="hidden h-10 w-40 rounded-md sm:block" />
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 w-[132px] rounded-md bg-bg-raised sm:h-[42px]" />
          ))}
          <div className="h-10 min-w-0 flex-1 rounded-md bg-bg-raised sm:h-[42px] sm:min-w-[220px] sm:max-w-[320px]" />
          <Sk className="h-4 w-24 sm:ml-auto" />
        </div>

        <div className="mt-4 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-bg-raised lg:mb-4">
          <div className="flex gap-6 px-5 py-3">
            {[200, 70, 90, 70, 60, 50].map((w, i) => (
              <Sk key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-white/[0.07] px-5 py-3">
                <Sk className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Sk className="h-4 w-44 max-w-full" />
                  <Sk className="h-3 w-24" />
                </div>
                <Sk className="hidden h-8 w-24 sm:block" />
                <Sk className="hidden h-10 w-36 md:block" />
                <Sk className="hidden h-6 w-16 lg:block" />
                <Sk className="hidden h-4 w-14 lg:block" />
                <Sk className="h-9 w-9 rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3.5">
            <Sk className="h-4 w-48" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Sk key={i} className="h-9 w-9 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
