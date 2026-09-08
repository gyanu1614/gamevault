/**
 * /admin/withdrawals — seller payout queue.
 *
 * Server wrapper: fetches every withdrawal request (RLS: admins see all) and
 * hands it to the client for the three ops moves — approve, reject, and the
 * one that settles the ledger: Mark Paid (payout_clearing → external_payout
 * via markWithdrawalPaid). Auth is enforced by the (admin) layout; every
 * mutation re-checks requireAdmin server-side.
 */

import { getAllWithdrawalRequests } from '@/lib/actions/withdrawals'
import WithdrawalsClient from './_WithdrawalsClient'

export const metadata = { title: 'Withdrawals' }

export default async function AdminWithdrawalsPage() {
  const result = await getAllWithdrawalRequests()
  return <WithdrawalsClient initialRequests={result.requests ?? []} />
}
