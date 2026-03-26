'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logOrderAction, logUnauthorizedAccess, logFailure } from '@/lib/audit'
import { rateLimitCreateOrder } from '@/lib/utils/rate-limit'
import { getCommissionRate } from '@/lib/utils/tier-commission'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

// P4.1 — import tier helpers from shared util (not from server action)
import { getTierFeeRate, TIER_WARRANTY_HOURS } from '@/lib/utils/vaultshield-tiers'
import type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'

// P5.2 — Loyalty cashback
import { awardCashback } from '@/lib/actions/loyalty'
// P5.3 — Promo code usage
import { recordPromoUsage } from '@/lib/actions/promo'

interface CreateOrderData {
  paymentIntentId: string
  listingId: string
  quantity: number
  vaultshieldTier?: VaultShieldTier   // P4.1 — buyer-chosen tier (default: 'standard')
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
        )
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
    const validTiers: VaultShieldTier[] = ['standard', 'enhanced', 'premium']
    const vaultshieldTier: VaultShieldTier =
      data.vaultshieldTier && validTiers.includes(data.vaultshieldTier)
        ? data.vaultshieldTier
        : 'standard'

    // Calculate amounts — commission rate comes from DB (seller_tier_config)
    const subtotal = listing.price * data.quantity
    const platformFeeRate = await getCommissionRate(listing.seller?.seller_tier)
    const platformFee = subtotal * (platformFeeRate / 100)
    const paymentProcessingFee = subtotal * 0.035 // 3.5% payment processing

    // P4.1 — Tier fee (recalculated server-side, not trusted from client)
    const tierFeeRate = getTierFeeRate(vaultshieldTier)
    const tierFee = subtotal * (tierFeeRate / 100)

    // P5.3 — Promo discount (already deducted from Stripe charge; reflect in order total)
    const promoDiscount = Math.min(data.promoDiscount ?? 0, subtotal)
    const totalAmount   = subtotal + platformFee + paymentProcessingFee + tierFee - promoDiscount
    const sellerPayout  = subtotal - platformFee - paymentProcessingFee // seller unaffected by promo

    // P4.1 — Protection until: 30 days; warranty_expires_at based on tier
    const now = new Date()
    const protectionUntil = new Date(now)
    protectionUntil.setDate(protectionUntil.getDate() + 30)

    const warrantyHours = TIER_WARRANTY_HOURS[vaultshieldTier]
    const warrantyExpiresAt = new Date(now.getTime() + warrantyHours * 60 * 60 * 1000)

    // Delivery evidence required for Enhanced+ (manual/screenshot proof) or large orders
    const deliveryEvidenceRequired = vaultshieldTier !== 'standard' || subtotal >= 100

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
        platform_fee_rate: platformFeeRate,
        payment_processing_fee_rate: 3.5,
        platform_fee: platformFee,
        payment_processing_fee: paymentProcessingFee,
        total_amount: totalAmount,
        seller_payout: sellerPayout,
        stripe_payment_intent_id: data.paymentIntentId,
        status: 'paid',
        escrow_status: 'held',
        delivering_at: now.toISOString(), // Timer starts immediately on payment — seller cannot delay the clock
        protection_until: protectionUntil.toISOString(),
        auto_release_at: null,
        delivery_evidence_required: deliveryEvidenceRequired,
        vaultshield_level:          vaultshieldTier,
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
      return {
        success: false,
        error: 'Failed to create order',
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
      // TODO: Implement sendGuestWelcomeEmail
      console.log('Send guest welcome email to:', data.guestEmail)
    }

    // TODO: Send order confirmation emails
    // await sendOrderConfirmationEmail(buyerId, order.id)
    // await sendNewOrderEmail(listing.seller_id, order.id)

    // Create notification for seller
    try {
      await (supabase
        .from('notifications')
        .insert as any)({
          user_id: listing.seller_id,
          type: 'new_order',
          title: 'New Order Received!',
          message: `You have a new order for "${listing.title}" - $${totalAmount.toFixed(2)}`,
          link: `/account/orders/${order.id}`,
          is_read: false,
        })
    } catch (error) {
      console.error('Error creating notification:', error)
      // Don't fail the order
    }

    revalidatePath('/orders')
    revalidatePath(`/marketplace/${listing.game_id}/${listing.category_id}`)

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

    // Update order (auto_release_at is set automatically by database trigger)
    const { error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Database error updating order:', updateError)
      return {
        success: false,
        error: updateError.message || 'Failed to update order',
      }
    }

    // Send navbar notification to buyer
    try {
      const { createNotification } = await import('@/lib/utils/notifications')
      const orderRef = (order as any).order_number || orderId.slice(0, 8).toUpperCase()
      await createNotification({
        userId: (order as any).buyer_id,
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `Your order #${orderRef} has been marked as delivered. Please confirm receipt within 48 hours.`,
        link: `/account/orders/${orderId}`,
      })
    } catch (notifError) {
      console.error('[Delivered] Failed to create buyer notification:', notifError)
      // Non-fatal
    }

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
 * Cancel an order (buyer action — only allowed when status is 'paid')
 * Triggers a full Stripe refund and sets escrow to 'refunded'
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
      .select('id, buyer_id, seller_id, status, stripe_payment_intent_id, total_amount, order_number')
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

    // Issue Stripe refund
    if (order.stripe_payment_intent_id) {
      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          reason: 'requested_by_customer',
        })
      } catch (stripeError: any) {
        console.error('Stripe refund error:', stripeError)
        return { success: false, error: 'Refund failed — please contact support' }
      }
    }

    // Update order status
    const { error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'cancelled',
        escrow_status: 'refunded',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Failed to update order after refund:', updateError)
      return { success: false, error: 'Refund issued but order update failed — contact support' }
    }

    await logOrderAction('cancelled', orderId, user.id, {
      reason: 'buyer_cancelled',
      refund_issued: !!order.stripe_payment_intent_id,
    })

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

    // If order is not yet delivered, mark as delivered first
    // This allows buyer to confirm receipt even if seller hasn't marked as delivered
    const now = new Date().toISOString()

    if (order.status !== 'delivered') {
      // First transition to delivered
      const { error: deliveredError } = await (supabase
        .from('orders')
        .update as any)({
          status: 'delivered',
          delivered_at: now,
        })
        .eq('id', orderId)

      if (deliveredError) {
        console.error('Error marking order as delivered:', deliveredError)
        return {
          success: false,
          error: deliveredError.message || 'Failed to mark order as delivered',
        }
      }
    }

    // Now update to completed
    const { error: updateError } = await (supabase
      .from('orders')
      .update as any)({
        status: 'completed',
        completed_at: now,
        escrow_status: 'released',
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Database error completing order:', updateError)
      return {
        success: false,
        error: updateError.message || 'Failed to complete order',
      }
    }

    // Trigger payout to seller via Stripe Connect
    try {
      const { transferEscrowToSeller } = await import('@/lib/stripe/connect')
      const payoutResult = await transferEscrowToSeller(orderId)

      if (payoutResult.success) {
        if (payoutResult.transferId) {
          console.log(`[Orders] Payout transfer initiated: ${payoutResult.transferId}`)
        } else {
          console.log(`[Orders] Payout held or seller not connected yet`)
        }
      } else {
        console.error(`[Orders] Payout transfer failed: ${payoutResult.error}`)
        // Don't fail the order completion - payout can be retried
      }
    } catch (payoutError) {
      console.error('[Orders] Error initiating payout:', payoutError)
      // Non-fatal - order is still completed, payout can be retried manually
    }

    // TODO: Send completion emails
    // TODO: Invite buyer to leave Trustpilot review (after 7 days)

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

    // TODO: Notify seller via email

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
