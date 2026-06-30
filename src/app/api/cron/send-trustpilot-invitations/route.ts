/**
 * Send Trustpilot Invitations Cron Job
 *
 * Sends review invitations that are scheduled and ready (scheduled_for <= now()).
 * Runs daily at 10:00 UTC. The database trigger auto-creates scheduled invitations.
 * Max batch size: 50 per run to avoid rate limits.
 * Was previously: Sends review invitations 7 days after order completion
 * Runs daily
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTrustpilotInvitation } from '@/lib/actions/trustpilot'

// Must be set in environment variables. No fallback — fail closed if unset
// so a missing CRON_SECRET can never be triggered with a known default token.
const CRON_SECRET = process.env.CRON_SECRET
const BATCH_SIZE = 50

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Query invitations that are due (scheduled_for <= now), not yet sent, and not reviewed
    // The DB trigger auto-schedules invitations 7 days after order completion
    const { data: pendingInvitations, error: fetchError } = await supabase
      .from('trustpilot_invitations')
      .select('order_id, email, scheduled_for')
      .eq('review_submitted', false)
      .lte('scheduled_for', new Date().toISOString())
      .is('sent_at', null) // sent_at = NULL means not dispatched yet
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE) as any

    if (fetchError) {
      console.error('Error fetching pending invitations:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch pending invitations', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invitations ready to send',
        sent: 0,
      })
    }

    console.log(`📧 Sending Trustpilot invitations to ${pendingInvitations.length} buyers`)

    // Send invitations sequentially to avoid rate limits
    const results: { orderId: string; success: boolean; error?: string }[] = []
    for (const invitation of pendingInvitations) {
      try {
        const result = await sendTrustpilotInvitation(invitation.order_id)
        results.push({
          orderId: invitation.order_id,
          success: result.success,
          error: result.error,
        })
      } catch (error: any) {
        console.error(`Error sending invitation for order ${invitation.order_id}:`, error)
        results.push({
          orderId: invitation.order_id,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    console.log(`✅ Done: ${successCount} sent, ${failureCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Processed ${pendingInvitations.length} invitations`,
      sent: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error('Unexpected error in Trustpilot invitations cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
