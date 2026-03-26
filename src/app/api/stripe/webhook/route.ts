/**
 * Stripe Webhook Handler
 * Priority 0 - Critical Payment Processing
 *
 * Handles webhook events from Stripe:
 * - payment_intent.succeeded: Create order after successful payment
 * - payment_intent.payment_failed: Log payment failure
 * - account.updated: Sync Connect account status changes
 * - transfer.created: Log seller payout transfers
 * - transfer.failed: Handle payout failures
 * - payout.paid: Mark seller payout as completed
 * - payout.failed: Handle payout failures and notify seller
 *
 * Setup Instructions:
 * 1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
 * 2. Forward webhooks to local: stripe listen --forward-to localhost:3000/api/stripe/webhook
 * 3. Copy webhook secret to .env.local: STRIPE_WEBHOOK_SECRET=whsec_...
 * 4. For production: Configure webhook endpoint in Stripe Dashboard
 */

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { sendNewOrderNotificationEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

// Helper to create a service role client (bypasses RLS for system operations)
function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')

  if (!signature) {
    console.error('[Webhook] No signature provided')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  console.log(`[Webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
        break

      // Stripe Connect events
      case 'account.updated':
        await handleConnectAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer)
        break

      case 'transfer.failed' as any:
        await handleTransferFailed(event.data.object as Stripe.Transfer)
        break

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout)
        break

      case 'payout.failed':
        await handlePayoutFailed(event.data.object as Stripe.Payout)
        break

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (error: any) {
    console.error(`[Webhook] Error processing ${event.type}:`, error)
    // Return 200 to acknowledge receipt, but log the error
    // Stripe will retry failed webhooks automatically
  }

  return NextResponse.json({ received: true })
}

/**
 * Handle successful payment
 * Creates order in database and performs post-payment actions
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Webhook] Processing payment success: ${paymentIntent.id}`)

  const meta = paymentIntent.metadata
  const supabase = createServiceRoleClient()

  // Validate required metadata
  if (!meta.listing_id || !meta.seller_id || !meta.quantity) {
    console.error('[Webhook] Missing required metadata:', meta)
    throw new Error('Invalid payment intent metadata')
  }

  // Check if order already exists (prevent duplicates from webhook retries)
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (existingOrder) {
    console.log(`[Webhook] Order already exists for payment ${paymentIntent.id}`)
    return
  }

  // Get listing details
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', meta.listing_id)
    .single()

  if (listingError || !listing) {
    console.error('[Webhook] Listing not found:', meta.listing_id)
    throw new Error('Listing not found')
  }

  // Calculate order amounts
  const quantity = parseInt(meta.quantity)
  const subtotal = listing.price * quantity
  const platformFee = parseFloat(meta.platform_fee || '0')
  const processingFee = parseFloat(meta.payment_processing_fee || '0')
  const totalAmount = paymentIntent.amount / 100 // Convert from cents
  const sellerPayout = parseFloat(meta.seller_payout || '0')

  // Determine buyer ID
  const buyerId = meta.buyer_id || paymentIntent.customer?.toString() || ''
  if (!buyerId) {
    console.error('[Webhook] No buyer ID in metadata or customer')
    throw new Error('Buyer ID missing')
  }

  // Calculate auto-release time (48 hours from now)
  const autoReleaseAt = new Date()
  autoReleaseAt.setHours(autoReleaseAt.getHours() + 48)

  // Protection until (30 days from now)
  const protectionUntil = new Date()
  protectionUntil.setDate(protectionUntil.getDate() + 30)

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: buyerId,
      seller_id: meta.seller_id,
      listing_id: meta.listing_id,
      quantity,
      unit_price: listing.price,
      subtotal,
      platform_fee_rate: parseFloat(meta.platform_fee_rate || '6.9'),
      platform_fee: platformFee,
      payment_processing_fee_rate: 3.5,
      payment_processing_fee: processingFee,
      wallet_amount_used: parseFloat(meta.wallet_amount_used || '0'),
      total_amount: totalAmount,
      seller_payout: sellerPayout,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'paid',
      escrow_status: 'held',
      vaultshield_level: meta.vaultshield_level || 'standard',
      delivery_evidence_required: sellerPayout >= 100,
      auto_release_at: null, // Set when marked as delivered
      protection_until: protectionUntil.toISOString(),
      is_guest_order: meta.is_guest === 'true',
    })
    .select()
    .single()

  if (orderError) {
    console.error('[Webhook] Order creation failed:', orderError)
    // Queue for retry or alert admin
    throw new Error('Failed to create order')
  }

  console.log(`[Webhook] Order created successfully: ${order.id}`)

  // Handle instant delivery if applicable
  if (listing.delivery_method === 'instant') {
    try {
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')
      const deliveryResult = await deliverCodeToBuyer(order.id, buyerId || order.buyer_id)

      if (deliveryResult.success && deliveryResult.code) {
        console.log(`[Webhook] Instant delivery completed for order ${order.id}`)
        // Code has been delivered and stored in order.instant_delivery_code
      } else {
        console.error(`[Webhook] Instant delivery failed for order ${order.id}:`, deliveryResult.error)
        // Order still created, but code not delivered - seller will need to handle manually
      }
    } catch (deliveryError) {
      console.error('[Webhook] Instant delivery error:', deliveryError)
      // Non-fatal - order is still valid
    }
  }

  // Deduct wallet balance if used
  const walletUsed = parseFloat(meta.wallet_amount_used || '0')
  if (walletUsed > 0 && buyerId) {
    try {
      // Get current wallet balance
      const { data: wallet } = await supabase
        .from('wallet_balances')
        .select('available_balance, lifetime_spent')
        .eq('user_id', buyerId)
        .single()

      if (wallet && wallet.available_balance >= walletUsed) {
        const newBalance = wallet.available_balance - walletUsed
        const newLifetimeSpent = (wallet.lifetime_spent || 0) + walletUsed

        // Create wallet transaction
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: buyerId,
            type: 'purchase',
            amount: -walletUsed,
            balance_after: newBalance,
            description: `Purchase - Order ${order.id}`,
            reference_id: order.id,
            reference_type: 'order',
            status: 'completed',
            completed_at: new Date().toISOString(),
          })

        // Update wallet balance
        await supabase
          .from('wallet_balances')
          .update({
            available_balance: newBalance,
            lifetime_spent: newLifetimeSpent,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', buyerId)

        console.log(`[Webhook] Wallet deducted: $${walletUsed.toFixed(2)} from buyer ${buyerId}`)
      } else {
        console.error('[Webhook] Insufficient wallet balance or wallet not found')
      }
    } catch (walletError) {
      console.error('[Webhook] Wallet deduction failed:', walletError)
      // Don't fail the entire order creation for wallet issues
    }
  }

  // Decrement listing quantity
  if (!listing.is_unlimited) {
    const newQuantity = Math.max(0, listing.quantity - quantity)
    const newStatus = newQuantity === 0 ? 'sold' : listing.status

    await supabase
      .from('listings')
      .update({
        quantity: newQuantity,
        status: newStatus,
      })
      .eq('id', meta.listing_id)

    console.log(`[Webhook] Listing quantity updated: ${listing.quantity} → ${newQuantity}`)
  }

  // Create conversation between buyer and seller
  try {
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        buyer_id: buyerId,
        seller_id: meta.seller_id,
        listing_id: meta.listing_id,
        order_id: order.id,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (convError) {
      console.error('[Webhook] Conversation creation error:', convError)
      throw convError
    }

    if (conversation) {
      // Send order creation notification message
      const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/orders/${order.id}`

      const { error: msgError } = await supabase.from('messages').insert([
        {
          conversation_id: conversation.id,
          sender_id: meta.seller_id,
          content: `**Order Created:** ${orderUrl}\n\nHi! Thank you for your purchase of "${listing.title}". I'll deliver your order shortly. Feel free to message me if you have any questions!`,
          is_read: false,
        }
      ])

      if (msgError) {
        console.error('[Webhook] Message creation error:', msgError)
      }

      console.log(`[Webhook] Conversation created: ${conversation.id}`)
    }
  } catch (error) {
    console.error('[Webhook] Conversation creation failed (non-fatal):', error)
    // Don't fail the order if conversation fails
  }

  // Create notification for seller
  try {
    await supabase.from('notifications').insert({
      user_id: meta.seller_id,
      type: 'new_order',
      title: 'New Order Received!',
      message: `You have a new order for "${listing.title}" - $${totalAmount.toFixed(2)}`,
      link: `/seller/orders/${order.id}`,
      is_read: false,
    })

    console.log(`[Webhook] Seller notification created`)
  } catch (error) {
    console.error('[Webhook] Notification creation failed (non-fatal):', error)
  }

  // Send new order email notification to seller
  try {
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', meta.seller_id)
      .single()

    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', buyerId)
      .single()

    if (sellerProfile?.email) {
      await sendNewOrderNotificationEmail({
        to: sellerProfile.email,
        sellerName: sellerProfile.username || 'Seller',
        buyerName: buyerProfile?.username || 'A buyer',
        listingTitle: listing.title,
        quantity,
        totalAmount,
        sellerPayout,
        orderId: order.id,
        orderNumber: order.order_number,
      })
      console.log(`[Webhook] New order email sent to seller: ${sellerProfile.email}`)
    }
  } catch (emailError) {
    console.error('[Webhook] Failed to send seller order email (non-fatal):', emailError)
    // Don't fail the order if email fails
  }

  console.log(`[Webhook] Payment processing complete for ${paymentIntent.id}`)
}

