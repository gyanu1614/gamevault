'use client'

import { useState, type ReactNode } from 'react'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'

type Tab = 'payouts' | 'buyer' | 'notice'

/**
 * /admin/fees in three tabs instead of one long page. Each tab's content is
 * rendered by the server page and kept mounted, so unsaved edits in one tab
 * survive a look at another.
 */
export function FeesTabs({ payouts, buyer, notice }: { payouts: ReactNode; buyer: ReactNode; notice: ReactNode }) {
  const [tab, setTab] = useState<Tab>('payouts')
  const panels: Record<Tab, ReactNode> = { payouts, buyer, notice }
  return (
    <div className="space-y-5">
      <SegmentedTabs
        tabs={[
          { id: 'payouts', label: 'Payouts & Timing' },
          { id: 'buyer', label: 'Buyer Fees' },
          { id: 'notice', label: 'Fee Notice' },
        ]}
        value={tab}
        onChange={setTab}
        layoutId="admin-fees-tabs"
        ariaLabel="Fee settings"
      />
      {(Object.keys(panels) as Tab[]).map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`admin-fees-tabs-panel-${id}`}
          aria-labelledby={`admin-fees-tabs-tab-${id}`}
          hidden={tab !== id}
        >
          {panels[id]}
        </div>
      ))}
    </div>
  )
}
