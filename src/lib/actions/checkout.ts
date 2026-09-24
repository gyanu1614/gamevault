'use server'

/**
 * createCheckout — the checkout entry point.
 *
 * Unlike the old Stripe path (which made an intent and created the order
 * LATER from webhook metadata — the audit's "trust metadata money" hole),
 * this:
 *   1. Re-derives the buyer from the session (never trusts client).
 *   2. Validates the listing + stock + own-listing guard.
 *   3. Computes ALL amounts server-side (no client-trusted money). The buyer
 *      PROCESSING fee is not computed here at all: eligibleMethods() quotes it
 *      from payment_method_fees (the same call the checkout page renders
 *      from) and order_create_pending re-quotes and snapshots it inside the
 *      transaction (checkout B3). A method the page would not show is
 *      refused here.
 *   4. Creates the order at 'pending' / escrow 'pending', the promo usage,
 *      the WALLET hold (spendWallet → escrow_held) and the payment attempt
 *      in ONE database transaction (order_create_pending, round B Part 1).
 *   5. Mints the provider charge for the REMAINING amount and stores it on
 *      the attempt (payment_attempt_activate) — the order's charge columns
 *      are a mirror the RPCs maintain; every read here is of the attempt.
 *
 * The order is confirmed (pending → paid) only by the verified provider
 * webhook (order_confirm_payment: CHARGE_CONFIRMED + stock claim in one
 * transaction), never by the browser.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { PURCHASES_ENABLED, PURCHASES_DISABLED_MESSAGE } from '@/lib/config/purchases'
import { buyerFee, round2 } from '@/lib/fees'
import { resolveSellerFee, FeeResolutionError } from '@/lib/fees/resolver'
import { buyerFeeRefusalMessage, eligibleMethods, type EligibleMethod } from '@/lib/payments/eligibility'
import { classifyUniqueViolation, uniqueViolationConstraint, OrderInsertConflictError } from '@/lib/checkout/order-insert'
import { getProvider, activePaymentProviderName, providerNameForMethod } from '@/lib/payments/registry'
import {
  activateAttempt,
  createPendingOrder,
  isOpenAttempt,
  openAttempt,
  openAttemptForOrder,
  supersedeAttempt,
  type PaymentAttempt,
} from '@/lib/payments/attempts'
import { cancelOrderReturnWallet } from '@/lib/wallet/order-money'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { validatePromoCode } from '@/lib/actions/promo'
import { promoRefusalMessage, resolveCheckoutPromo } from '@/lib/checkout/promo'
import { fromDecimal, money } from '@/lib/money'

// Order currency is the ledger base. USD end-to-end (decided 2026-09-04):
// listings, checkout totals, orders, wallet ledger and provider invoices all
// denominate in USD — matching every $-labelled surface of the UI.
const ORDER_CURRENCY = 'USD'

/** PAY-007: open (pending) orders one buyer may hold at once. Each one is a
 *  live provider invoice and, when wallet credit was applied, money held for
 *  that order — an unbounded count is an abuse surface, not a feature.
 *  Read per call so a load harness (the fee parity loop drives hundreds of
 *  checkouts through one buyer) can raise it; production never sets it. */