/**
 * Handle failed payment
 * Log the failure for monitoring
 */
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.error(`[Webhook] Payment failed: ${paymentIntent.id}`, {
    reason: paymentIntent.last_payment_error?.message,
    metadata: paymentIntent.metadata,
  })

  // TODO: Notify buyer of payment failure
  // TODO: Log to monitoring system (Sentry, etc.)
}

// ─── Stripe Connect Event Handlers ───────────────────────────────

/**
 * Handle Connect account updates
 * Syncs account status when seller completes/updates onboarding
 */
async function handleConnectAccountUpdated(account: Stripe.Account) {
  console.log(`[Webhook] Connect account updated: ${account.id}`)

  const supabase = createServiceRoleClient()

  // Find seller by Connect account ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_connect_account_id', account.id)
    .single()

  if (!profile) {
    console.error('[Webhook] No profile found for Connect account:', account.id)
    return
  }

  // Determine status
  let status: string = 'pending'
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active'
  } else if (account.requirements?.currently_due?.length) {
    status = 'restricted'
  } else if ((account as any).disabled_reason) {
    status = 'disabled'
  }

  // Update profile
  await supabase
    .from('profiles')
    .update({
      stripe_connect_status: status,
      stripe_connect_charges_enabled: account.charges_enabled,
      stripe_connect_payouts_enabled: account.payouts_enabled,
      stripe_connect_connected_at: status === 'active' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  console.log(`[Webhook] Profile updated for seller ${profile.id}: status=${status}`)

  // If account just became active, notify seller
  if (status === 'active') {
    try {
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'payout_enabled',
        title: 'Payout Account Active!',
        message: 'Your bank account has been verified. You can now receive automatic payouts.',
        link: '/account/wallet',
        is_read: false,
      })
      console.log(`[Webhook] Activation notification sent to seller ${profile.id}`)
    } catch (error) {
      console.error('[Webhook] Failed to create notification:', error)
    }
  }
}

