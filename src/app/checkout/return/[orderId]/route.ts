/**
 * GET /checkout/return/[orderId] — the smart landing for provider-hosted
 * payment returns (Payssion). Providers with ONE return URL send the buyer
 * here no matter what happened; this route looks at what actually happened
 * and puts them in the right place:
 *
 *   · order already paid            → order page (?paid=1 collapses history)
 *   · order cancelled (webhook won) → back to checkout, ?cancelled=1 toast
 *   · still pending + provider says cancelled/failed → back to checkout
 *     (the webhook cancels the order moments later)
 *   · still pending, genuinely open (voucher printed, wallet pending)
 *     → order page's Awaiting Payment panel
 *
 * Redirects use the REQUEST's own origin, never an env-configured one — the
 * buyer stays on whatever host/port they are actually browsing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CANCELLED_STATES = new Set(['cancelled', 'failed', 'expired', 'rejected', 'blocked', 'error'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return to(`/login?redirect=/account/orders/${orderId}`)

  const { data: order } = (await supabase
    .from('orders')
    .select('id, buyer_id, status, listing_id, quantity, payment_provider, provider_charge_id')
    .eq('id', orderId)
    .single()) as any
  if (!order || order.buyer_id !== user.id) return to('/account/orders')

  const backToCheckout = `/checkout/${order.listing_id}?qty=${order.quantity ?? 1}&cancelled=1`
  if (order.status !== 'pending') {
    return order.status === 'cancelled' ? to(backToCheckout) : to(`/account/orders/${orderId}?paid=1`)
  }

  // Pending here usually means the buyer cancelled on the provider page and
  // beat the webhook home — ask the provider which it was. Best-effort: on
  // any error fall through to the awaiting-payment panel.
  try {
    if (order.payment_provider === 'payssion' && order.provider_charge_id) {
      // Order-bound lookup: the details signature includes the order id.
      const { payssionTransactionState } = await import('@/lib/payments/providers/payssion')
      const state = await payssionTransactionState(order.provider_charge_id, order.id)
      if (CANCELLED_STATES.has(state)) return to(backToCheckout)
    } else if (order.payment_provider && order.provider_charge_id) {
      const { getProvider } = await import('@/lib/payments/registry')
      const { rawStatus } = await getProvider(order.payment_provider).getCharge(
        order.provider_charge_id
      )
      if (CANCELLED_STATES.has(rawStatus)) return to(backToCheckout)
    }
  } catch (e) {
    console.error('[CheckoutReturn] provider state check failed (non-fatal):', e)
  }

  return to(`/account/orders/${orderId}`)
}
