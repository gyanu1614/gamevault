/**
 * Seller Tiers skeleton: the page exactly as _TiersClient draws it (header,
 * rank hero with its rail, progress + rules side by side on desktop, the
 * rank switcher). Used by loading.tsx and by the account layout while
 * sign-in resolves. Keep it in lockstep with _TiersClient.
 */

import { Sk, SkCard, SkPage } from '@/components/account/AccountSkeletons'

export function TiersSkeleton() {
  return (
    <SkPage titleWidth="w-36">
      <div className="mt-5 space-y-4" aria-hidden>
        {/* Hero */}
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <Sk className="h-[76px] w-[76px] shrink-0 rounded-2xl" />
              <div>
                <Sk className="h-3.5 w-20" />
                <Sk className="mt-2 h-6 w-40" />
                <div className="mt-2.5 flex gap-1.5">
                  <Sk className="h-7 w-36 rounded-md" />
                  <Sk className="h-7 w-32 rounded-md" />
                </div>
              </div>
            </div>
            <Sk className="h-[72px] w-full rounded-lg sm:w-[250px]" />
          </div>
          <div className="grid grid-cols-5 border-t border-white/[0.07] bg-black/[0.14] px-3 py-4 sm:px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Sk className="h-9 w-9 rounded-full" />
                <Sk className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Progress + How ranks work */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SkCard footer>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <Sk className="h-4 w-40" />
                    <Sk className="h-4 w-24" />
                  </div>
                  <Sk className="mt-2 h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </SkCard>
          <SkCard description={false} footer>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Sk className="h-8 w-8 shrink-0 rounded-md" />
                  <div className="flex-1">
                    <Sk className="h-4 w-28" />
                    <Sk className="mt-1.5 h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </SkCard>
        </div>

        {/* All ranks */}
        <div className="overflow-hidden rounded-lg bg-bg-raised">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <Sk className="h-4 w-24" />
            <Sk className="mt-2 h-3.5 w-64 max-w-full" />
          </div>
          <div className="p-5 sm:p-6 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-5">
            <div className="hidden space-y-1 lg:block">
              {Array.from({ length: 5 }).map((_, i) => (
                <Sk key={i} className="h-[60px] w-full rounded-lg" />
              ))}
            </div>
            <Sk className="mb-4 h-10 w-full rounded-lg lg:hidden" />
            <Sk className="h-[300px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    </SkPage>
  )
}