/**
 * Handle transfer creation
 * Logs when a payout transfer is initiated to a seller
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log(`[Webhook] Transfer created: ${transfer.id} → ${transfer.destination}`)

  const supabase = createServiceRoleClient()

  // Extract order ID from metadata
  const orderId = transfer.metadata?.order_id
  if (!orderId) {
    console.log('[Webhook] Transfer has no order_id in metadata, skipping')
    return
  }

  // Update payout record
  const { error } = await supabase
    .from('payouts')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_transfer_id', transfer.id)

  if (error) {
    console.error('[Webhook] Failed to update payout:', error)
  } else {
    console.log(`[Webhook] Payout marked as processing for transfer ${transfer.id}`)
  }
}

/**
 * Handle transfer failure
 * Marks payout as failed and notifies seller/admin
 */
async function handleTransferFailed(transfer: Stripe.Transfer) {
  console.error(`[Webhook] Transfer failed: ${transfer.id}`, {
    destination: transfer.destination,
    amount: transfer.amount,
    failure_code: (transfer as any).failure_code,
    failure_message: (transfer as any).failure_message,
  })

  const supabase = createServiceRoleClient()

  // Update payout record
  const { data: payout, error: updateError } = await supabase
    .from('payouts')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_transfer_id', transfer.id)
    .select('seller_id, amount, order_id')
    .single()

  if (updateError || !payout) {
    console.error('[Webhook] Failed to update payout record:', updateError)
    return
  }

  console.log(`[Webhook] Payout marked as failed for transfer ${transfer.id}`)

  // Notify seller
  try {
    await supabase.from('notifications').insert({
      user_id: payout.seller_id,
      type: 'payout_failed',
      title: 'Payout Failed',
      message: `A payout of $${(payout.amount || 0).toFixed(2)} could not be transferred. Please check your bank account details in Stripe.`,
      link: '/account/wallet/connect',
      is_read: false,
    })
    console.log(`[Webhook] Failure notification sent to seller ${payout.seller_id}`)
  } catch (error) {
    console.error('[Webhook] Failed to create notification:', error)
  }

  // TODO: Alert admin about failed transfer for investigation
}

