/**
 * Server wrapper for PaymentsMarquee: passes in which methods checkout has
 * switched on (payment_method_fees.selectable, through the same cached anon
 * read /fees uses), so the strip never shows a method a buyer can't pick.
 * If that read fails the strip shows only the coins, never a method that
 * may be off. Client pages take it as a slot from their server parent.
 */

import { getPublicBuyerFees } from '@/lib/fees/buyer-public-rates'
import { PaymentsMarquee } from './PaymentsMarquee'

export async function PaymentsStrip({ disclaimer }: { disclaimer?: string | null }) {
  const rows = await getPublicBuyerFees().catch(() => [])
  const live = rows.filter((r) => r.selectable).map((r) => r.method)
  return <PaymentsMarquee disclaimer={disclaimer} live={live} />
}
