/**
 * Withdraw skeleton: back link + heading, the method grid on the left and the
 * summary rail (Available + How Payouts Work) on the right, as page.tsx draws
 * step 1. Used by loading.tsx and while the balance loads.
 */

import { Sk } from '@/components/account/AccountSkeletons'

export function MethodGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-bg-raised p-4">
          <Sk className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Sk className="h-4 w-28" />
            <Sk className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function WithdrawSkeleton() {
  return (
    <div className="pb-12" aria-busy aria-label="Loading withdrawals">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="mb-5">
          <Sk className="mb-3 h-4 w-28" />
          <Sk className="h-8 w-48 rounded-md" />
          <Sk className="mt-1.5 h-4 w-64 max-w-full" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <MethodGridSkeleton />
          <div className="space-y-4" aria-hidden>
            <div className="rounded-lg bg-bg-raised p-5">
              <Sk className="h-4 w-20" />
              <Sk className="mt-2 h-9 w-32" />
              <Sk className="mt-2 h-3 w-28" />
            </div>
            <div className="rounded-lg bg-bg-raised p-5">
              <Sk className="h-4 w-36" />
              <div className="mt-3 space-y-2">
                {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-3.5 w-full" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
