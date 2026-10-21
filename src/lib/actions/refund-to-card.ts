'use server'

/**
 * Wallet "Refund To Card" list (refund rule, 2026-10-16): the signed-in
 * buyer's refunded orders and what each would send back to the payment
 * method used — the store credit plus the kept service fee. The request
 * itself is requestRefundToSource (lib/actions/refund-to-source.ts).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { toRefundToCardRow, type RefundToCardQuoteRow, type RefundToCardRow } from '@/lib/wallet/refund-to-card-rows'

export async function listMyRefundToCard(): Promise<RefundToCardRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  // Service role: the ledger and the request table are not in the buyer's
  // grant; both reads are pinned to the session user's id.
  const svc = createServiceRoleClient() as any
  const [{ data: rows, error }, { data: balance }] = await Promise.all([
    svc.rpc('refund_to_source_quotes', { p_buyer_id: user.id }),
    svc.rpc('user_wallet_balance', { p_user_id: user.id, p_currency: 'USD' }),
  ])
  if (error) throw new Error(error.message)
  return ((rows ?? []) as RefundToCardQuoteRow[]).map((r) => toRefundToCardRow(r, Number(balance ?? 0)))
}
