/**
 * Orders skeleton: the same viewport-locked frame as orders/page.tsx (fixed
 * under the navbar, right of the sidebar), header, the four filter buttons,
 * the full-width search row, then the table panel with its results line and
 * rows (item, ID, status, total, party, date).
 */

import { Sk } from '@/components/account/AccountSkeletons'

export default function OrdersLoading() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--navbar-bottom)] z-[1] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] lg:left-72"
      aria-busy
      aria-label="Loading orders"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-4 pt-7 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="mb-4 shrink-0">
          <Sk className="h-8 w-40 rounded-md" />
          <Sk className="mt-1.5 h-4 w-80 max-w-full" />
        </div>

        <div className="mb-4 shrink-0 space-y-3">
          <div className="flex gap-2 overflow-hidden sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[42px] w-36 shrink-0 rounded-md bg-bg-raised sm:w-auto" />
            ))}
          </div>
          <div className="h-10 rounded-md bg-bg-raised" />
        </div>

        <div className="mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-bg-raised">
          <div className="shrink-0 border-b border-white/[0.07] px-4 py-2.5">
            <Sk className="h-3.5 w-20" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex gap-6 px-4 py-3">
              {[180, 50, 60, 50, 60, 50].map((w, i) => (
                <Sk key={i} className="h-3" style={{ width: w }} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 border-t border-white/[0.07] px-4 py-2.5">
                <div className="flex w-[230px] shrink-0 items-center gap-3">
                  <Sk className="h-9 w-9 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Sk className="h-3.5 w-32" />
                    <Sk className="h-3 w-20" />
                  </div>
                </div>
                <Sk className="h-6 w-24 shrink-0 rounded-md" />
                <Sk className="h-6 w-24 shrink-0 rounded-full" />
                <Sk className="h-4 w-14 shrink-0" />
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <Sk className="h-6 w-6 rounded-full" />
                  <Sk className="h-3.5 w-20" />
                </div>
                <Sk className="hidden h-3.5 w-12 shrink-0 md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
