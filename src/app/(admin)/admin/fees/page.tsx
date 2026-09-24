/**
 * /admin/fees — the post-delivery money numbers (fee engine PR 7): completion
 * hold, per-category auto-complete windows, dispute window, new-seller
 * withdrawal rule, payout-details freeze, and the withdrawal fee schedule.
 * Every write is one audited RPC (fee_config_audit). Per-pair commission
 * rates stay on /admin/games → Fees.
 */

import type { Metadata } from 'next'
import { fetchMoneySettings } from '@/lib/actions/admin-fees'
import { PageHeader } from '../components/kit'
import { MoneySettingsClient } from './_MoneySettingsClient'
import { FeeNoticeClient } from './_FeeNoticeClient'

export const metadata: Metadata = { title: 'Fees & Payouts' }
export const dynamic = 'force-dynamic'

export default async function AdminFeesPage() {
  const data = await fetchMoneySettings()
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fees & Payouts"
        description="Completion hold, protection windows, dispute window, withdrawal gate and payout fees. Each change writes an audit row."
      />
      <MoneySettingsClient initial={data} />
      <FeeNoticeClient />
    </div>
  )
}
