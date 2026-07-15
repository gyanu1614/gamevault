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
        // Gate: re-check the order state immediately before acting — a buyer
        // may have confirmed receipt (comms + payout already sent) or opened
        // a dispute (frozen) since the ready-list was fetched.
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

        // Release — the same column writes as the legacy release_escrow RPC
        // (status/escrow_status/release_method/completed_at, guarded on
        // escrow_status = 'held'), but as a direct compare-and-swap that
        // returns the claimed row. The RPC returns void even when its WHERE
        // matched nothing, so an overlapping cron run or a buyer confirming
        // receipt between the gate above and the release would have made
        // this path credit the seller and email "completed automatically" a
        // second time. With the CAS, exactly one caller wins the
        // held → released flip, and only the winner pays and sends comms.
        const { data: released, error: releaseError } = await (service
          .from('orders')
          .update as any)({
            status: 'completed',
            escrow_status: 'released',
            release_method: 'auto',
            completed_at: new Date().toISOString(),
          })
          .eq('id', order.id)
          .eq('escrow_status', 'held')
          .eq('status', 'delivered')
          .select('id')

        if (releaseError) {
          console.error(`❌ Failed to release escrow for order ${order.id}:`, releaseError)
          results.push({
            orderId: order.id,
            success: false,
            error: releaseError.message,
          })
        } else if (!released?.length) {
          // Lost the race: someone else moved the order off held/delivered
          // between the gate and the CAS. They own the credit and comms.
          results.push({ orderId: order.id, success: true, skipped: true })
        } else {
          console.log(`✅ Successfully released escrow for order ${order.id}`)

          // Credit the seller — the same rail the buyer-confirm path uses
          // (confirmOrderReceipt → transferEscrowToSeller): a Stripe transfer
          // when the seller's Connect account is ready, otherwise a
          // seller_balance credit / held payout via
          // release_escrow_to_seller_balance. The release above only flips
          // order status; without this call an auto-released order never
          // pays the seller. NOT the safedrop_transition AUTO_RELEASED
          // path — that seam is ledger-only (no payout) until Phase 3 wires
          // the provider rail. Non-fatal: the release already happened, so a
          // failed credit is surfaced in the results for retry, not rolled
          // back.
          let payout: { success: boolean; transferId: string | null; error: string | null }
          try {
            const { transferEscrowToSeller } = await import('@/lib/stripe/connect')
            payout = await transferEscrowToSeller(order.id)
          } catch (payoutError: any) {
            payout = {
              success: false,
              transferId: null,
              error: payoutError?.message || 'Payout failed',
            }
          }
          if (!payout.success) {
            console.error(
              `[AutoRelease] Seller credit failed for order ${order.id}: ${payout.error}`
            )
          }

          results.push({
            orderId: order.id,
            success: true,
            payout: payout.success
              ? payout.transferId
                ? 'transferred'
                : 'credited'
              : 'failed',
            ...(payout.error ? { payoutError: payout.error } : {}),
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
