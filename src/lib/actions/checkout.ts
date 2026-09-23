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
 * The order is confirmed (pending → paid) only by the verified provider
 * webhook (order_confirm_payment: CHARGE_CONFIRMED + stock claim in one
 * transaction), never by the browser.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { PURCHASES_ENABLED, PURCHASES_DISABLED_MESSAGE } from '@/lib/config/purchases'
import { buyerFee, protectionWindowHours, round2 } from '@/lib/fees'
import { resolveSellerFee, FeeResolutionError, type SellerFeeTrace } from '@/lib/fees/resolver'
import { runOrderInsert, OrderInsertConflictError, type OrderInsertResult } from '@/lib/checkout/order-insert'
import { getProvider, activePaymentProviderName, providerNameForMethod } from '@/lib/payments/registry'
import { spendWallet, getWalletBalance } from '@/lib/wallet/wallet'
import { cancelOrderReturnWallet } from '@/lib/wallet/order-money'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { validatePromoCode, recordPromoUsage } from '@/lib/actions/promo'
import { resolveCheckoutPromo } from '@/lib/checkout/promo'
import { fromDecimal, money } from '@/lib/money'

// Order currency is the ledger base (EUR). Listing price_currency / display is
// a separate concern handled at the UI layer; the order + charge settle EUR.
// USD end-to-end (decided 2026-09-04): listings, checkout totals, orders,
// wallet ledger and BTCPay invoices all denominate in USD — matching every
// $-labelled surface of the UI. (EUR was a leftover of the CoinGate/SEPA
// plan; switched before any real payment existed.)
const ORDER_CURRENCY = 'USD'

/** PAY-007: open (pending) orders one buyer may hold at once. Each one is a
 *  live provider invoice and, when wallet credit was applied, money held for
 *  that order — an unbounded count is an abuse surface, not a feature. */
const MAX_OPEN_PENDING_ORDERS = 5
/** PAY-006: a pending order gets this expiry at INSERT, before any provider
 *  call, so an order stranded by a crash between insert and the charge
 *  UPDATE is always sweepable. The provider's own expiry overwrites it. */
const FALLBACK_PAYMENT_WINDOW_MS = 30 * 60 * 1000
/** PAY-005: an existing pending order with no checkout_url yet is a racing
 *  request still inside provider.createCharge for this long; superseding it
 *  would cancel an order that is about to receive a live charge. */
const CHARGE_IN_FLIGHT_WINDOW_MS = 90 * 1000
const PAYMENT_BEING_PREPARED_MESSAGE =
  'Your payment is still being prepared — please try again in a moment.'
const PROVIDER_UNAVAILABLE_MESSAGE =
  'The payment service is temporarily unavailable. Nothing was charged, and any wallet credit you applied is back in your wallet. Please try again shortly.'
/** PAY-003: the stock ran out between checkout and payment; the order was
 *  refunded to the wallet inside the confirm transaction. */
const SOLD_OUT_REFUNDED_MESSAGE =
  'This item sold out just before your payment went through — the full amount is back in your DropMarket wallet.'

