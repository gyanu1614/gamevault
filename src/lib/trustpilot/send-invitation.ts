/**
 * Trustpilot invitation sender (server only, service role).
 *
 * Was a 'use server' action on the session client: the cron that calls it
 * has no cookies, so every read ran as anon and found nothing, and as a
 * public action it could not simply be switched to the service role.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendTrustpilotInvitationEmail } from '@/lib/email'

/**
 * Send one Trustpilot review invitation.
 * Called by the send-trustpilot-invitations cron once an invitation is due.
 */
export async function sendTrustpilotInvitation(orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  const TRUSTPILOT_API_KEY = process.env.TRUSTPILOT_API_KEY
  const TRUSTPILOT_BUSINESS_UNIT_ID = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID
  const TRUSTPILOT_BCC_EMAIL = process.env.TRUSTPILOT_BCC_EMAIL
  try {
    // Env gate: without a Business Unit ID there is no review page to link to,
    // so sending anything would be pointless. Returning failure here leaves
    // sent_at NULL, so the cron retries automatically once envs are configured.
    if (!TRUSTPILOT_BUSINESS_UNIT_ID) {
      return {
        success: false,
        error:
          'Trustpilot not configured (NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID missing) — invitation left scheduled',
      }
    }

    // The cron has no user session: read and stamp as the service role.
    const supabase = createServiceRoleClient()

    // BCC mode: the order-completion receipt already BCC'd Trustpilot's
    // Automatic Feedback Service, which sends its own verified-review
    // invitation ~7 days after completion. Sending our fallback email too
    // would double-ask the buyer — stamp the row as handled and stop.
    if (TRUSTPILOT_BCC_EMAIL) {
      await (supabase
        .from('trustpilot_invitations')
        .update as any)({ sent_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .is('sent_at', null)
      return { success: true }
    }

    // Get order details with buyer info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        completed_at,
        buyer:profiles!orders_buyer_id_fkey(email, username, full_name)
      `)
      .eq('id', orderId)
      .single() as any

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    const buyerEmail = order.buyer?.email
    const buyerName = order.buyer?.full_name || order.buyer?.username || 'Gamer'

    if (!buyerEmail) {
      return { success: false, error: 'Buyer email not found' }
    }

    // Upsert invitation record (trigger may have already created it).
    // NOTE: review_submitted deliberately NOT in the payload — the column
    // defaults to false on insert, and including it here would clobber a
    // true value written by the webhook on conflicting rows.
    const { data: invitation, error: upsertError } = await (supabase
      .from('trustpilot_invitations')
      .upsert as any)(
        {
          order_id: orderId,
          buyer_id: order.buyer_id,
          email: buyerEmail,
        },
        { onConflict: 'order_id', ignoreDuplicates: false }
      )
      .select('id, review_submitted')
      .single()

    if (upsertError) {
      console.error('Error upserting Trustpilot invitation:', upsertError)
      return { success: false, error: upsertError.message }
    }

    // Don't send if already reviewed
    if (invitation?.review_submitted) {
      return { success: false, error: 'Buyer has already submitted a review' }
    }

    // Try Trustpilot Invitation API first if API key is configured
    let trustpilotApiSuccess = false
    if (TRUSTPILOT_API_KEY && TRUSTPILOT_BUSINESS_UNIT_ID) {
      try {
        const tpResponse = await fetch(
          `https://invitations-api.trustpilot.com/v1/private/business-units/${TRUSTPILOT_BUSINESS_UNIT_ID}/email-invitations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${TRUSTPILOT_API_KEY}`,
            },
            body: JSON.stringify({
              recipientEmail: buyerEmail,
              recipientName: buyerName,
              referenceId: orderId,
              locale: 'en-US',
              tags: ['dropmarket', 'order'],
            }),
          }
        )

        if (tpResponse.ok) {
          trustpilotApiSuccess = true
          console.log(`✅ Trustpilot API invitation sent to ${buyerEmail}`)
        } else {
          const errBody = await tpResponse.text()
          console.warn(`Trustpilot API error (${tpResponse.status}): ${errBody}`)
        }
      } catch (tpError) {
        console.warn('Trustpilot API unavailable, falling back to email:', tpError)
      }
    }

    // Fallback: send via Resend email if Trustpilot API didn't succeed
    if (!trustpilotApiSuccess) {
      const emailResult = await sendTrustpilotInvitationEmail({
        to: buyerEmail,
        name: buyerName,
        orderId,
        reviewUrl: `https://www.trustpilot.com/evaluate/${TRUSTPILOT_BUSINESS_UNIT_ID}`,
      })

      if (!emailResult.success) {
        // Don't stamp sent_at — leaving it NULL lets the cron retry tomorrow.
        console.error('Trustpilot fallback email failed:', emailResult.error)
        return { success: false, error: 'Both Trustpilot API and fallback email failed' }
      }
    }

    // Update sent_at timestamp on the invitation record
    await (supabase
      .from('trustpilot_invitations')
      .update as any)({ sent_at: new Date().toISOString() })
      .eq('order_id', orderId)

    console.log(`✉️ Trustpilot invitation dispatched to ${buyerEmail} for order ${orderId}`)

    return { success: true }
  } catch (error: any) {
    console.error('Error in sendTrustpilotInvitation:', error)
    return { success: false, error: error.message || 'Failed to send Trustpilot invitation' }
  }
}
