'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logOrderAction, logUnauthorizedAccess } from '@/lib/audit'
import { protectionWindowHours } from '@/lib/fees'
// Funds-flow cutover: order money moves go through the atomic ledger
// transition; buyer refunds land in their wallet as store credit.
import { transition } from '@/lib/escrow/transition'
import { cancelOrderReturnWallet } from '@/lib/wallet/order-money'

// P5.2 — Loyalty cashback
import { awardCashback } from '@/lib/loyalty/award'
import { recordReferralCommission } from '@/lib/referral/commission'

/**
 * Get order details
 */
export async function getOrder(orderId: string): Promise<{
  success: boolean
  order?: any
  error?: string
}> {
  try {
    const supabase = await createClient()

    // ✅ SECURITY: Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id (
          id,
          username,
          email,
          avatar_url
        ),
        seller:seller_id (
          id,
          username,
          email,
          avatar_url,
          seller_tier,
          shop_name
        ),
        listing:listing_id (
          id,
          title,
          description,
          images,
          delivery_method,
          delivery_time,
          price,
          platform,
          region,
          game_id,
          game_category_id
        )
      `)
      .eq('id', orderId)
      .single() as any

    if (error) {
      return {
        success: false,
        error: 'Order not found',
      }
    }

    // ✅ SECURITY: Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    // ✅ SECURITY: Verify user is buyer OR seller OR admin
    if (order.buyer_id !== user.id && order.seller_id !== user.id && !isAdmin) {
      // ✅ AUDIT: Log unauthorized access attempt
      await logUnauthorizedAccess('view_order', 'orders', orderId)
      return {
        success: false,
        error: 'Unauthorized: not your order',
      }
    }

    // ✅ SECURITY: Strip sensitive fields based on role
    if (!isAdmin) {
      // Remove ALL emails for privacy (both buyer and seller)
      if (order.buyer) {
        delete order.buyer.email
      }
      if (order.seller) {
        delete order.seller.email
      }
    }
    // Admins can see all fields (no deletion)

    return {
      success: true,
      order,
    }
  } catch (error: any) {
    console.error('Error fetching order:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch order',
    }
  }
}

/**
 * Start delivering order (seller action)
 * Changes status from 'paid' to 'delivering'
 */
export async function startDelivering(
  orderId: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('seller_id', user.id) // Ensure seller owns this order
      .single() as any

    if (orderError || !order) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    // Verify order is in 'paid' status
    if (order.status !== 'paid') {
      return {
        success: false,
        error: 'Order must be in paid status to start delivery',
      }
    }

    // Update order to delivering status
    const { error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'delivering',
        delivering_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update order status',
      }
    }

    // Revalidate both seller and buyer paths for real-time updates
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath(`/account/orders/${orderId}`)

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error starting delivery:', error)
    return {
      success: false,
      error: error.message || 'Failed to start delivery',
    }
  }
}

/**
 * V21/P4.e — Atomically flip an order from 'paid' → 'delivering' when
 * the seller sends activity (typically their first chat message).
 *
 * Designed to be safe to call on every seller message:
 *  - The UPDATE is guarded by `status = 'paid'` AND `seller_id = auth.uid()`,
 *    so the row only flips on the FIRST eligible call. Subsequent calls
 *    affect 0 rows and return success.
 *  - No client trust: the auth.uid() match is enforced by RLS + the
 *    explicit eq() clause, so a malicious buyer can't fire it.
 *  - Idempotent: safe to call from optimistic UI hooks without dedup.
 *  - Single round-trip: one SQL statement, no read-modify-write.
 *
 * Returns silently — this is a side-effect call, not user-facing.
 * Caller should NOT block UI on it.
 *
 * Future hardening (tracked as V21/F2): move to a Postgres trigger on
 * messages INSERT so we don't depend on the client to make the call.
 */
export async function notifySellerActivity(orderId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // The update is atomic + race-safe via the WHERE clause. If two
    // messages land in the same tick, only the first matching row
    // flips; the second is a 0-row no-op.
    await (supabase
      .from('orders')
      .update as any)({
        status: 'delivering',
        delivering_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .eq('status', 'paid')

    revalidatePath(`/account/orders/${orderId}`)
  } catch (e) {
    // Fire-and-forget. A failure here doesn't block the message send
    // — the user already saw their message land in the chat.
    console.error('[notifySellerActivity]', e)
  }
}

/**
 * Mark order as delivered (seller action)
 */
export async function markOrderAsDelivered(
  orderId: string,
  deliveryNotes?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, listing:listings!orders_listing_id_fkey( title, game:game_id ( slug ), category:game_categories!listings_game_category_id_fkey ( slug, type ) )')
      .eq('id', orderId)
      .eq('seller_id', user.id) // Ensure seller owns this order
      .single() as any

    if (orderError || !order) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    // Idempotent: re-marking a delivered/finished order must not restart the
    // protection window or re-send the buyer email.
    if (['delivered', 'completed', 'refunded', 'cancelled', 'disputed'].includes(order.status)) {
      return { success: true }
    }

    // Update order. The per-category protection window (fee spec §1) sets
    // auto_release_at; the DB trigger only falls back to 48h when the app
    // doesn't supply one (see update-fee-structure.sql).
    const windowHours = protectionWindowHours({
      categoryMetaType: order.listing?.category?.type,
      categorySlug: order.listing?.category?.slug,
      gameSlug: order.listing?.game?.slug,
    })
    const { data: updatedRows, error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        auto_release_at: new Date(Date.now() + windowHours * 3_600_000).toISOString(),
      })
      .eq('id', orderId)
      .in('status', ['paid', 'delivering']) // race guard: only one transition wins
      .select('id')

    if (updateError) {
      console.error('Database error updating order:', updateError)
      return {
        success: false,
        error: updateError.message || 'Failed to update order',
      }
    }

    // Lost the race (another request already transitioned it) — no comms.
    if (!updatedRows || updatedRows.length === 0) {
      return { success: true }
    }

    // Send navbar notification to buyer
    try {
      const { createNotification } = await import('@/lib/utils/notifications')
      const orderRef = (order as any).order_number || orderId.slice(0, 8).toUpperCase()
      await createNotification({
        userId: (order as any).buyer_id,
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `#${orderRef} — review it and confirm receipt.`,
        link: `/account/orders/${orderId}`,
      })
    } catch (notifError) {
      console.error('[Delivered] Failed to create buyer notification:', notifError)
      // Non-fatal
    }

    // Email the buyer to confirm receipt — this transition starts the
    // protection-window clock, and a logged-out buyer would otherwise
    // never know (fire-and-forget, non-blocking).
    await (async () => {
      // Service client: RLS hides the buyer's profile from the seller session.
      const service = createServiceRoleClient()
      const { data: buyer } = await service
        .from('profiles')
        .select('email, username, full_name')
        .eq('id', (order as any).buyer_id)
        .single() as any
      if (buyer?.email) {
        const { sendOrderDeliveredEmail } = await import('@/lib/email')
        await sendOrderDeliveredEmail({
          to: buyer.email,
          name: buyer.full_name || buyer.username || 'Gamer',
          orderId,
          orderNumber: (order as any).order_number || orderId.slice(0, 8).toUpperCase(),
          listingTitle: (order as any).listing?.title || 'your item',
          windowHours,
          confirmBy: new Date(Date.now() + windowHours * 3_600_000).toISOString(),
        })
      }
    })().catch((err) => console.error('[Delivered] Buyer email failed:', err))

    // Revalidate both seller and buyer paths for real-time updates
    revalidatePath(`/account/orders/${orderId}`)

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error marking order as delivered:', error)
    return {
      success: false,
      error: error.message || 'Failed to mark order as delivered',
    }
  }
}

