/**
 * /admin/fees — buyer processing fees per payment method + the currency
 * rates their fixed fees / caps convert through (checkout B3 Part 1).
 *
 * Server shell; interactivity in BuyerFeesClient. Every write goes through
 * src/lib/actions/admin-buyer-fees.ts (requireAdmin → service role →
 * validate → write → fee_config_audit → revalidate). Nothing on this page
 * computes a fee — the admin edits terms, buyer_fee_quote prices orders.
 */

import { fetchBuyerFeeConfig } from '@/lib/actions/admin-buyer-fees'
import BuyerFeesClient from './BuyerFeesClient'

export const metadata = { title: 'Buyer Fees' }
export const dynamic = 'force-dynamic'

export default async function AdminBuyerFeesPage() {
  const config = await fetchBuyerFeeConfig()
  return <BuyerFeesClient initial={config} />
}
