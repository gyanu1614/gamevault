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

    // ── Duplicate-order guard ────────────────────────────────────────────────
    // Before minting a new pending order, look for one this buyer already has
    // open against this same listing. Re-submitting checkout (or bouncing back
    // to the CoinGate page) must NOT create a second order + second live
    // invoice. A partial unique index (one_pending_order_per_buyer_listing) is
    // the hard backstop; this lookup is the graceful path.
    const existingPending = await findReusablePendingOrder(supabase, user.id, input.listingId)
    if (existingPending) {
      // Same amount + a still-payable stored invoice → reuse it verbatim. The
      // buyer lands back on the exact CoinGate charge they already have open.
      const sameAmount = Math.abs(Number(existingPending.total_amount) - totalAmount) < 0.005
      const notExpired = existingPending.payment_expires_at
        ? new Date(existingPending.payment_expires_at).getTime() > Date.now()
        : false
      if (sameAmount && notExpired && existingPending.checkout_url) {
        return { success: true, orderId: existingPending.id, checkoutUrl: existingPending.checkout_url }
      }
      // Amounts drifted (quantity/promo/wallet changed) OR the invoice expired.
      // Supersede the stale order via CANCELLED, then RETURN any wallet credit
      // the buyer applied to it. CANCELLED only moves escrow_held → the
      // platform 'refunds' account; the refunds → buyer-wallet leg is a
      // separate wallet_credit every other cancel path performs. Without it,
      // a buyer who wallet-funded a pending order and re-checks-out loses that
      // credit into 'refunds'. Tolerate an already-terminal order (webhook
      // raced us): treat any failure as "already gone" and fall through.
      try {
        const { transition } = await import('@/lib/escrow/transition')
        await transition(existingPending.id, 'CANCELLED', `superseded-by-recheckout:${existingPending.id}`)

        // How much wallet credit did that order hold? (checkout_wallet:<id>
        // credited escrow_held.) Return exactly that to the buyer's wallet,
        // idempotent on wallet_refund:<id> so a retry can't double-credit.
        const { data: heldMinorRaw } = await (supabase.rpc as any)(
          'checkout_wallet_hold_minor',
          { p_order_id: existingPending.id },
        )
        const heldMinor = BigInt(heldMinorRaw ?? 0)
        if (heldMinor > 0n) {
          const { refundToWallet } = await import('@/lib/wallet/wallet')
          await refundToWallet({
            userId: user.id,
            amountMinor: heldMinor,
            currency: ORDER_CURRENCY,
            orderId: existingPending.id,
          })
        }
      } catch (superErr) {
        console.error('[createCheckout] supersede pending order failed (continuing):', superErr)
      }
    }

    // Create the order at PENDING. Confirmed only by the verified webhook.
    let orderId: string
    {
      const insertRes = await insertPendingOrder(supabase, {
        buyerId: user.id,
        sellerId: listing.seller_id,
        listingId: input.listingId,
        quantity,
        unitPrice: listing.price,
        subtotal,
        fee,
        totalAmount,
        sellerPayout,
        promoDiscount,
      })
      if (insertRes.orderId) {
        orderId = insertRes.orderId
      } else if (insertRes.duplicate) {
        // 23505 on the partial unique index — a concurrent double-submit won the
        // race and created the pending order between our lookup and insert.
        // Re-run the reuse lookup and hand the buyer that order instead of a
        // "failed to create order".
        const raced = await findReusablePendingOrder(supabase, user.id, input.listingId)
        if (raced?.checkout_url) {
          return { success: true, orderId: raced.id, checkoutUrl: raced.checkout_url }
        }
        if (raced) {
          orderId = raced.id
        } else {
          return { success: false, error: 'Could not open checkout — please try again' }
        }
      } else {
        const isDev = process.env.NODE_ENV !== 'production'
        return { success: false, error: isDev ? `Failed to create order: ${insertRes.error}` : 'Failed to create order' }
      }
    }

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
      // safedrop_transition dedupes the wallet-paid portion, so this posts
      // NO provider_float journal for a fully wallet-paid order. Service-role
      // seam: the RPC is not executable by the user-bound client.
      const { transition } = await import('@/lib/escrow/transition')
      await transition(orderId, 'CHARGE_CONFIRMED', 'wallet-full')
      // Paid comms normally ride on the payment webhook (dispatch), which
      // this wallet-only branch bypasses — send them here. The order was
      // created moments ago in this same call, so this is always its first
      // CHARGE_CONFIRMED. Awaited; failure never fails checkout.
      const { notifyOrderTransition } = await import('@/lib/payments/notify')
      await notifyOrderTransition('CHARGE_CONFIRMED', orderId).catch(() => {})
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

    // Persist the charge on the order so a re-checkout can REUSE this exact
    // invoice instead of minting a second one. Expiry mirrors CoinGate's ~2h
    // invoice lifetime (status-map). Best-effort: a failed UPDATE only costs
    // the reuse optimisation on a subsequent attempt (the unique index still
    // prevents a genuine duplicate), so it never fails the checkout.
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await (supabase.from('orders').update as any)({
      payment_provider: 'coingate',
      provider_charge_id: charge.providerChargeId,
      checkout_url: charge.checkoutUrl,
      payment_expires_at: expiresAt,
    }).eq('id', orderId)

    return { success: true, orderId, checkoutUrl: charge.checkoutUrl }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Checkout failed' }
  }
}

