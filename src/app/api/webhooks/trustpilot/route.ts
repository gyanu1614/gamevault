/**
 * Trustpilot Webhook Handler
 *
 * Receives review notifications from Trustpilot and updates invitation records.
 * Trustpilot sends webhooks when a review is published.
 *
 * Setup: Configure webhook URL in Trustpilot Business portal:
 * https://businessapp.b2b.trustpilot.com/ → Integrations → Webhooks
 * URL: https://yourdomain.com/api/webhooks/trustpilot
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Trustpilot signs webhooks with HMAC-SHA256 - verify for security
const TRUSTPILOT_WEBHOOK_SECRET = process.env.TRUSTPILOT_WEBHOOK_SECRET

interface TrustpilotWebhookPayload {
  eventType: string
  reviewId: string
  referenceId?: string // This is the orderId we passed when sending the invitation
  businessUnitId: string
  review?: {
    id: string
    stars: number
    title: string
    text: string
    language: string
    createdAt: string
    isVerified: boolean
    links?: Array<{ href: string; method: string; rel: string }>
  }
  consumer?: {
    displayName: string
    hasImage: boolean
    profileUrl: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Verify webhook signature if secret is configured
    if (TRUSTPILOT_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-trustpilot-signature')
      if (!signature) {
        console.warn('Trustpilot webhook: missing signature header')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      const isValid = await verifyTrustpilotSignature(body, signature, TRUSTPILOT_WEBHOOK_SECRET)
      if (!isValid) {
        console.warn('Trustpilot webhook: invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    let payload: TrustpilotWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log(`Trustpilot webhook received: ${payload.eventType}`, {
      reviewId: payload.reviewId,
      referenceId: payload.referenceId,
    })

    // Handle review published events
    if (
      payload.eventType === 'review-created' ||
      payload.eventType === 'review-published' ||
      payload.eventType === 'review-updated'
    ) {
      if (!payload.referenceId) {
        // No reference ID - can't link to an order, but still acknowledge
        return NextResponse.json({ received: true, note: 'No reference ID provided' })
      }

      const supabase = await createClient()

      // Build the review URL from the review links if available
      const reviewUrl =
        payload.review?.links?.find((l) => l.rel === 'review')?.href ||
        `https://www.trustpilot.com/reviews/${payload.reviewId}`

      // Update the invitation record
      const { error: updateError } = await (supabase
        .from('trustpilot_invitations')
        .update as any)({
          review_submitted: true,
          review_submitted_at: new Date().toISOString(),
          review_rating: payload.review?.stars || null,
          review_url: reviewUrl,
        })
        .eq('order_id', payload.referenceId)

      if (updateError) {
        // Not necessarily an error - invitation may not exist if created outside the system
        console.warn(
          `Trustpilot webhook: could not update invitation for order ${payload.referenceId}:`,
          updateError.message
        )
      } else {
        console.log(
          `Trustpilot review recorded for order ${payload.referenceId} - ${payload.review?.stars} stars`
        )
      }
    }

    // Acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Trustpilot webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Verify Trustpilot HMAC-SHA256 webhook signature
 */
async function verifyTrustpilotSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Trustpilot sends signature as hex string
    const sigBytes = hexToBytes(signature.replace('sha256=', ''))
    const bodyBytes = encoder.encode(body)

    return await crypto.subtle.verify('HMAC', key, sigBytes as unknown as ArrayBuffer, bodyBytes)
  } catch {
    return false
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// Trustpilot may also send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'Trustpilot webhook endpoint active' })
}
