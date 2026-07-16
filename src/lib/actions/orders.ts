'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logOrderAction, logUnauthorizedAccess, logFailure } from '@/lib/audit'
import { rateLimitCreateOrder } from '@/lib/utils/rate-limit'
import { buyerFee, commissionAmount, protectionWindowHours, round2, WARRANTY_ENABLED } from '@/lib/fees'
// Funds-flow cutover: order money moves go through the atomic ledger
// transition; buyer refunds land in their wallet as store credit.
import { transition } from '@/lib/escrow/transition'
import { refundToWallet } from '@/lib/wallet/wallet'

// P4.1 — import tier helpers from shared util (not from server action)
import { getTierFeeRate, TIER_WARRANTY_HOURS } from '@/lib/utils/safedrop-tiers'
import type { SafeDropTier } from '@/lib/utils/safedrop-tiers'

// P5.2 — Loyalty cashback
import { awardCashback } from '@/lib/actions/loyalty'
// P5.3 — Promo code usage
import { recordPromoUsage } from '@/lib/actions/promo'

interface CreateOrderData {
  paymentIntentId: string
  listingId: string
  quantity: number
  safedropTier?: SafeDropTier   // P4.1 — buyer-chosen tier (default: 'standard')
  isGuest?: boolean
  guestEmail?: string
  promoCodeId?: string                // P5.3 — promo code applied
  promoDiscount?: number              // P5.3 — discount amount (already applied to Stripe charge)
}

/**
 * Create a new order after successful payment
 */
