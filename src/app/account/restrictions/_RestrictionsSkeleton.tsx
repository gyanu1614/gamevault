/**
 * Account Status skeleton: header, the status panel, then What This Means
 * beside Restriction History, as RestrictionStatus draws them.
 */

import { Sk, SkCard, SkPage, SkRows } from '@/components/account/AccountSkeletons'

export function RestrictionsSkeleton() {
  return (
    <SkPage titleWidth="w-44">
      <div className="mt-6 space-y-4">
        <div className="flex gap-4 rounded-lg bg-bg-raised p-5 sm:p-6" aria-hidden>
          <Sk className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Sk className="h-5 w-44" />
            <Sk className="h-4 w-72 max-w-full" />
            <Sk className="mt-3 h-14 w-full rounded-md" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkCard description={false}>
            <SkRows count={3} height="h-5" gap="space-y-2.5" />
          </SkCard>
          <SkCard description={false}>
            <SkRows count={2} height="h-16" />
          </SkCard>
        </div>
      </div>
    </SkPage>
  )
}
