/**
 * Refer & Earn skeleton: invite card beside How It Works, stat panel,
 * earnings history, as ReferralClient draws them.
 */

import { Sk, SkCard, SkPage, SkRows, SkStatStrip } from '@/components/account/AccountSkeletons'

export default function ReferralLoading() {
  return (
    <SkPage titleWidth="w-40">
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg bg-bg-raised p-5 sm:p-6" aria-hidden>
            <Sk className="h-4 w-40" />
            <div className="mt-5 flex gap-2">
              <Sk className="h-[56px] flex-1 rounded-md" />
              <Sk className="h-[56px] w-24 rounded-md" />
            </div>
            <Sk className="mt-3 h-10 w-full rounded-md" />
            <Sk className="mt-4 h-10 w-full rounded-md" />
          </div>
          <SkCard description={false}>
            <SkRows count={4} height="h-6" gap="space-y-3.5" />
          </SkCard>
        </div>
        <SkStatStrip count={4} />
        <SkCard description={false} aside>
          <SkRows count={4} height="h-10" gap="space-y-3" />
        </SkCard>
      </div>
    </SkPage>
  )
}