/**
 * Cancel an order (buyer action — only allowed when status is 'paid').
 * Money: the held escrow moves to refunds in the ledger and the FULL amount
 * is credited to the buyer's wallet as store credit, instantly (Refund &
 * Dispute Policy: store-credit refunds are 100%). No external refund rail.
 */
export async function cancelOrder(orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Fetch order — must be the buyer; cancellable while pending (unpaid) or
    // paid-but-undelivered. The RPC re-checks the status under the row lock.
    const { data: orderRaw, error: fetchError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, listing_id, status, escrow_status, currency, total_amount, order_number')
      .eq('id', orderId)
      .single() as any
    const order = orderRaw as any

    if (fetchError || !order) return { success: false, error: 'Order not found' }
    if (order.buyer_id !== user.id) {
      await logUnauthorizedAccess('cancel_order', 'orders', orderId)
      return { success: false, error: 'Unauthorized' }
    }
    if (order.status !== 'paid' && order.status !== 'pending') {
      return { success: false, error: 'Order can only be cancelled before delivery starts' }
    }
    const wasUnpaid = order.status === 'pending'

    // PAY-008: ONE RPC (DB-015 seam) — locks the order, validates the move,
    // flips status and returns the buyer's money in the same transaction:
    //   pending → CANCELLED + exact mirror of the checkout wallet hold;
    //   paid    → CANCELLED (escrow_held → refunds) + full total credited to
    //             the wallet as store credit (allowPaid: the buyer's explicit
    //             cancel is the one caller allowed past 'pending').
    // The old TS composition (bare transition, then a separate refundToWallet
    // whose failure was logged as CRITICAL and ignored) could leave a
    // cancelled order with the buyer's money stranded.
    let cancelResult
    try {
      // Round B: a pending order's live charge is closed as 'void' and
      // queued in provider_cancel_outbox inside the same RPC transaction.
      cancelResult = await cancelOrderReturnWallet(orderId, undefined, { allowPaid: true, closeAttemptAs: 'void' })
    } catch (cancelError: any) {
      console.error('Failed to cancel order:', cancelError)
      return { success: false, error: 'Cancellation failed — please contact support' }
    }
    if (cancelResult.refused) {
      // Raced past 'paid' (delivery started) between our read and the lock.
      return { success: false, error: 'Order can only be cancelled before delivery starts' }
    }
    if (!cancelResult.changed) {
      // Already cancelled (double-click / replay) — nothing more to do.
      return { success: true }
    }
    // Money is back in the wallet exactly when the RPC posted the wallet leg
    // (a pending order with no wallet hold has nothing to return).
    const refundIssued = cancelResult.walletTxnId !== null
    const refundAmount = wasUnpaid
      ? Number(await heldMinorFor(supabase, orderId)) / 100
      : (order.total_amount ?? 0)

    if (wasUnpaid) {
      // The "Order Incomplete" navbar nudge for this order is moot now —
      // webhook cancels clear it in notify.ts, buyer-initiated cancels here.
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', 'order_incomplete')
        .like('link', `%${orderId}%`)

      // The charge (a voucher, an invoice) stays payable at the provider
      // until voided: drain the outbox row the RPC just wrote. Best-effort —
      // the reconcile cron retries with backoff; a payment that still lands
      // is credited to the buyer's wallet by the late-payment path.
      const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
      await drainCancelOutboxForOrder(orderId)
    }

    // Best-effort timestamp for the audit trail (status already flipped).
    await (supabase
      .from('orders')
      .update as any)({ cancelled_at: new Date().toISOString() })
      .eq('id', orderId)

    await logOrderAction('cancelled', orderId, user.id, {
      reason: 'buyer_cancelled',
      refund_issued: refundIssued,
      refund_destination: 'wallet',
    })

    // Refund comms: buyer email + both parties in-app. HONESTY GATE: only
    // say the money is in the wallet when the wallet credit actually posted;
    // otherwise the copy must say "being arranged", never "processed".
    await (async () => {
      const orderRef = order.order_number || orderId.slice(0, 8).toUpperCase()
      const service = createServiceRoleClient()
      const [{ data: buyer }, { data: cancelledListing }] = await Promise.all([
        service
          .from('profiles')
          .select('email, username, full_name')
          .eq('id', order.buyer_id)
          .single() as any,
        service
          .from('listings')
          .select('title')
          .eq('id', (order as any).listing_id)
          .single() as any,
      ])
      const { createNotification } = await import('@/lib/utils/notifications')
      await Promise.allSettled([
        createNotification({
          userId: order.buyer_id,
          type: 'order_refunded',
          title: refundIssued ? 'Money In Your Wallet' : 'Order Cancelled',
          message: refundIssued
            ? `Order #${orderRef} was cancelled — $${refundAmount.toFixed(2)} was refunded to your DropMarket wallet as store credit. Spend it instantly or withdraw it.`
            : `Order #${orderRef} was cancelled — nothing had been charged.`,
          link: refundIssued ? '/account/wallet' : `/account/orders/${orderId}`,
        }),
        createNotification({
          userId: order.seller_id,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `#${orderRef} — cancelled by the buyer before delivery.`,
          link: `/account/orders/${orderId}`,
        }),
      ])
      if (buyer?.email && refundIssued) {
        const { sendOrderRefundedEmail } = await import('@/lib/email')
        await sendOrderRefundedEmail({
          to: buyer.email,
          name: buyer.full_name || buyer.username || 'Gamer',
          orderNumber: orderRef,
          listingTitle: cancelledListing?.title || 'your item',
          amount: refundAmount,
          destination: 'your DropMarket wallet',
          pending: false,
        })
      }
    })().catch((err) => console.error('[Cancel] Refund comms failed:', err))

    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/account/orders')

    return { success: true }
  } catch (error: any) {
    console.error('Error cancelling order:', error)
    return { success: false, error: error.message || 'Failed to cancel order' }
  }
}