export interface CreateCheckoutInput {
  listingId: string
  quantity?: number
  /** Promo CODE only. The discount is derived server-side from the promo row
   *  (AUTH-003) — a client-supplied amount is never accepted. */
  promoCode?: string
  walletAmount?: number // major-unit amount of wallet credit to apply
  /** Fiat local-method pm_id (e.g. 'paysafecard', 'ideal_nl') → routes the
   *  charge to Payssion. Absent/unknown → the env-active provider (crypto). */
  paymentMethodId?: string
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
    // Marketplace-wide buying gate — the authoritative server-side block. Both
    // callers (CheckoutForm action + /api/checkout) pass through here.
    if (!PURCHASES_ENABLED) {
      return { success: false, error: PURCHASES_DISABLED_MESSAGE }
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Authentication required' }

    // PAY-007: the live UI calls this action directly (never /api/checkout),
    // so the budget must be charged HERE. Per buyer, not per IP: one account
    // minting orders + provider invoices is the abuse this bounds.
    const limit = await checkRateLimit('checkout', `user:${user.id}`)
    if (limit.limited) {
      return { success: false, error: 'Too many checkout attempts — please wait a minute and try again.' }
    }

    const quantity = Math.max(1, Math.floor(input.quantity ?? 1))

    // Listing (server-side; never trust client amounts). The seller's rank /
    // founding state is NOT read here: resolve_seller_fee reads the profile
    // row itself, under the definer, so the buyer's RLS view is irrelevant.
    const { data: listingRaw, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', input.listingId)
      .single() as any
    const listing = listingRaw as any
    if (listingError || !listing) return { success: false, error: 'Listing not found' }
    if (listing.status !== 'active') return { success: false, error: 'Listing is not available' }
    if (listing.seller_id === user.id) return { success: false, error: 'Cannot purchase your own listing' }
    if (!listing.is_unlimited && listing.quantity < quantity) {
      return { success: false, error: `Insufficient stock. Only ${listing.quantity} available` }
    }

    // Server-computed amounts (promo clamped, no client money trusted). Fee
    // spec: buyer pays a single Processing & Buyer Protection fee (5% + 2%,
    // lib/fees buyerFee); seller pays a commission on the item price only —
    // never both fees.
    const subtotal = round2(listing.price * quantity)
    const fee = buyerFee(subtotal)
    // Seller commission: ONE resolve_seller_fee call (fee engine PR 3). The
    // database decides the rate from fee_rules + the seller's rank/founding
    // state and returns the trace that explains it; both are snapshotted on
    // the order below so a later rule change can never touch this order.
    // Runs on the BUYER's session client (the resolver is SECURITY DEFINER).
    // FAILS CLOSED: an RPC error or empty result refuses the order — there is
    // no TS-constant fallback (docs/design/fee-engine.md §9 A4).
    const sellerFee = await resolveSellerFee(supabase, {
      sellerId: listing.seller_id,
      gameCategoryId: listing.game_category_id as string | null,
    })
    // R-2: the rate becomes money with the same rounding as before the switch.
    const commission = round2((subtotal * sellerFee.pct) / 100)
    // AUTH-003 — never trust a client amount: validate the CODE and derive the
    // discount from the promo row, clamped to the subtotal.
    const promo = await resolveCheckoutPromo(input.promoCode, subtotal, validatePromoCode)
    if (!promo.ok) return { success: false, error: promo.error }
    const promoDiscount = promo.discount
    const promoCodeId = promo.promoCodeId
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
      // Reuse only when the stored charge belongs to the SAME provider the
      // buyer just picked — handing a GCash buyer a crypto pay page (or
      // vice versa) is worse than minting a fresh charge.
      const sameProvider =
        !existingPending.payment_provider ||
        existingPending.payment_provider === providerNameForMethod(input.paymentMethodId)
      if (sameAmount && notExpired && sameProvider && existingPending.checkout_url) {
        return {
          success: true,
          orderId: existingPending.id,
          checkoutUrl: toRelativePayUrl(existingPending.checkout_url),
        }
      }
      // PAY-005: no checkout_url yet and created moments ago = a racing
      // request (other tab, double submit) is still creating the provider
      // charge for it. Superseding now would cancel an order about to get a
      // live charge; minting our own would give one order two charges. The
      // buyer retries in a moment and finds the finished order (reuse above).
      if (!existingPending.checkout_url && isChargeInFlight(existingPending.created_at)) {
        return { success: false, orderId: existingPending.id, error: PAYMENT_BEING_PREPARED_MESSAGE }
      }
      // Amounts drifted (quantity/promo/wallet changed) OR the invoice expired.
      // Supersede the stale order: CANCELLED + the exact mirror of any wallet
      // hold the buyer applied to it (checkout_wallet:<id>, escrow_held →
      // user_wallet) run in ONE DB transaction (DB-015: the old two-RPC
      // sequence stranded the hold when the wallet RPC failed after the
      // transition). Idempotent on both keys. A failure here changes nothing:
      // the stale order stays pending and the unique index below hands the
      // buyer back that same order instead of minting a second one.
      try {
        const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
        await cancelOrderReturnWallet(existingPending.id, `superseded-by-recheckout:${existingPending.id}`)

        // Payssion vouchers stay PAYABLE at the provider until told otherwise
        // — cancel there too, or the buyer could pay a slip whose order no
        // longer exists. Best-effort: the expiry cron re-tries stragglers.
        if (existingPending.payment_provider === 'payssion' && existingPending.provider_charge_id) {
          const { payssionCancelTransaction } = await import('@/lib/payments/providers/payssion')
          await payssionCancelTransaction(existingPending.provider_charge_id).catch((e) =>
            console.error('[createCheckout] payssion cancel on supersede failed:', e)
          )
        }

        // The superseded order's "Order Incomplete" nudge points at a dead
        // order — clear it (the new charge below mints its own).
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('type', 'order_incomplete')
          .like('link', `%${existingPending.id}%`)
      } catch (superErr) {
        console.error('[createCheckout] supersede pending order failed (nothing changed, continuing):', superErr)
      }
    }

    // PAY-007: cap on open pending orders per buyer, server-side. Counted
    // after the supersede above (a re-checkout of the same listing replaces
    // its order rather than adding one) and before this insert.
    const openPending = await countOpenPendingOrders(user.id)
    if (openPending >= MAX_OPEN_PENDING_ORDERS) {
      return {
        success: false,
        error: `You have ${openPending} orders awaiting payment. Complete or cancel one before starting another.`,
      }
    }

    // Create the order at PENDING. Confirmed only by the verified webhook.
    let orderId: string
    // The stored number, for the provider's buyer-visible description.
    let orderNumber: string | null = null
    {
      const insertRes = await insertPendingOrder({
        buyerId: user.id,
        sellerId: listing.seller_id,
        listingId: input.listingId,
        quantity,
        unitPrice: listing.price,
        subtotal,
        fee,
        totalAmount,
        sellerPayout,
        sellerCommissionPct: sellerFee.pct,
        sellerFeeTrace: sellerFee.trace,
        promoDiscount,
        promoCodeId,
      })
      if ('orderId' in insertRes) {
        orderId = insertRes.orderId
        orderNumber = insertRes.orderNumber ?? null
        // AUTH-003 — usage is recorded so per-user / total limits bind.
        if (promoCodeId && promoDiscount > 0) {
          recordPromoUsage({ promoCodeId, orderId, discountAmount: promoDiscount, userId: user.id }).catch(() => {})
        }
      } else if ('duplicate' in insertRes) {
        // 23505 on one_pending_order_per_buyer_listing (and ONLY that index —
        // lib/checkout/order-insert classifies by constraint name): a
        // concurrent double-submit won the race and created the pending order
        // between our lookup and insert. Re-run the reuse lookup and hand the
        // buyer that order instead of a "failed to create order".
        const raced = await findReusablePendingOrder(supabase, user.id, input.listingId)
        if (raced?.checkout_url) {
          return { success: true, orderId: raced.id, checkoutUrl: toRelativePayUrl(raced.checkout_url) }
        }
        // PAY-005: the winner is still inside provider.createCharge (its
        // checkout_url UPDATE comes after). This request did not insert that
        // order and must NEVER create a charge for it — that overwrote the
        // winner's provider_charge_id and left two live charges on one order.
        if (raced) {
          return { success: false, orderId: raced.id, error: PAYMENT_BEING_PREPARED_MESSAGE }
        }
        return { success: false, error: 'Could not open checkout — please try again' }
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
      // seam: the RPC is not executable by the user-bound client. PAY-003:
      // the stock is claimed inside the same transaction; if it is already
      // gone the order is refunded to the wallet there and then.
      const { confirmOrderPayment } = await import('@/lib/wallet/order-money')
      const confirmed = await confirmOrderPayment(orderId, 'wallet-full')
      const { notifyOrderTransition } = await import('@/lib/payments/notify')
      if (confirmed.outcome === 'oversold_refunded') {
        await notifyOrderTransition('REFUNDED', orderId).catch(() => {})
        return { success: false, orderId, error: SOLD_OUT_REFUNDED_MESSAGE }
      }
      // Paid comms normally ride on the payment webhook (dispatch), which
      // this wallet-only branch bypasses — send them here. The order was
      // created moments ago in this same call, so this is always its first
      // CHARGE_CONFIRMED. Awaited; failure never fails checkout.
      await notifyOrderTransition('CHARGE_CONFIRMED', orderId).catch(() => {})
      return { success: true, orderId, fullyPaidByWallet: true }
    }

    // Create the provider charge for the remaining amount.
    //  • success → the order page (paid=1 marks a payment return so the page
    //    collapses history → the back button skips the payment page).
    //  • cancel  → back to checkout so the buyer can retry.
    const base = publicAppUrl()
    // Provider is a property of the METHOD picked: Payssion pm_ids route to
    // 'payssion' (hosted redirect); everything else stays on the env-active
    // crypto provider.
    const providerName = providerNameForMethod(input.paymentMethodId)
    const provider = getProvider(providerName)
    let charge
    try {
      charge = await provider.createCharge({
        orderId,
        orderNumber,
        amount: chargeMoney,
        // Payssion has ONE return URL for paid AND cancelled — the smart
        // /checkout/return route inspects the outcome and lands the buyer on
        // the order page (paid/awaiting) or back at checkout (cancelled).
        returnUrl:
          providerName === 'payssion'
            ? `${base}/checkout/return/${orderId}`
            : `${base}/account/orders/${orderId}?paid=1`,
        cancelUrl: `${base}/checkout/${input.listingId}?qty=${quantity}`,
        metadata: {
          listing_id: input.listingId,
          ...(providerName === 'payssion' && input.paymentMethodId
            ? { pm_id: input.paymentMethodId }
            : {}),
        },
      })
    } catch (chargeError: any) {
      // PAY-006: no charge exists, but the order does — and the wallet debit
      // above sits in escrow_held for it. Left alone it was a pending order
      // with no provider, no expiry and no webhook ever coming: invisible to
      // the sweep, the buyer's money stranded. Cancel + return the hold in
      // ONE RPC (idempotent), then tell the buyer the truth. Provider/config
      // internals never reach the buyer verbatim.
      console.error(`[createCheckout] ${providerName} charge creation failed (order ${orderId} cancelled, wallet returned):`, chargeError?.message ?? chargeError)
      try {
        await cancelOrderReturnWallet(orderId, 'charge-create-failed')
      } catch (cancelError) {
        // The fallback payment_expires_at stamped at insert makes this order
        // sweepable; the sweep drives the same cancel + return path.
        console.error(`[createCheckout] cancel after charge failure ALSO failed (order ${orderId} left for the sweep):`, cancelError)
      }
      return { success: false, error: PROVIDER_UNAVAILABLE_MESSAGE }
    }
    // BTCPay: the buyer pays on OUR native page (address/QR/status), not the
    // provider's hosted checkout — the invoice id on the order is what the
    // page renders from. RELATIVE on purpose: an absolute URL would pin the
    // env's host/port (localhost:3000 vs :3001 vs LAN IP vs prod) and strand
    // the buyer on the wrong origin. Other providers redirect to their own
    // hosted URL, which arrives absolute from them.
    const payUrl =
      providerName === 'btcpay' ? `/checkout/pay/${orderId}` : charge.checkoutUrl

    // Persist the charge on the order so a re-checkout can REUSE this exact
    // invoice instead of minting a second one. Expiry is the provider's
    // authoritative invoice expiry when given (BTCPay: 30 min), else the ~2h
    // CoinGate default. Best-effort: a failed UPDATE only costs the reuse
    // optimisation on a subsequent attempt (the unique index still prevents a
    // genuine duplicate), so it never fails the checkout.
    const expiresAt = charge.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await (supabase.from('orders').update as any)({
      payment_provider: providerName,
      provider_charge_id: charge.providerChargeId,
      checkout_url: payUrl,
      payment_expires_at: expiresAt,
    }).eq('id', orderId)

    await upsertIncompleteNudge(user.id, orderId, providerName, expiresAt)

    return { success: true, orderId, checkoutUrl: payUrl }
  } catch (e: any) {
    // A4 — the rate could not be resolved: nothing was written (the resolver
    // runs before the order insert and before any wallet move). The buyer
    // gets the fixed message; the cause goes to the log.
    if (e instanceof FeeResolutionError) {
      console.error('[createCheckout] seller fee resolution failed (order refused):', e.detail)
      return { success: false, error: e.message }
    }
    // A unique violation on the order INSERT that is neither the buyer's own
    // double-submit nor a first-time order_number collision (already retried
    // once). Nothing was written. The constraint goes to the log, not the buyer.
    if (e instanceof OrderInsertConflictError) {
      console.error(`[createCheckout] order insert conflict on ${e.constraint} after ${e.attempts} attempt(s) (order refused)`)
      return { success: false, error: e.message }
    }
    const msg = String(e?.message ?? '')
    // Provider/config internals never reach the buyer verbatim.
    if (msg.startsWith('[Payssion]') || msg.startsWith('payssion:')) {
      console.error('[createCheckout] payssion call failed:', msg)
      return { success: false, error: PROVIDER_UNAVAILABLE_MESSAGE }
    }
    return { success: false, error: e?.message ?? 'Checkout failed' }
  }
}

/**
 * "Order Incomplete" navbar nudge — the visible trace of an unpaid order the
 * moment the buyer backs out of the payment page. notify.ts deletes it when
 * the charge confirms or the order auto-cancels (both match the order id
 * embedded in the link); a retry that mints a fresh invoice replaces rather
 * than duplicates it. Best-effort: never fails checkout.
 */
async function upsertIncompleteNudge(
  userId: string,
  orderId: string,
  providerName: string,
  expiresAtIso: string,
) {
  try {
    // AUTH-013 — notifications has no user INSERT policy; write as the backend.
    const supabase = createServiceRoleClient()
    const minutes = Math.max(
      1,
      Math.round((new Date(expiresAtIso).getTime() - Date.now()) / 60000),
    )
    // Voucher rails (Payssion 48h windows) read in hours, not "2880 minutes".
    const window =
      minutes >= 120
        ? `${Math.round(minutes / 60)} hours`
        : `${minutes} minutes`
    const link =
      providerName === 'btcpay' ? `/checkout/pay/${orderId}` : `/account/orders/${orderId}`
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'order_incomplete')
      .like('link', `%${orderId}%`)
    await (supabase.from('notifications').insert as any)({
      user_id: userId,
      type: 'order_incomplete',
      title: 'Order Incomplete',
      message: `Complete payment within ${window} or the order cancels.`,
      link,
      is_read: false,
    })
  } catch (e) {
    console.error('[Checkout] incomplete nudge failed (non-fatal):', e)
  }
}

