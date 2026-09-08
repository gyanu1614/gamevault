import 'server-only'

/**
 * awardCashback — buyer cashback onto the wallet ledger.
 *
 * Deliberately NOT in a 'use server' module: it mints spendable store credit
 * through the service-role wallet_credit RPC, so it must never be a
 * client-invocable action endpoint (the security review caught the
 * payload-trusting version doing exactly that). It takes only an orderId and
 * verifies everything else itself: recipient, amount and currency come from
 * the order row, which must be completed and non-guest.
 *
 * Ledger posting: platform_commission debit → user_wallet credit, idempotency
 * key `cashback:<orderId>` — replays dedupe in post_journal. loyalty_credits
 * stays as the display/history table (service-role writes only; the
 * authenticated INSERT grant was revoked in 20260908000000).
 *
 * Rate is configurable via LOYALTY_CASHBACK_RATE env var (default 0.02 = 2%).
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { creditWallet, getWalletBalance } from '@/lib/wallet/wallet'

const LOYALTY_CASHBACK_RATE = parseFloat(
  process.env.LOYALTY_CASHBACK_RATE || '0.02'
)

/**
 * Called fire-and-forget from confirmOrderReceipt() after the completion
 * transition. Safe to call multiple times — the ledger dedupes on
 * `cashback:<orderId>`.
 */
export async function awardCashback(params: { orderId: string }): Promise<void> {
  const { orderId } = params

  try {
    const service = createServiceRoleClient()

    // Trust nothing but the orderId: re-fetch the order and derive the
    // recipient, amount and currency from the row. Only a completed,
    // non-guest order earns cashback.
    const { data: orderRaw } = await service
      .from('orders')
      .select('id, buyer_id, subtotal, currency, status, is_guest_order')
      .eq('id', orderId)
      .single()
    const order = orderRaw as any

    if (!order || order.status !== 'completed' || order.is_guest_order || !order.buyer_id) {
      return
    }

    const userId: string = order.buyer_id
    const subtotal: number = order.subtotal ?? 0
    const currency: string = (order.currency || 'USD').toUpperCase()

    if (subtotal <= 0) return

    // Replay guard for the history table only — the ledger idempotency key is
    // the real one, this just avoids duplicate display rows.
    const { data: existing } = await service
      .from('loyalty_credits')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'earned')
      .maybeSingle()

    if (existing) return   // already awarded

    const cashbackAmount = parseFloat((subtotal * LOYALTY_CASHBACK_RATE).toFixed(2))
    if (cashbackAmount <= 0) return

    // Source of truth: balanced idempotent ledger journal
    // (platform_commission debit → user_wallet credit).
    await creditWallet({
      userId,
      orderId,
      amountMinor: BigInt(Math.round(cashbackAmount * 100)),
      currency,
      counterparty: 'platform_commission',
      idempotencyKey: `cashback:${orderId}`,
      eventRef: 'CASHBACK',
    })

    const balanceAfterMinor = await getWalletBalance(userId, currency)

    // History row second, so a partial failure replays cleanly: the ledger
    // key dedupes, the missing row inserts on the retry.
    // (cast: Supabase narrow-select inference returns `never`)
    await service.from('loyalty_credits').insert({
      user_id:      userId,
      order_id:     orderId,
      type:         'earned',
      amount:       cashbackAmount,
      balance_after: Number(balanceAfterMinor) / 100,
      description:  `${(LOYALTY_CASHBACK_RATE * 100).toFixed(0)}% cashback on order`,
    } as any)
  } catch (err) {
    console.error('[loyalty] awardCashback error:', err)
  }
}
