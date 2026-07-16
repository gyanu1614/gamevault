/**
 * Auto-release pipeline for a single due order:
 * gate re-check → atomic ledger release (seller balance credited in the same
 * transaction) → completion comms.
 *
 * Shared by the auto-release cron (src/app/api/cron/auto-release-escrow) and
 * the admin manual trigger (src/app/api/admin/trigger-escrow-release). Both
 * act on the same get_orders_ready_for_auto_release list and MUST behave
 * identically — the admin route once called the legacy release_escrow RPC,
 * which only flipped order status: no seller credit, no state re-check, no
 * comms. Keep the pipeline here so the two paths cannot drift again.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { transition } from '@/lib/escrow/transition'

export interface AutoReleaseResult {
  orderId: string
  success: boolean
  /** True when the order was no longer held/delivered — someone else (buyer
   * confirm, dispute, overlapping run) owns the credit and comms. */
  skipped?: boolean
  /** 'credited' — the seller's internal ledger balance was credited in the
   * same transaction as the release (no external transfer exists anymore). */
  payout?: 'credited' | 'failed'
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

    // Release + seller credit in ONE atomic transaction via the SafeDrop
    // transition RPC (safedrop_transition AUTO_RELEASED): it locks the order
    // row, validates delivered → completed, posts the ledger journal
    // (escrow_held → platform take + seller_available) and flips
    // status/escrow_status/release_method together. This replaces the old
    // CAS + transferEscrowToSeller pair — the seller's payout is credited to
    // their internal seller balance, never an external Stripe transfer. The
    // row lock + idempotent journal keep the race semantics: exactly one
    // caller (this run vs buyer confirm vs an overlapping run) applies the
    // move and owns the comms; everyone else sees changed=false.
    let released
    try {
      released = await transition(orderId, 'AUTO_RELEASED', undefined, 'auto')
    } catch (releaseError: any) {
      console.error(`❌ Failed to release escrow for order ${orderId}:`, releaseError)
      return { orderId, success: false, error: releaseError?.message || 'Release failed' }
    }

    if (!released.changed) {
      // Lost the race: someone else moved the order off held/delivered
      // between the gate and the transition. They own the credit and comms.
      return { orderId, success: true, skipped: true }
    }

    console.log(`✅ Successfully released escrow for order ${orderId}`)

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
          message: `The protection window on order #${orderRef} closed — your $${(full.seller_payout ?? 0).toFixed(2)} is now in your seller balance. Withdraw any time from your wallet.`,
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
      payout: 'credited',
    }
  } catch (error: any) {
    console.error(`Error processing order ${orderId}:`, error)
    return { orderId, success: false, error: error.message }
  }
}