/**
 * Handle payout completion
 * Updates payout status when funds arrive in seller's bank
 */
async function handlePayoutPaid(payout: Stripe.Payout) {
  console.log(`[Webhook] Payout paid: ${payout.id} to account ${payout.destination}`)

  const supabase = createServiceRoleClient()

  // Find all payouts for this Stripe payout ID
  const { data: payouts, error: findError } = await supabase
    .from('payouts')
    .select('id, seller_id, amount')
    .eq('stripe_payout_id', payout.id)

  if (findError || !payouts?.length) {
    console.log('[Webhook] No matching payouts found for Stripe payout:', payout.id)
    return
  }

  // Update all matching payouts
  const { error: updateError } = await supabase
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payout_id', payout.id)

  if (updateError) {
    console.error('[Webhook] Failed to update payouts:', updateError)
    return
  }

  console.log(`[Webhook] ${payouts.length} payout(s) marked as paid`)

  // Notify seller (only once per payout batch)
  const sellerId = payouts[0].seller_id
  const totalAmount = payouts.reduce((sum: any, p: any) => sum + (p.amount || 0), 0)

  try {
    await supabase.from('notifications').insert({
      user_id: sellerId,
      type: 'payout_completed',
      title: 'Payout Completed!',
      message: `$${totalAmount.toFixed(2)} has been sent to your bank account. It should arrive within 2-7 business days.`,
      link: '/account/wallet',
      is_read: false,
    })
    console.log(`[Webhook] Completion notification sent to seller ${sellerId}`)
  } catch (error) {
    console.error('[Webhook] Failed to create notification:', error)
  }
}

/**
 * Handle payout failure
 * Notifies seller when bank transfer fails
 */
async function handlePayoutFailed(payout: Stripe.Payout) {
  console.error(`[Webhook] Payout failed: ${payout.id}`, {
    destination: payout.destination,
    amount: payout.amount,
    failure_code: (payout as any).failure_code,
    failure_message: (payout as any).failure_message,
  })

  const supabase = createServiceRoleClient()

  // Find all payouts for this Stripe payout ID
  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, seller_id, amount')
    .eq('stripe_payout_id', payout.id)

  if (!payouts?.length) {
    console.log('[Webhook] No matching payouts found for failed payout:', payout.id)
    return
  }

  // Update payouts as failed
  await supabase
    .from('payouts')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payout_id', payout.id)

  const sellerId = payouts[0].seller_id
  const totalAmount = payouts.reduce((sum: any, p: any) => sum + (p.amount || 0), 0)

  // Notify seller
  try {
    await supabase.from('notifications').insert({
      user_id: sellerId,
      type: 'payout_failed',
      title: 'Payout Failed',
      message: `A payout of $${totalAmount.toFixed(2)} could not be sent to your bank. Please update your bank details in Stripe.`,
      link: '/account/wallet/connect',
      is_read: false,
    })
    console.log(`[Webhook] Failure notification sent to seller ${sellerId}`)
  } catch (error) {
    console.error('[Webhook] Failed to create notification:', error)
  }
}
