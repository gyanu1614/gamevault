/**
 * API Route for Payment Intent Creation
 * Used for testing rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent } from '@/lib/actions/stripe-payment'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { listingId, quantity = 1 } = body

    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'Missing listingId' },
        { status: 400 }
      )
    }

    // Call the Server Action
    const result = await createPaymentIntent(listingId, quantity)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      clientSecret: result.clientSecret,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