/** Wallet credit (minor units) that was held for an order at checkout — comms copy only. */
async function heldMinorFor(supabase: any, orderId: string): Promise<bigint> {
  const { data } = await (supabase.rpc as any)('checkout_wallet_hold_minor', { p_order_id: orderId })
  return BigInt(data ?? 0)
}

/**
 * Confirm order receipt (buyer action)
 */
export async function confirmOrderReceipt(orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id) // Ensure buyer owns this order
      .single() as any

    if (orderError || !order) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    // Idempotent: a double-click / replayed action must not re-run the
    // payout attempt or re-send completion comms.
    if (order.status === 'completed') {
      return { success: true }
    }

    // An UNPAID order must never be confirmable — without this, a buyer
    // could walk a pending order straight to 'completed' (found when the
    // dead PUBLIC_API_URL fallback left every order stuck at 'pending'
    // yet the test flow still "completed" one).
    if (order.status === 'pending' || order.status === 'cancelled' || order.status === 'refunded') {
      return { success: false, error: 'This order has not been paid yet' }
    }

    // A disputed order's money is frozen — confirming receipt must not
    // release it while an admin is reviewing. (The transition map allows
    // disputed → completed for ADMIN resolutions; guard the buyer path.)
    if (order.status === 'disputed') {
      return { success: false, error: 'This order is under dispute review' }
    }

    // If order is not yet delivered, mark as delivered first
    // This allows buyer to confirm receipt even if seller hasn't marked as delivered
    const now = new Date().toISOString()

    if (order.status !== 'delivered') {
      // First transition to delivered. Guarded on escrow_status = 'held' so a
      // replay racing the CAS below can't drag an already-completed (released)
      // or disputed (frozen) order's status back to 'delivered'. Zero rows
      // matched is not an error — the CAS below decides who owns completion.
      const { error: deliveredError } = await (supabase
        .from('orders')
        .update as any)({
          status: 'delivered',
          delivered_at: now,
        })
        .eq('id', orderId)
        .eq('escrow_status', 'held')

      if (deliveredError) {
        console.error('Error marking order as delivered:', deliveredError)
        return {
          success: false,
          error: deliveredError.message || 'Failed to mark order as delivered',
        }
      }
    }

    // Complete atomically through the SafeDrop transition RPC: it locks the
    // order row, validates delivered → completed, posts the ledger journal
    // (escrow_held → platform take + seller_available — the seller's payout
    // is credited to their internal seller balance, NOT a Stripe transfer)
    // and flips status/escrow_status in ONE DB transaction. The row lock +
    // idempotent journal replace the old CAS + transferEscrowToSeller pair:
    // exactly one caller (buyer confirm vs auto-release cron) applies the
    // move; the loser sees changed=false.
    let release
    try {
      release = await transition(orderId, 'BUYER_CONFIRMED', undefined, 'buyer_confirmed')
    } catch (transitionError: any) {
      console.error('Database error completing order:', transitionError)
      return {
        success: false,
        error: transitionError?.message || 'Failed to complete order',
      }
    }

    if (!release.changed) {
      // Lost the race: another path (auto-release cron, concurrent confirm)
      // already completed the order. The winner owns the seller credit and
      // completion comms — doing them here would double-send.
      return { success: true }
    }

    // Buyer completion receipt (fire-and-forget, non-blocking). When
    // TRUSTPILOT_BCC_EMAIL is set the email BCCs Trustpilot's Automatic
    // Feedback Service, which then sends the buyer a verified-review
    // invitation ~7 days later — this replaces the cron's fallback review
    // email (sendTrustpilotInvitation skips itself in BCC mode).
    await (async () => {
      // Service client: RLS hides sold/paused listings from non-owners.
      const service = createServiceRoleClient()
      const [{ data: buyer }, { data: completedListing }] = await Promise.all([
        service
          .from('profiles')
          .select('email, username, full_name')
          .eq('id', user.id)
          .single() as any,
        service
          .from('listings')
          .select('title')
          .eq('id', order.listing_id)
          .single() as any,
      ])
      if (buyer?.email) {
        const { sendOrderCompletionEmail } = await import('@/lib/email')
        await sendOrderCompletionEmail({
          to: buyer.email,
          name: buyer.full_name || buyer.username || 'Gamer',
          orderId,
          orderNumber: order.order_number || orderId.slice(0, 8).toUpperCase(),
          listingTitle: completedListing?.title || 'your item',
          totalPaid: order.total_amount ?? 0,
        })
      }
    })().catch((err) => console.error('[Orders] Completion email failed:', err))

    // Tell the seller their sale is final (email + in-app, fire-and-forget).
    await (async () => {
      const orderRef = order.order_number || orderId.slice(0, 8).toUpperCase()
      // Service client: RLS hides the seller's profile from the buyer session.
      const service = createServiceRoleClient()
      const [{ data: seller }, { data: soldListing }] = await Promise.all([
        service
          .from('profiles')
          .select('email, username, full_name')
          .eq('id', order.seller_id)
          .single() as any,
        service
          .from('listings')
          .select('title')
          .eq('id', order.listing_id)
          .single() as any,
      ])
      const { createNotification } = await import('@/lib/utils/notifications')
      await createNotification({
        userId: order.seller_id,
        type: 'order_completed',
        title: 'Order Completed',
        message: `$${(order.seller_payout ?? 0).toFixed(2)} added to your balance · #${orderRef}`,
        link: `/account/orders/${orderId}`,
      })
      if (seller?.email) {
        const { sendOrderCompletedSellerEmail } = await import('@/lib/email')
        await sendOrderCompletedSellerEmail({
          to: seller.email,
          name: seller.full_name || seller.username || 'Gamer',
          orderId,
          orderNumber: orderRef,
          listingTitle: soldListing?.title || 'your item',
          payout: order.seller_payout ?? 0,
        })
      }
    })().catch((err) => console.error('[Orders] Seller completion comms failed:', err))

    // P5.2 — Award cashback to buyer (fire-and-forget, non-blocking)
    // Guest orders don't get loyalty credits (no persistent account)
    if (!order.is_guest_order) {
      // Only the id crosses the seam — awardCashback re-fetches and verifies
      // the order itself (it mints spendable credit; no trusted payload).
      awardCashback({ orderId }).catch(() => {})
    }

    // DB-017 — the referrer's commission (10% of the platform fee, read from
    // the order row) was never recorded: recordReferralCommission had no
    // caller. Fire-and-forget like cashback; once per order (partial unique
    // index referral_earnings_one_commission_per_order).
    recordReferralCommission(orderId).catch((err) =>
      console.error('[Orders] referral commission failed (retryable):', err)
    )

    // Revalidate both seller and buyer paths for real-time updates
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/account/loyalty')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error confirming order receipt:', error)
    return {
      success: false,
      error: error.message || 'Failed to confirm order receipt',
    }
  }
}