function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

/** PAY-005: was this url-less pending order inserted within the in-flight window? */
function isChargeInFlight(createdAtIso: string | null): boolean {
  if (!createdAtIso) return false
  const age = Date.now() - new Date(createdAtIso).getTime()
  return age >= 0 && age < CHARGE_IN_FLIGHT_WINDOW_MS
}

/** PAY-007: the buyer's open (pending) orders, counted as the backend. */
async function countOpenPendingOrders(buyerId: string): Promise<number> {
  const { count, error } = await createServiceRoleClient()
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', buyerId)
    .eq('status', 'pending')
  if (error) throw new Error(`open pending order count failed: ${error.message}`)
  return count ?? 0
}

interface ReusablePendingOrder {
  id: string
  order_number: string | null
  total_amount: number
  checkout_url: string | null
  payment_expires_at: string | null
  payment_provider: string | null
  provider_charge_id: string | null
  created_at: string | null
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
    .select('id, order_number, total_amount, checkout_url, payment_expires_at, payment_provider, provider_charge_id, created_at')
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
  /** Snapshot of the resolved seller rate + its trace (fee engine PR 3). */
  sellerCommissionPct: number
  sellerFeeTrace: SellerFeeTrace
  promoDiscount: number
  promoCodeId: string | null
}

/**
 * Insert the pending order under lib/checkout/order-insert's 23505 policy:
 * one_pending_order_per_buyer_listing → { duplicate } (reuse the racing
 * order); orders_order_number_key → the INSERT is retried exactly once (the
 * trigger draws a fresh number); any other unique index → throws
 * OrderInsertConflictError, mapped to a buyer-safe refusal by the caller.
 */
