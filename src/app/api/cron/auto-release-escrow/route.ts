/**
 * Auto-Release Escrow Cron Job
 *
 * Automatically releases escrow for orders that have passed the 48-hour window
 * This should be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

// Must be set in environment variables. No fallback — fail closed if unset
// so a missing CRON_SECRET can never be triggered with a known default token.
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get orders ready for auto-release
    // Using the database function we created in the migration
    const { data: orders, error: fetchError } = await supabase.rpc(
      'get_orders_ready_for_auto_release'
    ) as any

    if (fetchError) {
      console.error('Error fetching orders ready for auto-release:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders ready for auto-release',
        processed: 0,
      })
    }

    console.log(`📦 Found ${orders.length} orders ready for auto-release`)

    // Process each order
    const results = []
    const service = createServiceRoleClient()
    for (const order of orders) {
      try {
        // Gate: release_escrow is a silent no-op UPDATE (WHERE escrow_status
        // = 'held'), so re-check the order state immediately before acting —
        // a buyer may have confirmed receipt (comms already sent) or opened
        // a dispute (frozen) since the ready-list was fetched. Without this,
        // the cron would email "completed automatically" on orders it never
        // actually released.
        const { data: full } = await service
          .from('orders')
          .select(
            'id, status, escrow_status, order_number, buyer_id, seller_id, total_amount, seller_payout, listing:listings!orders_listing_id_fkey(title)'
          )
          .eq('id', order.id)
          .single() as any

        if (!full || full.escrow_status !== 'held' || full.status !== 'delivered') {
          results.push({ orderId: order.id, success: true, skipped: true })
          continue
        }

        // Call the release_escrow function
        const { error: releaseError } = await ((supabase as any).rpc('release_escrow', {
          order_id: order.id,
          method: 'auto',
        }))

        if (releaseError) {
          console.error(`❌ Failed to release escrow for order ${order.id}:`, releaseError)
          results.push({
            orderId: order.id,
            success: false,
            error: releaseError.message,
          })
        } else {
          console.log(`✅ Successfully released escrow for order ${order.id}`)
          results.push({
            orderId: order.id,
            success: true,
          })

          // Completion comms: buyer receipt (autoReleased copy + Trustpilot
          // AFS BCC) + seller email + seller in-app. Cron has no user
          // session, so use the service-role client. Best-effort: a comms
          // failure must not mark the release as failed.
          try {
            {
              const orderRef = full.order_number || full.id.slice(0, 8).toUpperCase()
              const listingTitle = full.listing?.title || 'your item'
              const { data: parties } = await service
                .from('profiles')
                .select('id, email, username, full_name')
                .in('id', [full.buyer_id, full.seller_id]) as any
              const party = (id: string) => parties?.find((p: any) => p.id === id)
              const buyer = party(full.buyer_id)
              const seller = party(full.seller_id)
              const { sendOrderCompletionEmail, sendOrderCompletedSellerEmail } =
                await import('@/lib/email')

              await Promise.allSettled([
                buyer?.email
                  ? sendOrderCompletionEmail({
                      to: buyer.email,
                      name: buyer.full_name || buyer.username || 'Gamer',
                      orderId: full.id,
                      orderNumber: orderRef,
                      listingTitle,
                      totalPaid: full.total_amount ?? 0,
                      autoReleased: true,
                    })
                  : Promise.resolve(),
                seller?.email
                  ? sendOrderCompletedSellerEmail({
                      to: seller.email,
                      name: seller.full_name || seller.username || 'Gamer',
                      orderId: full.id,
                      orderNumber: orderRef,
                      listingTitle,
                      payout: full.seller_payout ?? 0,
                      autoReleased: true,
                    })
                  : Promise.resolve(),
                (service.from('notifications').insert as any)({
                  user_id: full.seller_id,
                  type: 'order_completed',
                  title: 'Order Auto-Completed',
                  message: `The protection window on order #${orderRef} closed — your $${(full.seller_payout ?? 0).toFixed(2)} payout is being processed.`,
                  link: `/account/orders/${full.id}`,
                  is_read: false,
                }),
              ])
            }
          } catch (commsError) {
            console.error(`[AutoRelease] Comms failed for order ${order.id} (non-fatal):`, commsError)
          }

          // TODO: Trigger Stripe payout to seller
          // await createStripePayout(order.seller_id, order.seller_payout)
        }
      } catch (error: any) {
        console.error(`Error processing order ${order.id}:`, error)
        results.push({
          orderId: order.id,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Processed ${orders.length} orders`,
      processed: orders.length,
      successful: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error('Unexpected error in auto-release cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
