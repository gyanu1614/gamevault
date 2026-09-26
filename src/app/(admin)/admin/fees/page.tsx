/**
 * /admin/fees — the money numbers that are not per-pair commission:
 *
 *   · post-delivery (fee engine PR 7): completion hold, per-category
 *     auto-complete windows, dispute window, new-seller withdrawal rule,
 *     payout-details freeze, the withdrawal fee schedule, the fee notice;
 *   · buyer processing fees per payment method + the currency rates their
 *     fixed fees / caps convert through (checkout B3).
 *
 * Every write is audited in fee_config_audit. Per-pair commission rates stay
 * on /admin/games → Fees. Nothing on this page computes a fee — the admin
 * edits terms; withdrawal_quote / buyer_fee_quote price the money.
 */

import type { Metadata } from 'next'
import { fetchMoneySettings } from '@/lib/actions/admin-fees'
import { fetchBuyerFeeConfig } from '@/lib/actions/admin-buyer-fees'
import { PageHeader } from '../components/kit'
import { MoneySettingsClient } from './_MoneySettingsClient'
import { FeeNoticeClient } from './_FeeNoticeClient'
import BuyerFeesClient from './BuyerFeesClient'

export const metadata: Metadata = { title: 'Fees & Payouts' }
export const dynamic = 'force-dynamic'

export default async function AdminFeesPage() {
  const [data, buyerFees] = await Promise.all([fetchMoneySettings(), fetchBuyerFeeConfig()])
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fees & Payouts"
        description="Completion hold, protection windows, dispute window, withdrawal gate, payout fees and buyer processing fees per payment method. Each change writes an audit row."
      />
      <MoneySettingsClient initial={data} />
      <FeeNoticeClient />
      <BuyerFeesClient initial={buyerFees} />
    </div>
  )
}