async function insertPendingOrder(
  a: InsertPendingArgs,
): Promise<OrderInsertResult> {
  // Service role: client-side order inserts are RLS-blocked entirely (the old
  // permissive "Buyers can create orders" policy was a price-integrity hole) —
  // the server, which computed the amounts above, is the only writer.
  const service = createServiceRoleClient()
  return runOrderInsert(() => (service.from('orders').insert as any)({
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
    // Guarded columns (42501 on any later non-service UPDATE): the rate this
    // order was priced at and why. Written once, here, never recomputed.
    seller_commission_pct: a.sellerCommissionPct,
    seller_fee_trace: a.sellerFeeTrace,
    currency: ORDER_CURRENCY,
    status: 'pending',
    escrow_status: 'pending',
    promo_discount: a.promoDiscount,
    promo_code_id: a.promoCodeId,
    // PAY-006: sweepable from birth; the provider's expiry replaces this.
    payment_expires_at: new Date(Date.now() + FALLBACK_PAYMENT_WINDOW_MS).toISOString(),
  })
    .select('id, order_number')
    .single())
}

/**
 * retryOrderPayment — get the buyer back into a payable state for an order
 * stuck at Awaiting Payment. Reuses the existing CoinGate invoice when it is
 * still valid; otherwise mints a fresh charge for the REMAINING amount
 * (total minus any wallet credit already held for this order) and stores it
 * on the order. If wallet credit already covers the full total (edge case),
 * confirms the order directly instead of charging.
 */
