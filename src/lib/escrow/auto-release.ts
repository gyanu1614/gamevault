/**
 * Auto-release pipeline for a single due order:
 * gate re-check → compare-and-swap release → seller credit → completion comms.
 *
 * Shared by the auto-release cron (src/app/api/cron/auto-release-escrow) and
 * the admin manual trigger (src/app/api/admin/trigger-escrow-release). Both
 * act on the same get_orders_ready_for_auto_release list and MUST behave
 * identically — the admin route once called the legacy release_escrow RPC,
 * which only flipped order status: no seller credit, no state re-check, no
 * comms. Keep the pipeline here so the two paths cannot drift again.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'

export interface AutoReleaseResult {
  orderId: string
  success: boolean
  /** True when the order was no longer held/delivered — someone else (buyer
   * confirm, dispute, overlapping run) owns the credit and comms. */
  skipped?: boolean
  payout?: 'transferred' | 'credited' | 'failed'
  payoutError?: string
  error?: string
}

/**
 * Release one due order. Never throws — every failure mode is folded into
 * the returned result so callers can keep processing the rest of the batch.
 */
export async function releaseDueOrder(orderId: string): Promise<AutoReleaseResult> {
  const service = createServiceRoleClient()
  try {
    // Gate: re-check the order state immediately before acting — a buyer
    // may have confirmed receipt (comms + payout already sent) or opened
    // a dispute (frozen) since the ready-list was fetched.
    const { data: full } = await service
      .from('orders')
      .select(
        'id, status, escrow_status, order_number, buyer_id, seller_id, total_amount, seller_payout, listing:listings!orders_listing_id_fkey(title)'
      )
      .eq('id', orderId)
      .single() as any

    if (!full || full.escrow_status !== 'held' || full.status !== 'delivered') {
      return { orderId, success: true, skipped: true }
    }

    // Release — the same column writes as the legacy release_escrow RPC
    // (status/escrow_status/release_method/completed_at, guarded on
    // escrow_status = 'held'), but as a direct compare-and-swap that
    // returns the claimed row. The RPC returns void even when its WHERE
    // matched nothing, so an overlapping run or a buyer confirming
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
      .eq('id', orderId)
      .eq('escrow_status', 'held')
      .eq('status', 'delivered')
      .select('id')

    if (releaseError) {
      console.error(`❌ Failed to release escrow for order ${orderId}:`, releaseError)
      return { orderId, success: false, error: releaseError.message }
    }

    if (!released?.length) {
      // Lost the race: someone else moved the order off held/delivered
      // between the gate and the CAS. They own the credit and comms.
      return { orderId, success: true, skipped: true }
    }

    console.log(`✅ Successfully released escrow for order ${orderId}`)

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
      payout = await transferEscrowToSeller(orderId)
    } catch (payoutError: any) {
      payout = {
        success: false,
        transferId: null,
        error: payoutError?.message || 'Payout failed',
      }
    }
    if (!payout.success) {
      console.error(`[AutoRelease] Seller credit failed for order ${orderId}: ${payout.error}`)
    }

    // Completion comms: buyer receipt (autoReleased copy + Trustpilot
    // AFS BCC) + seller email + seller in-app. Callers have no usable
    // user session (cron) or a different one (admin), so use the
    // service-role client. Best-effort: a comms failure must not mark
    // the release as failed.
    try {
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
    } catch (commsError) {
      console.error(`[AutoRelease] Comms failed for order ${orderId} (non-fatal):`, commsError)
    }

    return {
      orderId,
      success: true,
      payout: payout.success
        ? payout.transferId
          ? 'transferred'
          : 'credited'
        : 'failed',
      ...(payout.error ? { payoutError: payout.error } : {}),
    }
  } catch (error: any) {
    console.error(`Error processing order ${orderId}:`, error)
    return { orderId, success: false, error: error.message }
  }
}