export async function createOrder(data: CreateOrderData): Promise<{
  success: boolean
  orderId?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    // ✅ SECURITY: Derive buyerId from authenticated user only (never trust client)
    let buyerId: string

    if (data.isGuest && data.guestEmail) {
      // Handle guest checkout
      const guestResult = await handleGuestCheckout(data.guestEmail)
      if (!guestResult.success || !guestResult.userId) {
        return {
          success: false,
          error: guestResult.error || 'Failed to process guest checkout',
        }
      }
      buyerId = guestResult.userId
    } else {
      // Require authentication for non-guest checkout
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return {
          success: false,
          error: 'Authentication required',
        }
      }

      buyerId = user.id
    }

    // ✅ SECURITY: Rate limiting - 5 orders per minute per user
    if (!rateLimitCreateOrder(buyerId)) {
      return {
        success: false,
        error: 'Too many order attempts. Please wait 1 minute before trying again.',
      }
    }

    // Get listing with seller info
    const { data: listingRaw, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        seller:seller_id (
          id,
          seller_tier,
          username
        ),
        game:game_id ( slug ),
        category:category_id ( slug, metadata )
      `)
      .eq('id', data.listingId)
      .single() as any
    // Cast: Supabase narrow-select inference returns `never` against hand-written database.ts
    const listing = listingRaw as any

    if (listingError || !listing) {
      return {
        success: false,
        error: 'Listing not found',
      }
    }

    // ✅ SECURITY: Verify listing is active
    if (listing.status !== 'active') {
      return {
        success: false,
        error: 'Listing is not available for purchase',
      }
    }

    // ✅ SECURITY: Prevent buying own listing
    if (listing.seller_id === buyerId) {
      return {
        success: false,
        error: 'Cannot purchase your own listing',
      }
    }

    // ✅ SECURITY: Check stock availability
    if (!listing.is_unlimited && listing.quantity < data.quantity) {
      return {
        success: false,
        error: `Insufficient stock. Only ${listing.quantity} items available`,
      }
    }

    // P4.1 — Validate buyer-chosen tier (server-side, never trust client blindly)
    const validTiers: SafeDropTier[] = ['standard', 'enhanced', 'premium']
    const safedropTier: SafeDropTier =
      data.safedropTier && validTiers.includes(data.safedropTier)
        ? data.safedropTier
        : 'standard'

    // Calculate amounts — fee spec (lib/fees): buyer pays one Processing &
    // Buyer Protection fee; seller pays a per-category commission on the
    // item price only.
    const subtotal = round2(listing.price * data.quantity)
    const fee = buyerFee(subtotal)
    const feeInput = {
      categoryMetaType: listing.category?.metadata?.type as string | undefined,
      categorySlug: listing.category?.slug as string | undefined,
      gameSlug: listing.game?.slug as string | undefined,
    }
    const commission = commissionAmount(subtotal, feeInput)

    // P4.1 — Tier fee (recalculated server-side; warranty upsells are
    // feature-flagged OFF until payout caps are configured — spec §4)
    const tierFeeRate = WARRANTY_ENABLED ? getTierFeeRate(safedropTier) : 0
    const tierFee = round2(subtotal * (tierFeeRate / 100))

    // P5.3 — Promo discount (already deducted from charge; reflect in order total)
    const promoDiscount = Math.min(data.promoDiscount ?? 0, subtotal)
    const totalAmount   = round2(subtotal + fee.amount + tierFee - promoDiscount)
    const sellerPayout  = round2(subtotal - commission) // seller unaffected by promo

    // P4.1 — Protection until: 30 days; warranty_expires_at based on tier
    const now = new Date()
    const protectionUntil = new Date(now)
    protectionUntil.setDate(protectionUntil.getDate() + 30)

    const warrantyHours = TIER_WARRANTY_HOURS[safedropTier]
    const warrantyExpiresAt = new Date(now.getTime() + warrantyHours * 60 * 60 * 1000)

    // Delivery evidence required for Enhanced+ (manual/screenshot proof) or large orders
    const deliveryEvidenceRequired = safedropTier !== 'standard' || subtotal >= 100

    // Insert order
    const { data: orderRaw, error: orderError } = await (supabase
      .from('orders')
      .insert as any)({
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        listing_id: data.listingId,
        quantity: data.quantity,
        unit_price: listing.price,
        subtotal: subtotal,
        platform_fee_rate: fee.marketplacePct,
        payment_processing_fee_rate: fee.processingPct,
        platform_fee: fee.marketplaceAmount,
        payment_processing_fee: fee.processingAmount,
        total_amount: totalAmount,
        seller_payout: sellerPayout,
        stripe_payment_intent_id: data.paymentIntentId,
        status: 'paid',
        escrow_status: 'held',
        delivering_at: now.toISOString(), // Timer starts immediately on payment — seller cannot delay the clock
        protection_until: protectionUntil.toISOString(),
        auto_release_at: null,
        delivery_evidence_required: deliveryEvidenceRequired,
        vaultshield_level:          safedropTier,
        vaultshield_tier_fee_rate:  tierFeeRate,
        vaultshield_tier_fee:       tierFee,
        warranty_expires_at:        warrantyExpiresAt.toISOString(),
        is_guest_order:             data.isGuest || false,
        // P5.3 — promo code
        promo_code_id:  data.promoCodeId  ?? null,
        promo_discount: promoDiscount,
      } as any)
      .select()
      .single()
    // Cast: Supabase narrow-select inference returns `never` against hand-written database.ts
    const order = orderRaw as any

    if (orderError) {
      console.error('Error creating order:', orderError)
      // ✅ AUDIT: Log order creation failure
      await logFailure('order_created', 'orders', orderError.message, data.listingId)
      // V21/P3.g — Surface the actual DB error in dev so missing columns
      // or RLS issues are diagnosable without grepping server logs. The
      // generic message stays as the fallback for production.
      const isDev = process.env.NODE_ENV !== 'production'
      return {
        success: false,
        error: isDev
          ? `Failed to create order: ${orderError.message ?? 'unknown DB error'}`
          : 'Failed to create order',
      }
    }

    // ✅ AUDIT: Log successful order creation
    await logOrderAction('created', order.id, undefined, {
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      listing_id: order.listing_id,
      total_amount: order.total_amount,
      vaultshield_level: order.vaultshield_level,
    })

    // P5.3 — Record promo usage (fire-and-forget)
    if (data.promoCodeId && promoDiscount > 0) {
      recordPromoUsage({
        promoCodeId:    data.promoCodeId,
        orderId:        order.id,
        discountAmount: promoDiscount,
        userId:         buyerId,
      }).catch(() => {})
    }

    // Handle instant delivery if applicable
    if (listing.delivery_method === 'instant') {
      try {
        console.log('[CreateOrder] Triggering instant delivery for order:', order.id)
        const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')
        const deliveryResult = await deliverCodeToBuyer(order.id, buyerId)

        if (deliveryResult.success && deliveryResult.code) {
          console.log('[CreateOrder] ✅ Instant delivery completed, marking order as completed')

          // Mark order as completed immediately for instant delivery
          // This triggers the stock decrement and finalizes the order
          await (supabase
            .from('orders')
            .update as any)({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', order.id)

          console.log('[CreateOrder] Order marked as completed')
        } else {
          console.error('[CreateOrder] ❌ Instant delivery failed:', deliveryResult.error)
          // Non-fatal - order still created successfully
        }
      } catch (deliveryError) {
        console.error('[CreateOrder] Instant delivery error:', deliveryError)
        // Non-fatal - order still valid, seller can deliver manually
      }
    }

    // Create conversation between buyer and seller for this order
    try {
      const { error: conversationError } = await (supabase
        .from('conversations')
        .insert as any)({
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          listing_id: data.listingId,
          order_id: order.id,
          last_message_at: new Date().toISOString(),
        })

      if (conversationError) {
        console.error('Error creating conversation:', conversationError)
        // Don't fail the order if conversation creation fails
      } else {
        // Send automatic welcome message
        await (supabase
          .from('messages')
          .insert as any)({
            conversation_id: (await supabase
              .from('conversations')
              .select('id')
              .eq('order_id', order.id)
              .single() as any
            ).data?.id,
            sender_id: listing.seller_id,
            content: `Hi! Thank you for your purchase of "${listing.title}". I'll deliver your order shortly. Feel free to message me if you have any questions!`,
            is_read: false,
          })
      }
    } catch (error) {
      console.error('Error setting up order conversation:', error)
      // Don't fail the order
    }

    // Note: Stock quantity is decremented by the DB trigger `on_order_completed`
    // which fires when order status → 'completed'. This prevents double-deduction.
    // We do NOT decrement here at order creation to avoid counting the same purchase twice.

    // Send welcome email for guest users
    if (data.isGuest && data.guestEmail) {
      const guestEmail = data.guestEmail
      await (async () => {
        const { sendGuestWelcomeEmail } = await import('@/lib/email')
        await sendGuestWelcomeEmail({
          to: guestEmail,
          orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
          orderId: order.id,
        })
      })().catch((err) => console.error('[CreateOrder] Guest welcome email failed:', err))
    }

    // TODO: Send order confirmation emails
    // await sendOrderConfirmationEmail(buyerId, order.id)
    // await sendNewOrderEmail(listing.seller_id, order.id)

    // Workstream E — DO NOT re-add a pre-payment seller notification here.
    // createOrder is legacy/dead (no live callers — the live path is
    // createCheckout, which mints a 'pending' order confirmed only by the
    // CoinGate webhook). The seller's 'new_order' bell notification is now
    // emitted exactly once, on the webhook's APPLIED CHARGE_CONFIRMED
    // transition (src/lib/payments/notify.ts). Notifying the seller at order
    // creation — before payment — would surface an order they're gated out of
    // (pending orders are hidden from sellers) and would double up with the
    // webhook notification. Kept intentionally silent.

    revalidatePath('/orders')
    // V21/P7.d — The previous `/marketplace/{game_id}/{category_id}`
    // path used UUIDs in a slug-routed URL space — it never matched
    // a real route. Listing detail revalidates its own page on next
    // request anyway; revalidating `/` covers the public marketing
    // surface (homepage features popular listings).
    revalidatePath('/')

    return {
      success: true,
      orderId: order.id,
    }
  } catch (error: any) {
    console.error('Unexpected error creating order:', error)
    return {
      success: false,
      error: error.message || 'Failed to create order',
    }
  }
}

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
          category_id
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
      .select('*, listing:listings!orders_listing_id_fkey( title, game:game_id ( slug ), category:category_id ( slug, metadata ) )')
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
      categoryMetaType: order.listing?.category?.metadata?.type,
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
        message: `Your order #${orderRef} has been marked as delivered. Please review it and confirm delivery within your protection window.`,
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

    // Fetch order — must be buyer and status must be 'paid'
    const { data: orderRaw, error: fetchError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, listing_id, status, escrow_status, currency, total_amount, order_number')
      .eq('id', orderId)
      .single() as any
    const order = orderRaw as any

    if (fetchError || !order) return { success: false, error: 'Order not found' }
    if (order.buyer_id !== user.id) {
      await logUnauthorizedAccess(user.id, 'cancel_order', orderId)
      return { success: false, error: 'Unauthorized' }
    }
    if (order.status !== 'paid') {
      return { success: false, error: 'Order can only be cancelled before delivery starts' }
    }

    // Cancel atomically: locks the order, validates paid → cancelled, moves
    // the held escrow to refunds and flips status in one transaction.
    const escrowWasHeld = order.escrow_status === 'held'
    let cancelResult
    try {
      cancelResult = await transition(orderId, 'CANCELLED')
    } catch (transitionError: any) {
      console.error('Failed to cancel order:', transitionError)
      return { success: false, error: 'Cancellation failed — please contact support' }
    }
    if (!cancelResult.changed) {
      // Already cancelled (double-click / replay) — nothing more to do.
      return { success: true }
    }

    // Credit the buyer's wallet with the full amount as store credit.
    // Idempotent per order ('wallet_refund:<orderId>'), so a replay can't
    // double-credit. Only when money was actually held for this order.
    let refundIssued = false
    if (escrowWasHeld && (order.total_amount ?? 0) > 0) {
      try {
        await refundToWallet({
          userId: order.buyer_id,
          amountMinor: BigInt(Math.round((order.total_amount ?? 0) * 100)),
          currency: (order.currency || 'EUR').toUpperCase(),
          orderId,
        })
        refundIssued = true
      } catch (walletError: any) {
        // The order IS cancelled; the wallet credit can be re-run (idempotent
        // key). Surface loudly but don't undo the cancellation.
        console.error('[Cancel] CRITICAL: wallet refund credit failed:', walletError?.message)
      }
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
            ? `Order #${orderRef} was cancelled — $${(order.total_amount ?? 0).toFixed(2)} was refunded to your DropMarket wallet as store credit. Spend it instantly or withdraw it.`
            : `Order #${orderRef} was cancelled — our team is arranging your refund and will confirm once it's issued.`,
          link: refundIssued ? '/account/wallet' : `/account/orders/${orderId}`,
        }),
        createNotification({
          userId: order.seller_id,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `The buyer cancelled order #${orderRef} before delivery started.`,
          link: `/account/orders/${orderId}`,
        }),
      ])
      if (buyer?.email) {
        const { sendOrderRefundedEmail } = await import('@/lib/email')
        await sendOrderRefundedEmail({
          to: buyer.email,
          name: buyer.full_name || buyer.username || 'Gamer',
          orderNumber: orderRef,
          listingTitle: cancelledListing?.title || 'your item',
          amount: order.total_amount ?? 0,
          destination: 'your DropMarket wallet',
          pending: !refundIssued,
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
        message: `Buyer confirmed delivery on order #${orderRef} — $${(order.seller_payout ?? 0).toFixed(2)} was added to your seller balance. Withdraw any time from your wallet.`,
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
      awardCashback({
        userId:   user.id,
        orderId:  orderId,
        subtotal: order.subtotal ?? 0,
      }).catch(() => {})
    }

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

    // Update order to disputed status
    const { error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'disputed',
        escrow_status: 'frozen',
        disputed_at: new Date().toISOString(),
        dispute_reason: reason,
      })
      .eq('id', orderId)

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

/**
 * Handle guest checkout - create account if needed
 */
export async function handleGuestCheckout(email: string): Promise<{
  success: boolean
  userId?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Check if user already exists by email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle() as any

    if (existingProfile) {
      return {
        success: true,
        userId: existingProfile.id,
      }
    }

    // Create guest user account
    // Generate a random password (guest won't know it, they'll reset via email)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()

    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: randomPassword,
      options: {
        data: {
          is_guest: true,
          created_via: 'guest_checkout',
        },
      },
    })

    if (signUpError || !authData.user) {
      console.error('Error creating guest auth user:', signUpError)
      return {
        success: false,
        error: 'Failed to create guest account. Please try again or sign up manually.',
      }
    }

    const userId = authData.user.id

    // Create profile (should be auto-created by trigger, but ensure it exists)
    const { error: profileError } = await (supabase
      .from('profiles')
      .upsert as any)({
        id: userId,
        email,
        username: `guest_${userId.substring(0, 8)}`,
        is_guest: true,
        created_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error creating guest profile:', profileError)
      // Don't fail here - profile might exist from trigger
    }

    // Send the account-claim link: the account was created with a random
    // password the guest never sees, so this password-setup email is how
    // they claim it. Never fail checkout if the email fails.
    await (async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      })
      if (resetError) throw resetError
    })().catch((err) => console.error('[GuestCheckout] Account-claim email failed:', err))

    console.log(`Guest account created for ${email} with ID ${userId}`)

    return {
      success: true,
      userId,
    }
  } catch (error: any) {
    console.error('Error handling guest checkout:', error)
    return {
      success: false,
      error: error.message || 'Failed to process guest checkout',
    }
  }
}
