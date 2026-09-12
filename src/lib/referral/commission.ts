/**
 * Referral money paths — server-only library code (AUTH-008).
 *
 * These two functions used to be exported from the `'use server'` module
 * `actions/referral.ts`, which made them directly invokable actions:
 * `recordReferralCommission` trusted a caller-supplied `platformFee`, and
 * `applyReferralAtSignup` inserted a signup bonus with no dedupe. Both now run
 * under the service role from trusted callers only, and every amount is read
 * from the orders row. `referral_earnings` INSERT/UPDATE are service-role only
 * at the database (20260912100000_auth_p1.sql).
 */

import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service-role'

/** Referrer earns this share of the platform fee when a referred user completes an order. */
export const REFERRAL_COMMISSION_RATE = 0.10
/** Signup bonus (major units). 0 = disabled. */
export const REFERRAL_SIGNUP_BONUS = 0

/**
 * Link a new account to the referrer whose code it signed up with.
 * Idempotent: never overwrites an existing `referred_by`, never self-refers,
 * and credits the signup bonus at most once per referred user.
 */
export async function applyReferralAtSignup(newUserId: string, referralCode: string): Promise<void> {
  const code = referralCode?.trim().toUpperCase()
  if (!code || !newUserId) return

  const svc = createServiceRoleClient()

  const { data: referrer } = await svc
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()
  const referrerId = (referrer as { id: string } | null)?.id
  if (!referrerId || referrerId === newUserId) return

  const { data: me } = await svc
    .from('profiles')
    .select('referred_by')
    .eq('id', newUserId)
    .maybeSingle()
  if ((me as { referred_by: string | null } | null)?.referred_by) return

  await (svc.from('profiles').update as any)({ referred_by: referrerId }).eq('id', newUserId)

  if (REFERRAL_SIGNUP_BONUS > 0) {
    const { data: existing } = await svc
      .from('referral_earnings')
      .select('id')
      .eq('referred_user_id', newUserId)
      .eq('type', 'signup_bonus')
      .maybeSingle()
    if (existing) return
    await (svc.from('referral_earnings').insert as any)({
      referrer_id: referrerId,
      referred_user_id: newUserId,
      type: 'signup_bonus',
      amount: REFERRAL_SIGNUP_BONUS,
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
  }
}

/**
 * Record the referrer's commission for a COMPLETED order. The amount is
 * `orders.platform_fee × REFERRAL_COMMISSION_RATE`, read from the row — the
 * caller supplies nothing but the order id. Once per order.
 */
export async function recordReferralCommission(orderId: string): Promise<void> {
  if (!orderId) return
  const svc = createServiceRoleClient()

  const { data: order } = await svc
    .from('orders')
    .select('id, buyer_id, platform_fee, status')
    .eq('id', orderId)
    .maybeSingle()
  const o = order as { id: string; buyer_id: string; platform_fee: number | null; status: string } | null
  if (!o || o.status !== 'completed') return
  const platformFee = Number(o.platform_fee ?? 0)
  if (!(platformFee > 0)) return

  const { data: profile } = await svc
    .from('profiles')
    .select('referred_by')
    .eq('id', o.buyer_id)
    .maybeSingle()
  const referrerId = (profile as { referred_by: string | null } | null)?.referred_by
  if (!referrerId) return

  const { data: existing } = await svc
    .from('referral_earnings')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'purchase_commission')
    .maybeSingle()
  if (existing) return

  const commission = Number((platformFee * REFERRAL_COMMISSION_RATE).toFixed(2))
  if (commission <= 0) return

  await (svc.from('referral_earnings').insert as any)({
    referrer_id: referrerId,
    referred_user_id: o.buyer_id,
    order_id: orderId,
    type: 'purchase_commission',
    amount: commission,
    status: 'pending',
  })
}
