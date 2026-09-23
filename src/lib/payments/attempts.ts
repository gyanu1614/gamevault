/**
 * Payment attempts — the TS seam over `payment_attempts` (round B, Part 1).
 *
 * An attempt is one provider charge minted for an order. The table (and the
 * RPCs wrapped here) own the charge lifecycle:
 *
 *   created ──activate──▶ active ──▶ paid | failed | void | superseded
 *
 * One OPEN attempt (created | active) per order and one charge id per
 * provider are DB constraints, not conventions. The order's four legacy
 * columns (payment_provider, provider_charge_id, checkout_url,
 * payment_expires_at) are a write-through mirror the RPCs maintain; app code
 * READS the attempt — never those columns — on every checkout, webhook,
 * return and sweep path.
 *
 * Service-role seam: the table and every RPC are service-role only, so the
 * callers below verify order ownership on the session client first.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'

export type AttemptStatus = 'created' | 'active' | 'paid' | 'failed' | 'void' | 'superseded'

export interface PaymentAttempt {
  id: string
  order_id: string
  provider: string
  provider_charge_id: string | null
  pm_id: string | null
  checkout_url: string | null
  status: AttemptStatus
  amount_minor: number
  wallet_minor: number
  order_total_minor: number
  currency: string
  expires_at: string | null
  created_at: string
  activated_at: string | null
  closed_at: string | null
  close_reason: string | null
  paid_event_id: string | null
}

export const OPEN_STATUSES: readonly AttemptStatus[] = ['created', 'active']

export function isOpenAttempt(a: Pick<PaymentAttempt, 'status'> | null | undefined): boolean {
  return !!a && OPEN_STATUSES.includes(a.status)
}

const COLUMNS =
  'id, order_id, provider, provider_charge_id, pm_id, checkout_url, status, amount_minor, wallet_minor, order_total_minor, currency, expires_at, created_at, activated_at, closed_at, close_reason, paid_event_id'

function toAttempt(row: any): PaymentAttempt {
  return {
    ...row,
    amount_minor: Number(row.amount_minor),
    wallet_minor: Number(row.wallet_minor),
    order_total_minor: Number(row.order_total_minor),
  }
}

/** The order's OPEN attempt (created | active), or null. */
export async function openAttemptForOrder(orderId: string): Promise<PaymentAttempt | null> {
  const { data, error } = await createServiceRoleClient()
    .from('payment_attempts')
    .select(COLUMNS)
    .eq('order_id', orderId)
    .in('status', [...OPEN_STATUSES])
    .maybeSingle()
  if (error) throw new Error(`payment_attempts read failed: ${error.message}`)
  return data ? toAttempt(data) : null
}

/** Every attempt an order ever had, oldest first. */
export async function attemptsForOrder(orderId: string): Promise<PaymentAttempt[]> {
  const { data, error } = await createServiceRoleClient()
    .from('payment_attempts')
    .select(COLUMNS)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`payment_attempts read failed: ${error.message}`)
  return (data ?? []).map(toAttempt)
}

/** The attempt a provider charge id belongs to (unique per provider), or null. */
export async function attemptByCharge(provider: string, providerChargeId: string): Promise<PaymentAttempt | null> {
  const { data, error } = await createServiceRoleClient()
    .from('payment_attempts')
    .select(COLUMNS)
    .eq('provider', provider)
    .eq('provider_charge_id', providerChargeId)
    .maybeSingle()
  if (error) throw new Error(`payment_attempts read failed: ${error.message}`)
  return data ? toAttempt(data) : null
}

export interface CreatePendingOrderArgs {
  buyerId: string
  sellerId: string
  listingId: string
  quantity: number
  unitPrice: number
  subtotal: number
  platformFeeRate: number
  paymentProcessingFeeRate: number
  platformFee: number
  paymentProcessingFee: number
  totalAmount: number
  sellerPayout: number
  sellerCommissionPct: number
  sellerFeeTrace: unknown
  currency: string
  promoCodeId: string | null
  promoDiscount: number
  /** Wallet credit the buyer asked to apply, minor units (clamped in the RPC). */
  walletMinor: bigint
  provider: string
  pmId: string | null
  /** PAY-006: sweepable from birth; the provider's expiry replaces it. */
  fallbackExpiresAt: string
}

export interface CreatePendingOrderResult {
  orderId: string
  orderNumber: string | null
  /** null when the wallet covered the whole total (no provider charge). */
  attemptId: string | null
  totalMinor: bigint
  walletAppliedMinor: bigint
  chargeMinor: bigint
}

/** PostgREST error shape, re-exported for the caller's classification. */
export interface RpcError {
  code?: string
  message: string
  details?: string | null
}

/**
 * order_create_pending — order row + promo usage + wallet hold + created
 * attempt in ONE transaction. Resolves `{ error }` (not a throw) so the
 * caller can classify a 23505 by constraint name exactly as before.
 */
