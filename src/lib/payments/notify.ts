/**
 * Order-lifecycle comms for webhook-driven transitions.
 *
 * The payment webhook (CoinGate → dispatch → safedrop_transition) runs with
 * no user session, so this module uses the service-role client for all reads
 * and notification inserts. dispatch() AWAITS this (with errors swallowed) so
 * the serverless function can't freeze mid-send after the response goes out —
 * but a comms failure must never fail the payment transition itself.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { OrderEvent } from '@/lib/escrow/state-machine'
import type { CanonicalEvent } from '@/lib/payments/types'
import { toDecimal } from '@/lib/money'

interface OrderComms {
  id: string
  order_number: string | null
  buyer_id: string
  seller_id: string
  total_amount: number | null
  seller_payout: number | null
  quantity: number
  listingTitle: string
  buyer: { email: string | null; name: string }
  seller: { email: string | null; name: string }
}

async function fetchOrderComms(orderId: string): Promise<OrderComms | null> {
  const supabase = createServiceRoleClient()
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, buyer_id, seller_id, total_amount, seller_payout, quantity, listing:listings!orders_listing_id_fkey(title)'
    )
    .eq('id', orderId)
    .single() as any

  if (!order) return null

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, username, full_name')
    .in('id', [order.buyer_id, order.seller_id]) as any

  const profile = (id: string) => {
    const p = profiles?.find((x: any) => x.id === id)
    return { email: p?.email ?? null, name: p?.full_name || p?.username || 'Gamer' }
  }

  return {
    id: order.id,
    order_number: order.order_number,
    buyer_id: order.buyer_id,
    seller_id: order.seller_id,
    total_amount: order.total_amount,
    seller_payout: order.seller_payout,
    quantity: order.quantity ?? 1,
    listingTitle: order.listing?.title || 'your item',
    buyer: profile(order.buyer_id),
    seller: profile(order.seller_id),
  }
}

/** Insert an in-app notification with the service-role client (no session). */
async function insertNotification(input: {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}) {
  const supabase = createServiceRoleClient()
  const { error } = await (supabase.from('notifications').insert as any)({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    is_read: false,
  })
  if (error) console.error('[PaymentNotify] notification insert failed:', error)
}

/**
 * Send the comms for a webhook-applied order transition. Never throws.
 * `canonical` (when provided) distinguishes a completed refund from a
 * chargeback and carries the actual refunded amount.
 */
export async function notifyOrderTransition(
  orderEvent: OrderEvent,
  orderId: string,
  canonical?: CanonicalEvent
): Promise<void> {
  try {
    if (orderEvent !== 'CHARGE_CONFIRMED' && orderEvent !== 'REFUNDED') return

    const order = await fetchOrderComms(orderId)
    if (!order) return

    const orderNumber = order.order_number || orderId.slice(0, 8).toUpperCase()
    const { sendOrderPaidEmail, sendNewOrderNotificationEmail, sendOrderRefundedEmail } =
      await import('@/lib/email')

    if (orderEvent === 'CHARGE_CONFIRMED') {
      await Promise.allSettled([
        // Buyer purchase receipt
        order.buyer.email
          ? sendOrderPaidEmail({
              to: order.buyer.email,
              name: order.buyer.name,
              orderId: order.id,
              orderNumber,
              listingTitle: order.listingTitle,
              totalPaid: order.total_amount ?? 0,
            })
          : Promise.resolve(),
        // Seller new-sale email
        order.seller.email
          ? sendNewOrderNotificationEmail({
              to: order.seller.email,
              sellerName: order.seller.name,
              buyerName: order.buyer.name,
              listingTitle: order.listingTitle,
              quantity: order.quantity,
              totalAmount: order.total_amount ?? 0,
              sellerPayout: order.seller_payout ?? 0,
              orderId: order.id,
              orderNumber,
            })
          : Promise.resolve(),
        // Seller in-app notification
        insertNotification({
          userId: order.seller_id,
          type: 'new_order',
          title: 'New Order Received',
          message: `${order.buyer.name} bought "${order.listingTitle}" — order #${orderNumber}. Start delivery now.`,
          link: `/account/orders/${order.id}`,
        }),
      ])
      return
    }

    // REFUNDED transition. A chargeback OPENING is not a completed refund —
    // telling the buyer "refund processed" would be false, so chargebacks get
    // in-app awareness only until the case resolves.
    if (canonical?.type === 'CHARGEBACK_OPENED') {
      await Promise.allSettled([
        insertNotification({
          userId: order.seller_id,
          type: 'chargeback_opened',
          title: 'Payment Dispute Opened',
          message: `The payment provider opened a dispute on order #${orderNumber} ("${order.listingTitle}"). Our team is handling it.`,
          link: `/account/orders/${order.id}`,
        }),
        insertNotification({
          userId: order.buyer_id,
          type: 'chargeback_opened',
          title: 'Payment Dispute Opened',
          message: `Your payment provider opened a dispute on order #${orderNumber}. No action is needed unless support contacts you.`,
          link: `/account/orders/${order.id}`,
        }),
      ])
      return
    }

    // Completed refund: use the ACTUAL refunded amount from the provider
    // event when present (partial/fee-adjusted refunds), not the order total.
    const refundedAmount =
      canonical?.type === 'REFUND_COMPLETED' && canonical.amount
        ? Number(toDecimal(canonical.amount))
        : order.total_amount ?? 0

    await Promise.allSettled([
      order.buyer.email
        ? sendOrderRefundedEmail({
            to: order.buyer.email,
            name: order.buyer.name,
            orderNumber,
            listingTitle: order.listingTitle,
            amount: refundedAmount,
            destination: 'your original payment method',
          })
        : Promise.resolve(),
      insertNotification({
        userId: order.buyer_id,
        type: 'order_refunded',
        title: 'Order Refunded',
        message: `Order #${orderNumber} has been refunded — $${refundedAmount.toFixed(2)} to your original payment method.`,
        link: `/account/orders/${order.id}`,
      }),
      insertNotification({
        userId: order.seller_id,
        type: 'order_refunded',
        title: 'Order Refunded',
        message: `Order #${orderNumber} ("${order.listingTitle}") was refunded to the buyer.`,
        link: `/account/orders/${order.id}`,
      }),
    ])
  } catch (err) {
    console.error('[PaymentNotify] comms failed (non-fatal):', err)
  }
}
