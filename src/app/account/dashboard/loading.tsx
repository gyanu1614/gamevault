/**
 * Dashboard skeleton: the seller dashboard as SellerDashboard draws it
 * (header + 7/30-day tabs, stat panel, trend + top offers | attention +
 * reputation). Buyers see the same frame; their page swaps in with the same
 * header and stat panel.
 */

import { Sk, SkCard, SkPage, SkRows, SkStatStrip, SkTabs } from '@/components/account/AccountSkeletons'

export default function DashboardLoading() {
  return (
    <SkPage titleWidth="w-52" actions={<SkTabs widths={[66, 74]} />}>
      <div className="mt-6 space-y-4">
        <SkStatStrip count={4} />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <SkCard>
              <Sk className="h-8 w-28" />
              <Sk className="mt-3 h-44 w-full rounded-md" />
            </SkCard>
            <SkCard description={false} aside>
              <SkRows count={3} />
            </SkCard>
          </div>
          <div className="space-y-4">
            <SkCard description={false}>
              <SkRows count={3} />
            </SkCard>
            <SkCard description={false} aside>
              <SkRows count={3} />
            </SkCard>
          </div>
        </div>
      </div>
    </SkPage>
  )
}