const DEFAULT_MAX_OPEN_PENDING_ORDERS = 5
function maxOpenPendingOrders(): number {
  const n = Number.parseInt(process.env.CHECKOUT_MAX_OPEN_PENDING_ORDERS ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_MAX_OPEN_PENDING_ORDERS
}
/** PAY-006: a pending order gets this expiry at INSERT, before any provider
 *  call, so an order stranded by a crash between insert and the charge
 *  activation is always sweepable. The provider's own expiry overwrites it. */
const FALLBACK_PAYMENT_WINDOW_MS = 30 * 60 * 1000
/** PAY-005: a `created` attempt this young is a racing request still inside
 *  provider.createCharge; superseding it would cancel an order that is about
 *  to receive a live charge. */
const CHARGE_IN_FLIGHT_WINDOW_MS = 90 * 1000
/** Reuse a live invoice only while it has this much validity left. */
const REUSE_VALIDITY_BUFFER_MS = 5 * 60 * 1000
const PAYMENT_BEING_PREPARED_MESSAGE =
  'Your payment is still being prepared — please try again in a moment.'
const PROVIDER_UNAVAILABLE_MESSAGE =
  'The payment service is temporarily unavailable. Nothing was charged, and any wallet credit you applied is back in your wallet. Please try again shortly.'
/** PAY-003: the stock ran out between checkout and payment; the order was
 *  refunded to the wallet inside the confirm transaction. */
const SOLD_OUT_REFUNDED_MESSAGE =
  'This item sold out just before your payment went through — the full amount is back in your DropMarket wallet.'
const WALLET_CHANGED_MESSAGE =
  'Your wallet balance changed while the order was being created — nothing was charged. Please try again.'
/** B4: the provider refused the charge as below its minimum (Payssion 417 —
 *  its own FX rate moved past our headroom). The order was cancelled and any
 *  wallet credit returned by the PAY-006 path before this is shown. */
const BELOW_PROVIDER_MINIMUM_MESSAGE =
  'This order is under the minimum amount for that payment method — nothing was charged, and any wallet credit you applied is back in your wallet. Please pick another payment method.'

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
  checkoutUrl?: string // hosted page or our native pay page (null if fully wallet-paid)
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
    // spec: the buyer pays the flat marketplace fee (lib/fees buyerFee, 2%)
    // plus the PROCESSING fee of the method they picked (quoted below from
    // payment_method_fees); the seller pays a commission on the item price
    // only — never both fees.
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
    const sellerPayout = round2(subtotal - commission)
    // The SafeDrop Protection window is applied at delivery time by the
    // order_mark_delivered RPC from order_completion_windows (fee PR 7).

    // Provider is a property of the METHOD picked: Payssion pm_ids route to
    // 'payssion' (hosted redirect); everything else stays on the env-active
    // crypto provider. Persisted on the attempt (PAY-018).
    const providerName = providerNameForMethod(input.paymentMethodId)
    const pmId = providerName === 'payssion' && input.paymentMethodId ? input.paymentMethodId : null

    // ── Buyer processing fee: ONE eligibility source (checkout B3) ──────────
    // The same function the checkout page rendered its tiles from. A method
    // that is hidden, over its provider cap, or has no fee row was never on
    // the page — refuse it here with the same reason. The fee itself is the
    // database's quote; the RPC below re-quotes and snapshots it in the
    // transaction, so this number only decides the wallet routing and the
    // reuse comparison.
    const walletReqMinor =
      (input.walletAmount ?? 0) > 0
        ? fromDecimal(Math.max(0, input.walletAmount ?? 0).toFixed(2), ORDER_CURRENCY).amountMinor
        : 0n
    const eligibility = await eligibleMethods({
      buyerId: user.id,
      currency: ORDER_CURRENCY,
      country: null,
      subtotalMinor: fromDecimal(subtotal.toFixed(2), ORDER_CURRENCY).amountMinor,
    })
    const requestedMethod = pmId ?? providerName
    const requested = pickMethod(eligibility, requestedMethod)
    if (!requested.ok) return { success: false, error: requested.error }
    // Store credit covering the whole total (at the wallet row's quote) is a
    // 'wallet' order: no provider charge, the wallet row's fee. Otherwise the
    // picked method's quote applies and the wallet only reduces the charge.
    let chosen: EligibleMethod = requested.method
    const walletRow = eligibility.methods.find((m) => m.kind === 'wallet')
    if (walletRow && walletReqMinor > 0n) {
      const walletTotalMinor = totalMinorFor(subtotal, fee.marketplaceAmount, promoDiscount, walletRow.quote.feeMinor)
      if (walletReqMinor >= walletTotalMinor) chosen = walletRow
    }
    const totalAmount = totalMinorFor(subtotal, fee.marketplaceAmount, promoDiscount, chosen.quote.feeMinor)
      .toString()
    const totalAmountMajor = Number(totalAmount) / 100

    // ── Duplicate-order guard ────────────────────────────────────────────────
    // Before minting a new pending order, look for one this buyer already has
    // open against this same listing. Re-submitting checkout (or bouncing back
    // to the provider page) must NOT create a second order + second live
    // invoice. A partial unique index (one_pending_order_per_buyer_listing) is
    // the hard backstop; this lookup is the graceful path.
    const existing = await findReusablePendingOrder(supabase, user.id, input.listingId)
    if (existing) {
      const { order: existingPending, attempt } = existing
      // Same amount + a still-payable live attempt on the SAME provider the
      // buyer just picked → reuse it verbatim (handing a GCash buyer a crypto
      // pay page, or vice versa, is worse than minting a fresh charge).
      const sameAmount = Math.abs(Number(existingPending.total_amount) - totalAmountMajor) < 0.005
      if (
        sameAmount &&
        attempt?.status === 'active' &&
        attempt.checkout_url &&
        attempt.provider === providerName &&
        isStillPayable(attempt.expires_at, 0)
      ) {
        return { success: true, orderId: existingPending.id, checkoutUrl: toRelativePayUrl(attempt.checkout_url) }
      }
      // PAY-005: a `created` attempt seconds old = a racing request (other
      // tab, double submit) is still creating the provider charge for it.
      // Superseding now would cancel an order about to get a live charge;
      // minting our own would give one order two charges. The buyer retries
      // in a moment and finds the finished order (reuse above).
      if (attempt?.status === 'created' && isChargeInFlight(attempt.created_at)) {
        return { success: false, orderId: existingPending.id, error: PAYMENT_BEING_PREPARED_MESSAGE }
      }
      // Amounts drifted (quantity/promo/wallet changed), the invoice expired,
      // the method changed, or the minting request died. Supersede the stale
      // order: CANCELLED + the exact mirror of any wallet hold the buyer
      // applied to it + the attempt closed as void, in ONE DB transaction
      // (DB-015). Idempotent. A failure here changes nothing: the stale order
      // stays pending and the unique index below hands the buyer back that
      // same order instead of minting a second one.
      try {
        await cancelOrderReturnWallet(existingPending.id, `superseded-by-recheckout:${existingPending.id}`)

        // The stale order's live charge (a voucher, an invoice) stays payable
        // at the provider until voided. The RPC queued it in
        // provider_cancel_outbox in the same transaction; drain it now so it
        // dies before the buyer can pay it — the reconcile cron is the
        // guarantee if this best-effort pass fails.
        const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
        await drainCancelOutboxForOrder(existingPending.id)

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
    const maxOpen = maxOpenPendingOrders()
    const openPending = await countOpenPendingOrders(user.id, maxOpen)
    if (openPending >= maxOpen) {
      return {
        success: false,
        error: `You have ${openPending} orders awaiting payment. Complete or cancel one before starting another.`,
      }
    }

    // ── ONE transaction: order + promo usage + wallet hold + attempt ─────────
    // The wallet request is clamped inside the RPC to the balance AND the
    // total (server-clamped, never client-trusted). A promo cap refusal or a
    // wallet balance that moved rolls the whole order back — no cancelled
    // order, no stranded hold, nothing to sweep.
    const created = await createPendingOrder({
      buyerId: user.id,
      sellerId: listing.seller_id,
      listingId: input.listingId,
      quantity,
      unitPrice: listing.price,
      subtotal,
      platformFeeRate: fee.marketplacePct,
      platformFee: fee.marketplaceAmount,
      sellerPayout,
      // Guarded columns (42501 on any later non-service UPDATE): the rate this
      // order was priced at and why. Written once, here, never recomputed.
      sellerCommissionPct: sellerFee.pct,
      sellerFeeTrace: sellerFee.trace,
      currency: ORDER_CURRENCY,
      promoCodeId,
      promoDiscount,
      walletMinor: walletReqMinor,
      provider: providerName,
      pmId,
      // PAY-006: sweepable from birth; the provider's expiry replaces this.
      fallbackExpiresAt: new Date(Date.now() + FALLBACK_PAYMENT_WINDOW_MS).toISOString(),
      // Checkout B3: the RPC quotes + snapshots the buyer fee for this method.
      buyerFeeMethod: chosen.method,
    })
    if (created.error) {
      const kind = classifyUniqueViolation(created.error)
      if (kind === 'duplicate_submit') {
        // 23505 on one_pending_order_per_buyer_listing: a concurrent
        // double-submit won the race and created the pending order between
        // our lookup and insert. Hand the buyer that order instead.
        const raced = await findReusablePendingOrder(supabase, user.id, input.listingId)
        if (raced?.attempt?.status === 'active' && raced.attempt.checkout_url) {
          return { success: true, orderId: raced.order.id, checkoutUrl: toRelativePayUrl(raced.attempt.checkout_url) }
        }
        // PAY-005: the winner is still inside provider.createCharge. This
        // request did not insert that order and must NEVER create a charge
        // for it — the attempt's unique index would refuse anyway.
        if (raced) {
          return { success: false, orderId: raced.order.id, error: PAYMENT_BEING_PREPARED_MESSAGE }
        }
        return { success: false, error: 'Could not open checkout — please try again' }
      }
      if (kind !== null) {
        // A unique violation that is neither the buyer's own double-submit
        // nor the order_number collision the RPC already retried once.
        throw new OrderInsertConflictError(uniqueViolationConstraint(created.error) ?? 'unknown', 1)
      }
      const detail = String(created.error.message ?? '')
      if (/promo_usage_record/i.test(detail)) {
        // PAY-014: the cap bound under the promo row lock; nothing was written.
        return { success: false, error: promoRefusalMessage(detail) }
      }
      if (/wallet_spend: insufficient/i.test(detail)) {
        return { success: false, error: WALLET_CHANGED_MESSAGE }
      }
      if (/buyer_fee_quote:/i.test(detail)) {
        // The row changed between the page and the RPC (admin edit, cap): the
        // transaction wrote nothing. Same wording the page-side refusal uses.
        const reason = /buyer_fee_quote: ([a-z_]+)/i.exec(detail)?.[1]
        return { success: false, error: buyerFeeRefusalMessage(reason, chosen.label) }
      }
      console.error('[createCheckout] order_create_pending failed:', detail)
      const isDev = process.env.NODE_ENV !== 'production'
      return { success: false, error: isDev ? `Failed to create order: ${detail}` : 'Failed to create order' }
    }
    const { orderId, orderNumber, attemptId, chargeMinor } = created.result

    // If wallet fully covered it, confirm the order now (no provider charge:
    // the RPC opened no attempt).
    if (chargeMinor <= 0n || !attemptId) {
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
    const provider = getProvider(providerName)
    let charge
    try {
      charge = await provider.createCharge({
        orderId,
        orderNumber,
        amount: money(chargeMinor, ORDER_CURRENCY),
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
          ...(pmId ? { pm_id: pmId } : {}),
        },
      })
    } catch (chargeError: any) {
      // PAY-006: no charge exists, but the order does — and the wallet hold
      // sits in escrow_held for it. Cancel + return the hold + void the
      // attempt in ONE RPC (idempotent), then tell the buyer the truth.
      // Provider/config internals never reach the buyer verbatim.
      console.error(`[createCheckout] ${providerName} charge creation failed (order ${orderId} cancelled, wallet returned):`, chargeError?.message ?? chargeError)
      try {
        await cancelOrderReturnWallet(orderId, 'charge-create-failed')
      } catch (cancelError) {
        // The fallback payment_expires_at stamped at insert makes this order
        // sweepable; the sweep drives the same cancel + return path.
        console.error(`[createCheckout] cancel after charge failure ALSO failed (order ${orderId} left for the sweep):`, cancelError)
      }
      if (/result_code 417/.test(String(chargeError?.message ?? ''))) {
        return { success: false, error: BELOW_PROVIDER_MINIMUM_MESSAGE }
      }
      return { success: false, error: PROVIDER_UNAVAILABLE_MESSAGE }
    }
    // BTCPay: the buyer pays on OUR native page (address/QR/status), not the
    // provider's hosted checkout — the invoice id on the attempt is what the
    // page renders from. RELATIVE on purpose: an absolute URL would pin the
    // env's host/port (localhost:3000 vs :3001 vs LAN IP vs prod) and strand
    // the buyer on the wrong origin. Other providers redirect to their own
    // hosted URL, which arrives absolute from them.
    const payUrl =
      providerName === 'btcpay' ? `/checkout/pay/${orderId}` : charge.checkoutUrl

    // Activate the attempt with the charge (and mirror it onto the order).
    // Expiry is the provider's authoritative invoice expiry when given
    // (BTCPay: 30 min, Payssion: per-method window), else ~2h.
    const expiresAt = charge.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    let activated
    try {
      activated = await activateAttempt({ attemptId, providerChargeId: charge.providerChargeId, checkoutUrl: payUrl, expiresAt })
    } catch (activateError) {
      console.error(`[createCheckout] attempt ${attemptId} could not be activated (charge ${charge.providerChargeId}):`, activateError)
      return { success: false, orderId, error: PAYMENT_BEING_PREPARED_MESSAGE }
    }
    if (activated.orphaned) {
      // The attempt was closed while the provider call was in flight (the
      // buyer cancelled in another tab, the sweep expired it). The charge
      // just minted has no order to pay: the RPC queued it for voiding —
      // never hand the buyer its URL.
      console.warn(`[createCheckout] charge ${charge.providerChargeId} minted for a closed attempt ${attemptId} — queued for void`)
      const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
      await drainCancelOutboxForOrder(orderId)
      return { success: false, orderId, error: PAYMENT_BEING_PREPARED_MESSAGE }
    }

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

/** PAY-005: was this `created` attempt opened within the in-flight window? */
function isChargeInFlight(createdAtIso: string | null): boolean {
  if (!createdAtIso) return false
  const age = Date.now() - new Date(createdAtIso).getTime()
  return age >= 0 && age < CHARGE_IN_FLIGHT_WINDOW_MS
}

/** Does the attempt's expiry leave at least `bufferMs` of validity? */
function isStillPayable(expiresAtIso: string | null, bufferMs: number): boolean {
  if (!expiresAtIso) return false
  return new Date(expiresAtIso).getTime() > Date.now() + bufferMs
}

/** PAY-007: the buyer's open (pending) orders, counted as the backend.
 *  A bounded GET, deliberately NOT a `head: true` count: a HEAD response
 *  through Kong → PostgREST leaves the upstream keep-alive socket in a bad
 *  state and the NEXT request on it (the order INSERT) came back as a 502
 *  "upstream prematurely closed" — 1–1.5 % of checkouts in the 405-order
 *  parity loop, zero on the pre-fix code. We only need "at least the cap". */
async function countOpenPendingOrders(buyerId: string, max: number): Promise<number> {
  const { data, error } = await createServiceRoleClient()
    .from('orders')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('status', 'pending')
    .limit(max)
  if (error) throw new Error(`open pending order count failed: ${error.message}`)
  return (data ?? []).length
}

interface ReusablePendingOrder {
  id: string
  order_number: string | null
  total_amount: number
  created_at: string | null
}

/**
 * Find an existing PENDING order for this buyer + listing, with its OPEN
 * payment attempt (null when the order has none — a legacy order, or one
 * whose charge was never created). The caller either reuses it (same
 * amount, live attempt) or supersedes it. Newest first so a legacy
 * pre-index dupe resolves to the most recent attempt.
 */
async function findReusablePendingOrder(
  supabase: any,
  buyerId: string,
  listingId: string,
): Promise<{ order: ReusablePendingOrder; attempt: PaymentAttempt | null } | null> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, created_at')
    .eq('buyer_id', buyerId)
    .eq('listing_id', listingId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const order = (data as ReusablePendingOrder | null) ?? null
  if (!order) return null
  const attempt = await openAttemptForOrder(order.id)
  return { order, attempt: isOpenAttempt(attempt) ? attempt : null }
}

/**
 * retryOrderPayment — get the buyer back into a payable state for an order
 * stuck at Awaiting Payment. Reuses the open attempt's invoice while it is
 * still valid; otherwise SUPERSEDES that attempt (history kept, round B) and
 * opens + activates a fresh one for the REMAINING amount (total minus any
 * wallet credit already held), on the provider the persisted pm_id implies.
 * If wallet credit already covers the full total (edge case), confirms the
 * order directly instead of charging.
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
      .select('id, order_number, buyer_id, listing_id, status, total_amount')
      .eq('id', orderId)
      .single()) as any
    if (!order) return { success: false, error: 'Order not found' }
    if (order.buyer_id !== user.id) return { success: false, error: 'Unauthorized' }
    if (order.status !== 'pending') {
      return { success: false, error: 'This order is not awaiting payment' }
    }

    const current = await openAttemptForOrder(orderId)

    // Reuse the existing invoice while it has a comfortable validity buffer.
    if (current?.status === 'active' && current.checkout_url && isStillPayable(current.expires_at, REUSE_VALIDITY_BUFFER_MS)) {
      return { success: true, checkoutUrl: toRelativePayUrl(current.checkout_url) }
    }
    // PAY-005: another request is minting this order's charge right now.
    if (current?.status === 'created' && isChargeInFlight(current.created_at)) {
      return { success: false, error: PAYMENT_BEING_PREPARED_MESSAGE }
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

    // The method the buyer chose is on the attempt (PAY-018): a Payssion
    // attempt re-mints on Payssion with the same pm_id; a legacy Payssion
    // attempt with no pm_id cannot be re-minted without switching rails.
    const pmId = current?.pm_id ?? null
    if (current?.provider === 'payssion' && !pmId) {
      return {
        success: false,
        error: 'This payment link is no longer available — please place the order again.',
      }
    }
    const providerName = pmId ? providerNameForMethod(pmId) : activePaymentProviderName()

    // Supersede the stale attempt (history kept), then reserve the slot for
    // the fresh one — the unique index makes two concurrent retries impossible.
    if (current) {
      const superseded = await supersedeAttempt(orderId, 'retry')
      if (!superseded.changed && superseded.reason === 'in_flight') {
        return { success: false, error: PAYMENT_BEING_PREPARED_MESSAGE }
      }
      // The replaced charge is in provider_cancel_outbox (same transaction
      // as the supersede); void it now, before the fresh one is minted.
      if (superseded.changed && superseded.providerChargeId) {
        const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
        await drainCancelOutboxForOrder(orderId)
      }
    }
    const fallbackExpiresAt = new Date(Date.now() + FALLBACK_PAYMENT_WINDOW_MS).toISOString()
    let attemptId: string
    try {
      attemptId = (await openAttempt({ orderId, provider: providerName, pmId, amountMinor: remainingMinor, fallbackExpiresAt })).attemptId
    } catch (e: any) {
      if (e?.code === '23505') return { success: false, error: PAYMENT_BEING_PREPARED_MESSAGE }
      throw e
    }

    const base = publicAppUrl()
    const provider = getProvider(providerName)
    let charge
    try {
      charge = await provider.createCharge({
        orderId,
        orderNumber: order.order_number ?? null,
        amount: money(remainingMinor, ORDER_CURRENCY),
        returnUrl:
          providerName === 'payssion'
            ? `${base}/checkout/return/${orderId}`
            : `${base}/account/orders/${orderId}?paid=1`,
        cancelUrl: `${base}/account/orders/${orderId}`,
        metadata: { listing_id: order.listing_id, retry: 'true', ...(pmId ? { pm_id: pmId } : {}) },
      })
    } catch (chargeError: any) {
      // The fresh attempt never got a charge: close it so the next retry is
      // not told "being prepared" for 90 s. The order stays pending.
      console.error(`[retryOrderPayment] ${providerName} charge creation failed (order ${orderId}):`, chargeError?.message ?? chargeError)
      await supersedeAttempt(orderId, 'charge-create-failed', { force: true }).catch(() => {})
      return { success: false, error: PROVIDER_UNAVAILABLE_MESSAGE }
    }
    // Relative for the same reason as createCheckout: never pin an origin.
    const payUrl =
      providerName === 'btcpay' ? `/checkout/pay/${orderId}` : charge.checkoutUrl

    const expiresAt = charge.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    let activated
    try {
      activated = await activateAttempt({ attemptId, providerChargeId: charge.providerChargeId, checkoutUrl: payUrl, expiresAt })
    } catch (activateError) {
      console.error(`[retryOrderPayment] attempt ${attemptId} could not be activated (charge ${charge.providerChargeId}):`, activateError)
      return { success: false, error: PAYMENT_BEING_PREPARED_MESSAGE }
    }
    if (activated.orphaned) {
      console.warn(`[retryOrderPayment] charge ${charge.providerChargeId} minted for a closed attempt ${attemptId} — queued for void`)
      const { drainCancelOutboxForOrder } = await import('@/lib/payments/cancel-outbox')
      await drainCancelOutboxForOrder(orderId)
      return { success: false, error: PAYMENT_BEING_PREPARED_MESSAGE }
    }

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

// ─── Checkout B3 helpers ─────────────────────────────────────────────────────

/** subtotal + marketplace fee + method fee − promo, in minor units (never below 0). */
function totalMinorFor(subtotal: number, marketplaceFee: number, promoDiscount: number, methodFeeMinor: number): bigint {
  const minor =
    fromDecimal(subtotal.toFixed(2), ORDER_CURRENCY).amountMinor +
    fromDecimal(marketplaceFee.toFixed(2), ORDER_CURRENCY).amountMinor +
    BigInt(methodFeeMinor) -
    fromDecimal(promoDiscount.toFixed(2), ORDER_CURRENCY).amountMinor
  return minor < 0n ? 0n : minor
}

/** The requested method must be one the page would have shown; otherwise the refusal names why. */
function pickMethod(
  eligibility: Awaited<ReturnType<typeof eligibleMethods>>,
  method: string,
): { ok: true; method: EligibleMethod } | { ok: false; error: string } {
  const hit = eligibility.methods.find((m) => m.method === method)
  if (hit) return { ok: true, method: hit }
  const refused = eligibility.refused.find((r) => r.method === method)
  return { ok: false, error: buyerFeeRefusalMessage(refused?.reason, refused?.label ?? 'That payment method') }
}
