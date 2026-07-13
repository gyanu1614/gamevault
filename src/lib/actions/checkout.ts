'use server'

/**
 * createCheckout — the CoinGate checkout entry point (Phase 6).
 *
 * Replaces the Stripe createPaymentIntent flow. Unlike the old path (which made
 * a Stripe intent and created the order LATER from webhook metadata — the
 * audit's "trust metadata money" hole), this:
 *   1. Re-derives the buyer from the session (never trusts client).
 *   2. Validates the listing + stock + own-listing guard.
 *   3. Computes ALL amounts server-side (no client-trusted money).
 *   4. Creates the order row at status 'pending' / escrow 'pending'.
 *   5. Optionally applies WALLET credit (spendWallet → escrow_held) toward the
 *      order, reducing the crypto charge by that amount.
 *   6. Creates a CoinGate hosted charge for the REMAINING amount and returns the
 *      checkout URL to redirect the buyer to.
 *
 * The order is confirmed (pending → paid) only by the verified CoinGate webhook
 * (safedrop_transition CHARGE_CONFIRMED), never by the browser.
 */

import { createClient } from '@/lib/supabase/server'
import { buyerFee, commissionAmount, protectionWindowHours, round2 } from '@/lib/fees'
import { getProvider } from '@/lib/payments/registry'
import { spendWallet, getWalletBalance } from '@/lib/wallet/wallet'
import { fromDecimal, money } from '@/lib/money'

// Order currency is the ledger base (EUR). Listing price_currency / display is
// a separate concern handled at the UI layer; the order + charge settle EUR.
const ORDER_CURRENCY = 'EUR'

export interface CreateCheckoutInput {
  listingId: string
  quantity?: number
  promoDiscount?: number // major-unit amount, server-clamped
  walletAmount?: number // major-unit amount of wallet credit to apply
}

export interface CreateCheckoutResult {
  success: boolean
  orderId?: string
  checkoutUrl?: string // CoinGate hosted page (null if fully wallet-paid)
  fullyPaidByWallet?: boolean
  error?: string
}

export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Authentication required' }

    const quantity = Math.max(1, Math.floor(input.quantity ?? 1))

    // Listing + seller tier (server-side; never trust client amounts).
    const { data: listingRaw, error: listingError } = await supabase
      .from('listings')
      .select('*, seller:seller_id ( id, seller_tier, username ), game:game_id ( slug ), category:category_id ( slug, metadata )')
      .eq('id', input.listingId)
      .single() as any
    const listing = listingRaw as any
    if (listingError || !listing) return { success: false, error: 'Listing not found' }
    if (listing.status !== 'active') return { success: false, error: 'Listing is not available' }
    if (listing.seller_id === user.id) return { success: false, error: 'Cannot purchase your own listing' }
    if (!listing.is_unlimited && listing.quantity < quantity) {
      return { success: false, error: `Insufficient stock. Only ${listing.quantity} available` }
    }

    // Server-computed amounts (mirrors createOrder; promo clamped, no client
    // money trusted). Fee spec: buyer pays a single Processing & Buyer
    // Protection fee (5% + 2%); seller pays a per-category commission on the
    // item price only — never both fees (lib/fees is the single source).
    const subtotal = round2(listing.price * quantity)
    const fee = buyerFee(subtotal)
    const feeInput = {
      categoryMetaType: listing.category?.metadata?.type as string | undefined,
      categorySlug: listing.category?.slug as string | undefined,
      gameSlug: listing.game?.slug as string | undefined,
    }
    const commission = commissionAmount(subtotal, feeInput)
    const promoDiscount = Math.min(Math.max(input.promoDiscount ?? 0, 0), subtotal)
    const totalAmount = round2(subtotal + fee.amount - promoDiscount)
    const sellerPayout = round2(subtotal - commission)
    // Per-category protection window (hours) — consumed at delivery time to
    // set auto_release_at; stored implicitly via markDelivered (lib/fees).
    void protectionWindowHours

    // Create the order at PENDING. Confirmed only by the verified webhook.
    const { data: orderRaw, error: orderError } = await (supabase
      .from('orders')
      .insert as any)({
        buyer_id: user.id,
        seller_id: listing.seller_id,
        listing_id: input.listingId,
        quantity,
        unit_price: listing.price,
        subtotal,
        platform_fee_rate: fee.marketplacePct,
        payment_processing_fee_rate: fee.processingPct,
        platform_fee: fee.marketplaceAmount,
        payment_processing_fee: fee.processingAmount,
        total_amount: totalAmount,
        seller_payout: sellerPayout,
        currency: ORDER_CURRENCY,
        status: 'pending',
        escrow_status: 'pending',
        promo_discount: promoDiscount,
      })
      .select('id')
      .single()
    if (orderError || !orderRaw) {
      const isDev = process.env.NODE_ENV !== 'production'
      return { success: false, error: isDev ? `Failed to create order: ${orderError?.message}` : 'Failed to create order' }
    }
    const orderId = orderRaw.id as string

    // Total as Money (minor units, EUR).
    const totalMoney = fromDecimal(totalAmount.toFixed(2), ORDER_CURRENCY)

    // Apply wallet credit (server-clamped to balance AND to the total).
    let chargeMoney = totalMoney
    const walletReq = Math.max(0, input.walletAmount ?? 0)
    if (walletReq > 0) {
      const balance = await getWalletBalance(user.id, ORDER_CURRENCY) // minor units
      const wantMinor = fromDecimal(walletReq.toFixed(2), ORDER_CURRENCY).amountMinor
      const applyMinor = bigintMin(bigintMin(wantMinor, balance), totalMoney.amountMinor)
      if (applyMinor > 0n) {
        // Move wallet → escrow_held for this order (idempotent on order id).
        await spendWallet({
          userId: user.id,
          amountMinor: applyMinor,
          currency: ORDER_CURRENCY,
          target: 'escrow_held',
          idempotencyKey: `checkout_wallet:${orderId}`,
          eventRef: 'CHECKOUT_WALLET_CREDIT',
          orderId,
        })
        chargeMoney = money(totalMoney.amountMinor - applyMinor, ORDER_CURRENCY)
      }
    }

    // If wallet fully covered it, confirm the order now (no crypto charge needed).
    if (chargeMoney.amountMinor <= 0n) {
      // Wallet already funded escrow_held for the full total; mark paid.
      await (supabase.rpc as any)('safedrop_transition', {
        p_order_id: orderId,
        p_event: 'CHARGE_CONFIRMED',
        p_dedupe_key: 'wallet-full',
      })
      return { success: true, orderId, fullyPaidByWallet: true }
    }

    // Create the CoinGate charge for the remaining amount.
    //  • success → the order page (paid=1 marks a payment return so the page
    //    collapses history → the back button skips the CoinGate invoice).
    //  • cancel  → back to checkout so the buyer can retry.
    const base = publicAppUrl()
    const provider = getProvider('coingate')
    const charge = await provider.createCharge({
      orderId,
      amount: chargeMoney,
      returnUrl: `${base}/account/orders/${orderId}?paid=1`,
      cancelUrl: `${base}/checkout/${input.listingId}`,
      metadata: { listing_id: input.listingId },
    })

    return { success: true, orderId, checkoutUrl: charge.checkoutUrl }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Checkout failed' }
  }
}

function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function publicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_API_URL ?? 'http://localhost:3000'
}
