/**
 * PAYMENT_NOTICE — a refund or card dispute seen at the provider (Stripe),
 * recorded for admins and NOTHING else. Owner rule (2026-10-27): money never
 * moves automatically on these.
 *
 *   refund   Refund To Card already debited the buyer's store credit before
 *            the provider refunded; a refund sent from the provider dashboard
 *            by hand has NOT touched the order. Crediting the wallet here
 *            (Payssion's REFUND_COMPLETED path) would pay the buyer twice.
 *   dispute  Stripe takes the disputed amount and its fee from our balance;
 *            what happens to the order and the seller is an admin call.
 *
 * One in-app notification per active admin through admin_alert_once (deduped
 * on type + title + link, in SQL — dispatch writes no notification rows).
 * The title carries the amount, so a second partial refund alerts again.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { toDecimal, type Money } from '@/lib/money'
import type { CanonicalEvent } from '@/lib/payments/types'

type PaymentNotice = Extract<CanonicalEvent, { type: 'PAYMENT_NOTICE' }>

function amountText(m: Money): string {
  return m.currency === 'USD' ? `$${toDecimal(m)}` : `${toDecimal(m)} ${m.currency}`
}

export async function recordPaymentNotice(event: PaymentNotice, providerName = 'unknown'): Promise<void> {
  const svc = createServiceRoleClient()
  const { data: order } = (await svc
    .from('orders')
    .select('order_number, status')
    .eq('id', event.orderId)
    .maybeSingle()) as { data: { order_number: string | null; status: string } | null }
  const ref = order?.order_number || event.orderId.slice(0, 8).toUpperCase()
  const status = order?.status ?? 'not found'
  const amount = amountText(event.amount)
  const charge = `${providerName}/${event.providerChargeId}`

  const title = event.kind === 'refund' ? `Card Refund Recorded · ${amount}` : `Card Dispute Opened · ${amount}`
  const message =
    event.kind === 'refund'
      ? `${amount} has been refunded in total on order ${ref} (${status}), charge ${charge}. Nothing moved in DropMarket. ` +
        `If this refund did not come from an approved Refund To Card request, settle the order by hand so the buyer is not paid twice.`
      : `A card dispute for ${amount} was opened on order ${ref} (${status}), charge ${charge}` +
        `${event.detail ? ` — ${event.detail}` : ''}. Nothing moved in DropMarket. ` +
        `Answer it in the Stripe dashboard and decide the order and the seller payout by hand.`

  const { error } = await (svc.rpc as any)('admin_alert_once', {
    p_type: 'payment_review',
    p_title: title,
    p_message: message,
    p_link: `/account/orders/${event.orderId}`,
  })
  if (error) throw new Error(`admin_alert_once failed: ${error.message}`)
}