export async function retryOrderPayment(orderId: string): Promise<{
  success: boolean
  checkoutUrl?: string
  fullyPaidByWallet?: boolean
  error?: string
}> {
  try {
    // The gate stops ALL new payment initiation, not just new orders.
    if (!PURCHASES_ENABLED) {
      return { success: false, error: PURCHASES_DISABLED_MESSAGE }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: order } = (await supabase
      .from('orders')
      .select('id, order_number, buyer_id, listing_id, status, total_amount, checkout_url, payment_expires_at, payment_provider')
      .eq('id', orderId)
      .single()) as any
    if (!order) return { success: false, error: 'Order not found' }
    if (order.buyer_id !== user.id) return { success: false, error: 'Unauthorized' }
    if (order.status !== 'pending') {
      return { success: false, error: 'This order is not awaiting payment' }
    }

    // Payssion: the stored hosted URL is the answer for the whole pending
    // lifetime — their page renders its own expired state, and we can't mint
    // a fresh charge here (pm_id isn't persisted; silently re-charging via
    // crypto would switch the buyer's method). Only a corrupt order with no
    // URL falls through to the re-order message.
    if (order.payment_provider === 'payssion') {
      if (order.checkout_url) {
        return { success: true, checkoutUrl: order.checkout_url }
      }
      return {
        success: false,
        error: 'This payment link is no longer available — please place the order again.',
      }
    }

    // Reuse the existing invoice while it has a comfortable validity buffer.
    const validUntil = order.payment_expires_at ? new Date(order.payment_expires_at).getTime() : 0
    if (order.checkout_url && validUntil > Date.now() + 5 * 60 * 1000) {
      return { success: true, checkoutUrl: toRelativePayUrl(order.checkout_url) }
    }

    // Remaining charge = total − wallet credit already held for this order.
    const totalMoney = fromDecimal(Number(order.total_amount ?? 0).toFixed(2), ORDER_CURRENCY)
    const { data: heldRaw } = await (supabase.rpc as any)('checkout_wallet_hold_minor', {
      p_order_id: orderId,
    })
    const heldMinor = BigInt(heldRaw ?? 0)
    const remainingMinor = totalMoney.amountMinor - heldMinor

    if (remainingMinor <= 0n) {
      // Wallet already funds the full total — confirm instead of charging
      // (PAY-003: stock claimed inside; sold out → refunded to the wallet).
      const { confirmOrderPayment } = await import('@/lib/wallet/order-money')
      const confirmed = await confirmOrderPayment(orderId, 'wallet-full-retry')
      const { notifyOrderTransition } = await import('@/lib/payments/notify')
      if (confirmed.outcome === 'oversold_refunded') {
        await notifyOrderTransition('REFUNDED', orderId).catch(() => {})
        return { success: false, error: SOLD_OUT_REFUNDED_MESSAGE }
      }
      await notifyOrderTransition('CHARGE_CONFIRMED', orderId).catch(() => {})
      return { success: true, fullyPaidByWallet: true }
    }

    const base = publicAppUrl()
    const providerName = activePaymentProviderName()
    const provider = getProvider(providerName)
    const charge = await provider.createCharge({
      orderId,
      orderNumber: order.order_number ?? null,
      amount: money(remainingMinor, ORDER_CURRENCY),
      returnUrl: `${base}/account/orders/${orderId}?paid=1`,
      cancelUrl: `${base}/account/orders/${orderId}`,
      metadata: { listing_id: order.listing_id, retry: 'true' },
    })
    // Relative for the same reason as createCheckout: never pin an origin.
    const payUrl =
      providerName === 'btcpay' ? `/checkout/pay/${orderId}` : charge.checkoutUrl

    const expiresAt = charge.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await (supabase.from('orders').update as any)({
      payment_provider: providerName,
      provider_charge_id: charge.providerChargeId,
      checkout_url: payUrl,
      payment_expires_at: expiresAt,
    }).eq('id', orderId)

    await upsertIncompleteNudge(user.id, orderId, providerName, expiresAt)

    return { success: true, checkoutUrl: payUrl }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Could not restart payment' }
  }
}

function publicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_API_URL ?? 'http://localhost:3000'
}

/** Orders created before the relative-URL change stored our pay page with an
 *  absolute origin (whatever host/port the env pointed at). Strip it so a
 *  reused invoice never redirects the buyer onto the wrong origin; provider-
 *  hosted URLs (no /checkout/pay/ segment) pass through untouched. */
function toRelativePayUrl(url: string): string {
  const i = url.indexOf('/checkout/pay/')
  return i >= 0 ? url.slice(i) : url
}