export async function createPendingOrder(
  a: CreatePendingOrderArgs
): Promise<{ result: CreatePendingOrderResult; error: null } | { result: null; error: RpcError }> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('order_create_pending', {
    p_buyer_id: a.buyerId,
    p_seller_id: a.sellerId,
    p_listing_id: a.listingId,
    p_quantity: a.quantity,
    p_unit_price: a.unitPrice,
    p_subtotal: a.subtotal,
    p_platform_fee_rate: a.platformFeeRate,
    p_payment_processing_fee_rate: a.paymentProcessingFeeRate,
    p_platform_fee: a.platformFee,
    p_payment_processing_fee: a.paymentProcessingFee,
    p_total_amount: a.totalAmount,
    p_seller_payout: a.sellerPayout,
    p_seller_commission_pct: a.sellerCommissionPct,
    p_seller_fee_trace: a.sellerFeeTrace,
    p_currency: a.currency,
    p_promo_code_id: a.promoCodeId,
    p_promo_discount: a.promoDiscount,
    p_wallet_minor: a.walletMinor.toString(),
    p_provider: a.provider,
    p_pm_id: a.pmId,
    p_fallback_expires_at: a.fallbackExpiresAt,
  })
  if (error) return { result: null, error: error as RpcError }
  return {
    error: null,
    result: {
      orderId: data.order_id,
      orderNumber: data.order_number ?? null,
      attemptId: data.attempt_id ?? null,
      totalMinor: BigInt(data.total_minor ?? 0),
      walletAppliedMinor: BigInt(data.wallet_applied_minor ?? 0),
      chargeMinor: BigInt(data.charge_minor ?? 0),
    },
  }
}

/** payment_attempt_open — a fresh `created` attempt for a retry. 23505 = another retry is minting. */
export async function openAttempt(args: {
  orderId: string
  provider: string
  pmId: string | null
  amountMinor: bigint
  fallbackExpiresAt: string
}): Promise<{ attemptId: string }> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('payment_attempt_open', {
    p_order_id: args.orderId,
    p_provider: args.provider,
    p_pm_id: args.pmId,
    p_amount_minor: args.amountMinor.toString(),
    p_fallback_expires_at: args.fallbackExpiresAt,
  })
  if (error) {
    const e = new Error(`payment_attempt_open failed: ${error.message}`) as Error & { code?: string }
    e.code = error.code
    throw e
  }
  return { attemptId: data.attempt_id }
}

/** payment_attempt_activate — store the provider charge; mirrors onto the order. */
export async function activateAttempt(args: {
  attemptId: string
  providerChargeId: string
  checkoutUrl: string
  expiresAt: string
}): Promise<{ changed: boolean; orphaned: boolean }> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('payment_attempt_activate', {
    p_attempt_id: args.attemptId,
    p_provider_charge_id: args.providerChargeId,
    p_checkout_url: args.checkoutUrl,
    p_expires_at: args.expiresAt,
  })
  if (error) throw new Error(`payment_attempt_activate failed: ${error.message}`)
  // orphaned: the attempt closed while the provider call was in flight; the
  // charge was queued in provider_cancel_outbox by the RPC (Part 2).
  return { changed: data?.changed === true, orphaned: data?.orphaned === true }
}

export interface SupersedeResult {
  changed: boolean
  reason?: 'no_open_attempt' | 'in_flight'
  attemptId?: string
  provider?: string
  providerChargeId?: string | null
  pmId?: string | null
}

/** payment_attempt_supersede — close the open attempt ahead of a retry. */
export async function supersedeAttempt(
  orderId: string,
  reason: string,
  opts?: { force?: boolean }
): Promise<SupersedeResult> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('payment_attempt_supersede', {
    p_order_id: orderId,
    p_reason: reason,
    p_force: opts?.force === true,
  })
  if (error) throw new Error(`payment_attempt_supersede failed: ${error.message}`)
  return {
    changed: data?.changed === true,
    reason: data?.reason,
    attemptId: data?.attempt_id ?? undefined,
    provider: data?.provider ?? undefined,
    providerChargeId: data?.provider_charge_id ?? null,
    pmId: data?.pm_id ?? null,
  }
}

export interface ExpiredAttemptRow {
  orderId: string
  attemptId: string | null
  provider: string | null
  providerChargeId: string | null
  expiresAt: string | null
}

/** expired_pending_payment_attempts — the sweep's read, oldest expiry first. */
export async function expiredPendingAttempts(cutoffIso: string, limit: number): Promise<ExpiredAttemptRow[]> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('expired_pending_payment_attempts', {
    p_cutoff: cutoffIso,
    p_limit: limit,
  })
  if (error) throw new Error(`expired_pending_payment_attempts failed: ${error.message}`)
  return ((data ?? []) as any[]).map((r) => ({
    orderId: r.order_id,
    attemptId: r.attempt_id ?? null,
    provider: r.provider ?? null,
    providerChargeId: r.provider_charge_id ?? null,
    expiresAt: r.expires_at ?? null,
  }))
}