/**
 * Open a dispute for an order
 */
export async function openDispute(
  orderId: string,
  category: string,
  reason: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    // Map UI-friendly category to database enum value
    const categoryMap: Record<string, string> = {
      'Item not as described': 'not_as_described',
      'Did not receive order': 'item_not_received',
      'Wrong item received': 'wrong_item',
      'Account credentials invalid': 'account_issue',
      'Other': 'other',
    }
    const dbCategory = categoryMap[category] || 'other'

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id) // Ensure buyer owns this order
      .single() as any

    if (orderError || !order) {
      return {
        success: false,
        error: 'Order not found or you do not have permission',
      }
    }

    // Check if order can be disputed
    if (order.status === 'completed' || order.status === 'refunded') {
      return {
        success: false,
        error: 'This order cannot be disputed',
      }
    }

    // Update order to disputed status. AUTH-002: escrow_status is
    // trigger-protected; the buyer session cannot set it through PostgREST, so
    // write via the service role — scoped to the order AND the buyer verified
    // by the RLS read above.
    const { error: updateError } = await (createServiceRoleClient()
      .from('orders')
      .update as any)({
        status: 'disputed',
        escrow_status: 'frozen',
        disputed_at: new Date().toISOString(),
        dispute_reason: reason,
      })
      .eq('id', orderId)
      .eq('buyer_id', user.id)

    if (updateError) {
      console.error('Database error opening dispute:', updateError)
      return {
        success: false,
        error: updateError.message || 'Failed to open dispute',
      }
    }

    // Create dispute record in disputes table
    const disputeTitle = `Order #${order.order_number || orderId.slice(0, 8)} - ${category}`

    const { error: disputeError } = await (supabase
      .from('disputes')
      .insert as any)({
        transaction_id: orderId,
        order_reference: order.order_number || orderId.slice(0, 8),
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        reason: dbCategory as any,
        title: disputeTitle,
        description: reason,
        disputed_amount: order.total_amount,
        status: 'open',
        priority: 'normal',
      })

    if (disputeError) {
      console.error('Error creating dispute record:', disputeError)
      // Don't fail the whole operation if dispute record creation fails
      // The order is already marked as disputed
    }

    // Send dispute notification message to order conversation
    try {
      // Get conversation for this order
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('order_id', orderId)
        .single() as any

      if (conversation) {
        // Send system notification about dispute
        // Using special UUID for system messages: all zeros
        await (supabase.from('messages').insert as any)({
          conversation_id: conversation.id,
          sender_id: '00000000-0000-0000-0000-000000000000', // System sender ID
          content: JSON.stringify({
            type: 'dispute_opened',
            category,
            reason,
          }),
          is_read: false,
        })

        console.log('[Dispute] System notification sent to conversation')
      }
    } catch (error) {
      console.error('[Dispute] Failed to send conversation message:', error)
      // Non-fatal - dispute is already created
    }

    // Create navbar notifications for both buyer and seller
    try {
      const { createDisputeNotifications } = await import('@/lib/utils/notifications')
      await createDisputeNotifications({
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        orderId,
        orderNumber: order.order_number,
      })
      console.log('[Dispute] Navbar notifications created for buyer and seller')
    } catch (error) {
      console.error('[Dispute] Failed to create navbar notifications:', error)
      // Non-fatal - dispute is already created
    }

    // Notify admin team
    try {
      const { notifyAdmins } = await import('@/lib/utils/notifications')
      await notifyAdmins({
        permission: 'disputes.view',
        type: 'new_dispute',
        title: 'New Dispute Opened',
        message: `Order #${order.order_number || orderId.slice(0, 8)} - ${category}`,
        link: `/admin/disputes`,
      })
      console.log('[Dispute] Admin notifications sent')
    } catch (error) {
      console.error('[Dispute] Failed to notify admins:', error)
      // Non-fatal - dispute is already created
    }

    // Email both parties — only when the dispute record actually persisted,
    // so nobody is promised a review of a dispute that doesn't exist.
    if (!disputeError) {
      await (async () => {
        // Service client: RLS hides the counterparty's profile row.
        const service = createServiceRoleClient()
        const { data: parties } = await service
          .from('profiles')
          .select('id, email, username, full_name')
          .in('id', [order.buyer_id, order.seller_id]) as any
        const party = (id: string) => parties?.find((p: any) => p.id === id)
        const disputeRef = order.order_number || orderId.slice(0, 8).toUpperCase()
        const { sendDisputeOpenedEmail } = await import('@/lib/email')
        const buyer = party(order.buyer_id)
        const seller = party(order.seller_id)
        await Promise.allSettled([
          buyer?.email
            ? sendDisputeOpenedEmail({
                to: buyer.email,
                name: buyer.full_name || buyer.username || 'Gamer',
                disputeId: disputeRef,
                orderId,
                role: 'buyer',
                reason,
              })
            : Promise.resolve(),
          seller?.email
            ? sendDisputeOpenedEmail({
                to: seller.email,
                name: seller.full_name || seller.username || 'Gamer',
                disputeId: disputeRef,
                orderId,
                role: 'seller',
                reason,
              })
            : Promise.resolve(),
        ])
      })().catch((err) => console.error('[Dispute] Party emails failed:', err))
    }

    // Revalidate all relevant paths for real-time updates
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/admin/disputes')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error opening dispute:', error)
    return {
      success: false,
      error: error.message || 'Failed to open dispute',
    }
  }
}
