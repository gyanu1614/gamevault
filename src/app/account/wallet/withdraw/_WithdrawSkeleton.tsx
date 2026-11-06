/**
 * Withdraw skeleton, the same picture _WithdrawClient draws: the back tile and heading,
 * the steps on their first step, and the receipt beside them. Used by loading.tsx.
 */

import { Sk } from '@/components/account/AccountSkeletons'

export function WithdrawSkeleton() {
  return (
    <div className="pb-12" aria-busy aria-label="Loading withdrawals">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Sk className="h-11 w-11 rounded-md" />
            <Sk className="h-8 w-48 rounded-md" />
          </div>
          <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg bg-bg-raised p-5 sm:p-6">
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Sk className="h-[3px] w-full rounded-full" />
                  <Sk className="h-3 w-16" />
                </div>
              ))}
            </div>
            <Sk className="mt-6 h-6 w-36" />
            <Sk className="mt-4 h-11 w-full rounded-md" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => <Sk key={i} className="h-[60px] w-full rounded-lg" />)}
            </div>
            <Sk className="mt-6 h-11 w-full rounded-md" />
          </div>
          <div className="space-y-3 rounded-lg bg-bg-raised p-6 max-lg:hidden">
            <Sk className="h-4 w-32" />
            <Sk className="h-9 w-36" />
            <Sk className="mt-6 h-5 w-40" />
            {[0, 1, 2].map((i) => <Sk key={i} className="h-11 w-full rounded-md" />)}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
