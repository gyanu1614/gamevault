/**
 * GET /checkout/return/[orderId] — the smart landing for provider-hosted
 * payment returns (Payssion). Providers with ONE return URL send the buyer
 * here no matter what happened; this route looks at what actually happened
 * and puts them in the right place (rules + tests: lib/payments/
 * return-destination.ts):
 *
 *   · order paid, or Payssion says paid → the Order Paid page (it shows
 *     "Confirming" until the webhook lands, then "Order Paid → Go to Order")
 *   · cancelled (ours or Payssion's)    → back to checkout, ?cancelled=1 toast
 *   · still unpaid at Payssion           → back to checkout with ?order= so the
 *     page says "your last payment wasn't finished"
 *   · a voucher still open               → its order page (instructions)
 *
 * Same tab (2026-10-16): the pay page now opens in this tab, so these are
 * plain navigations the buyer can step Back through.
 *
 * Redirects use the REQUEST's own origin, never an env-configured one — the
 * buyer stays on whatever host/port they are actually browsing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    .select('id, buyer_id, status, listing_id, quantity')
    .eq('id', orderId)
    .single()) as any
  if (!order || order.buyer_id !== user.id) return to('/account/orders')

  // Pending: ask the provider what happened (the buyer is usually home before
  // the webhook). Best-effort: on any error — including the PAY-016 probe
  // deadline — providerState stays null and the Order Paid page confirms by
  // polling our DB; the webhook is the authority either way.
  let providerState: string | null = null
  let pmKind: 'instant' | 'voucher' | null = null
  if (order.status === 'pending') {
    try {
      const { RETURN_PROBE_TIMEOUT_MS, withTimeout } = await import('@/lib/payments/timeouts')
      // Round B: the charge to ask about is the order's OPEN attempt (the
      // order's mirror columns are display data, never the authority).
      const { openAttemptForOrder } = await import('@/lib/payments/attempts')
      const attempt = await openAttemptForOrder(order.id)
      if (attempt?.pm_id) {
        const { PAYSSION_METHODS } = await import('@/lib/payments/providers/payssion/methods')
        pmKind = PAYSSION_METHODS[attempt.pm_id]?.kind ?? null
      }
      if (attempt?.provider === 'payssion' && attempt.provider_charge_id) {
        // Order-bound lookup: the details signature includes the order id.
        const { payssionTransactionState } = await import('@/lib/payments/providers/payssion')
        providerState = await payssionTransactionState(attempt.provider_charge_id, order.id, {
          timeoutMs: RETURN_PROBE_TIMEOUT_MS,
        })
      } else if (attempt?.provider && attempt.provider_charge_id) {
        const { getProvider } = await import('@/lib/payments/registry')
        const { rawStatus } = await withTimeout(
          getProvider(attempt.provider).getCharge(attempt.provider_charge_id),
          RETURN_PROBE_TIMEOUT_MS,
          'return-route charge probe'
        )
        providerState = rawStatus
      }
    } catch (e) {
      console.error('[CheckoutReturn] provider state check failed (non-fatal):', e)
    }
  }

  const { returnDestination } = await import('@/lib/payments/return-destination')
  return to(
    returnDestination({
      orderId: order.id,
      listingId: order.listing_id,
      quantity: order.quantity ?? 1,
      status: order.status,
      pmKind,
      providerState,
    })
  )
}
