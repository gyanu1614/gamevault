/**
 * Withdraw skeleton, the same picture _WithdrawClient draws: back link and heading,
 * the balance, the three steps on one surface, and the rail. Used by loading.tsx.
 */

import { Sk } from '@/components/account/AccountSkeletons'

export function WithdrawSkeleton() {
  return (
    <div className="pb-12" aria-busy aria-label="Loading withdrawals">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <Sk className="mb-3 h-4 w-28" />
        <Sk className="h-8 w-48 rounded-md" />

        <div className="mt-5 grid overflow-hidden rounded-lg bg-bg-raised lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]" aria-hidden>
          <div className="space-y-3 p-6 sm:p-8">
            <Sk className="h-4 w-32" />
            <Sk className="h-12 w-44" />
            <Sk className="h-3.5 w-56 max-w-full" />
          </div>
          <div className="space-y-5 bg-white/[0.03] p-6 sm:p-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Sk className="h-4 w-28" />
                <Sk className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden>
          <div className="divide-y divide-white/[0.07] rounded-lg bg-bg-raised">
            <div className="space-y-3 p-5 sm:p-6">
              <Sk className="h-7 w-44 rounded-md" />
              {[0, 1, 2].map((i) => <Sk key={i} className="h-[60px] w-full rounded-lg" />)}
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="p-5 sm:p-6">
                <Sk className="h-7 w-32 rounded-md" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="space-y-2.5 rounded-lg bg-bg-raised p-5">
              <Sk className="h-4 w-36" />
              {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-3.5 w-full" />)}
            </div>
            <div className="space-y-2.5 rounded-lg bg-bg-raised p-5">
              <Sk className="h-10 w-40 rounded-md" />
              {[0, 1, 2].map((i) => <Sk key={i} className="h-3.5 w-full" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
