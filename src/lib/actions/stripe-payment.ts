'use server'

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { rateLimitPayment } from '@/lib/utils/rate-limit'
import { getCommissionRate } from '@/lib/utils/tier-commission'
import {
  getTierFeeRate,
  TIER_WARRANTY_DAYS,
} from '@/lib/utils/vaultshield-tiers'

// Re-export type only (value re-exports not allowed in 'use server' files)
import type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'
export type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

/**
 * Create a Stripe Payment Intent for a listing purchase
 *
 * @param vaultshieldTier - Buyer-chosen VaultShield tier (default: 'standard')
 * @param skipRateLimit - Skip rate limiting (for tier/quantity updates, not actual payment submission)
 * @param walletAmount - Amount to deduct from wallet balance (reduces Stripe charge)
 */
export async function createPaymentIntent(
  listingId: string,
  quantity: number = 1,
  vaultshieldTier: VaultShieldTier = 'standard',
  discountAmount: number = 0,          // P5.3 — promo code discount (reduces charge)
  skipRateLimit: boolean = true,       // Default to true - rate limit only on final payment submission
  walletAmount: number = 0             // Amount to deduct from wallet balance
): Promise<{
  success: boolean
  clientSecret?: string
  amount?: number
  platformFeeRate?: number
  tierFeeRate?: number
  tierFee?: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get authenticated user for rate limiting (optional for guest checkout)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Rate limiting - ONLY apply when actually submitting payment, not during tier/quantity updates
    if (!skipRateLimit && user && !rateLimitPayment(user.id)) {
      return {
        success: false,
        error: 'Too many payment attempts. Please wait 1 minute before trying again.',
      }
    }

    // Get listing details
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
      .eq('id', listingId)
      .single()
    // Cast: Supabase narrow-select inference returns `never` against hand-written database.ts
    const listing = listingRaw as any

    if (listingError || !listing) {
      return {
        success: false,
        error: 'Listing not found',
      }
    }

    // Check if listing is available
    if (listing.status !== 'active') {
      return {
        success: false,
        error: 'This listing is no longer available',
      }
    }

    // Check quantity availability
    if (!listing.is_unlimited && listing.quantity < quantity) {
      return {
        success: false,
        error: `Only ${listing.quantity} items available`,
      }
    }

    // Calculate amounts — commission rate comes from DB (seller_tier_config)
    const subtotal = listing.price * quantity
    const platformFeeRate = await getCommissionRate(listing.seller?.seller_tier)
    const platformFee = subtotal * (platformFeeRate / 100)
    const paymentProcessingFee = subtotal * 0.035 // 3.5% payment processing

    // P4.1 — Buyer-chosen VaultShield tier fee
    const tierFeeRate = getTierFeeRate(vaultshieldTier)
    const tierFee = subtotal * (tierFeeRate / 100)

    const total = subtotal + platformFee + paymentProcessingFee + tierFee
    const sellerPayout = subtotal - platformFee - paymentProcessingFee // tier fee goes to platform

    // P5.3 — Apply promo discount and wallet balance (clamp to total, minimum $0.50 for Stripe)
    const clampedDiscount = Math.min(Math.max(discountAmount, 0), total)
    const clampedWallet   = Math.min(Math.max(walletAmount, 0), total - clampedDiscount)
    const chargeAmount    = Math.max(total - clampedDiscount - clampedWallet, 0.50)

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(chargeAmount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        listing_id:              listingId,
        seller_id:               listing.seller_id,
        quantity:                quantity.toString(),
        subtotal:                subtotal.toFixed(2),
        platform_fee:            platformFee.toFixed(2),
        platform_fee_rate:       platformFeeRate.toFixed(2),
        payment_processing_fee:  paymentProcessingFee.toFixed(2),
        seller_payout:           sellerPayout.toFixed(2),
        vaultshield_level:       vaultshieldTier,
        vaultshield_tier_fee:    tierFee.toFixed(2),
        vaultshield_tier_fee_rate: tierFeeRate.toFixed(2),
        promo_discount:          clampedDiscount.toFixed(2),
        wallet_amount_used:      clampedWallet.toFixed(2),
        escrow:                  'true',
        auto_release_hours:      '48',
      },
    })

    return {
      success: true,
      clientSecret: paymentIntent.client_secret || undefined,
      amount: total,
      platformFeeRate,
      tierFeeRate,
      tierFee,
    }
  } catch (error: any) {
    console.error('Error creating payment intent:', error)
    return {
      success: false,
      error: error.message || 'Failed to create payment intent',
    }
  }
}

/**
 * Verify payment status
 */
export async function verifyPayment(
  paymentIntentId: string
): Promise<{
  success: boolean
  status?: string
  metadata?: Record<string, string>
  error?: string
}> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    return {
      success: true,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    return {
      success: false,
      error: error.message || 'Failed to verify payment',
    }
  }
}

/**
 * Create a refund for a payment
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: string
): Promise<{
  success: boolean
  refundId?: string
  error?: string
}> {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as any,
    })

    return {
      success: true,
      refundId: refund.id,
    }
  } catch (error: any) {
    console.error('Error creating refund:', error)
    return {
      success: false,
      error: error.message || 'Failed to create refund',
    }
  }
}
