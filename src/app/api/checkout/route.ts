/**
 * POST /api/checkout — create an order + CoinGate charge, return the redirect URL.
 *
 * Body: { listingId, quantity?, promoDiscount?, walletAmount? }
 * Optional header `Idempotency-Key` (hardening §C): a repeated key returns the
 * stored result instead of creating a second order/charge — guards against a
 * double-tap or retried network call.
 *
 * All money is computed server-side in createCheckout; the client cannot
 * influence the charge amount.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckout } from '@/lib/actions/checkout'
import {
  getIdempotentResult,
  storeIdempotentResult,
  validateIdempotencyKey,
} from '@/lib/utils/idempotency'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body?.listingId) {
    return NextResponse.json({ success: false, error: 'Missing listingId' }, { status: 400 })
  }

  // Idempotency at the edge: if a valid key was already processed, replay it.
  const idemKey = req.headers.get('idempotency-key') ?? undefined
  if (idemKey && validateIdempotencyKey(idemKey)) {
    const cached = await getIdempotentResult(idemKey, 'create_order', user.id)
    if (cached) {
      return NextResponse.json(cached.response_body, { status: cached.response_status })
    }
  }

  const result = await createCheckout({
    listingId: body.listingId,
    quantity: body.quantity,
    promoDiscount: body.promoDiscount,
    walletAmount: body.walletAmount,
  })

  const status = result.success ? 200 : 400
  if (idemKey && validateIdempotencyKey(idemKey) && result.success) {
    await storeIdempotentResult(
      idemKey,
      'create_order',
      { response_status: status, response_body: result as any, related_order_id: result.orderId },
      user.id
    )
  }

  return NextResponse.json(result, { status })
}