function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

interface ReusablePendingOrder {
  id: string
  total_amount: number
  checkout_url: string | null
  payment_expires_at: string | null
}

/**
 * Find an existing PENDING order for this buyer + listing that we can either
 * reuse (same amount, unexpired invoice) or supersede (drifted/expired).
 * Returns null when there is none. Newest first so a legacy pre-index dupe
 * resolves to the most recent attempt.
 */
async function findReusablePendingOrder(
  supabase: any,
  buyerId: string,
  listingId: string,
): Promise<ReusablePendingOrder | null> {
  const { data } = await supabase
    .from('orders')
    .select('id, total_amount, checkout_url, payment_expires_at')
    .eq('buyer_id', buyerId)
    .eq('listing_id', listingId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as ReusablePendingOrder | null) ?? null
}

interface InsertPendingArgs {
  buyerId: string
  sellerId: string
  listingId: string
  quantity: number
  unitPrice: number
  subtotal: number
  fee: { marketplacePct: number; processingPct: number; marketplaceAmount: number; processingAmount: number }
  totalAmount: number
  sellerPayout: number
  promoDiscount: number
}

/**
 * Insert the pending order. Distinguishes a unique-index collision (23505 on
 * one_pending_order_per_buyer_listing — a concurrent double-submit) from a real
 * failure so the caller can recover by reusing the racing order.
 */
async function insertPendingOrder(
  supabase: any,
  a: InsertPendingArgs,
): Promise<{ orderId?: string; duplicate?: boolean; error?: string }> {
  const { data, error } = await (supabase.from('orders').insert as any)({
    buyer_id: a.buyerId,
    seller_id: a.sellerId,
    listing_id: a.listingId,
    quantity: a.quantity,
    unit_price: a.unitPrice,
    subtotal: a.subtotal,
    platform_fee_rate: a.fee.marketplacePct,
    payment_processing_fee_rate: a.fee.processingPct,
    platform_fee: a.fee.marketplaceAmount,
    payment_processing_fee: a.fee.processingAmount,
    total_amount: a.totalAmount,
    seller_payout: a.sellerPayout,
    currency: ORDER_CURRENCY,
    status: 'pending',
    escrow_status: 'pending',
    promo_discount: a.promoDiscount,
  })
    .select('id')
    .single()
  if (data?.id) return { orderId: data.id as string }
  if (error?.code === '23505') return { duplicate: true }
  return { error: error?.message ?? 'insert failed' }
}

function publicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_API_URL ?? 'http://localhost:3000'
}
