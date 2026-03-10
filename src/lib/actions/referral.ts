'use server'

import { createClient } from '@/lib/supabase/server'
import type { ReferralEarning } from '@/types/database'

// ── Commission config ────────────────────────────────────────────────────────
// Referrer earns this % of the platform fee when a referred user completes an order
const REFERRAL_COMMISSION_RATE = 0.10   // 10% of platform fee
const REFERRAL_SIGNUP_BONUS    = 0       // $0 signup bonus (can enable later)

// ── Types ────────────────────────────────────────────────────────────────────
export interface ReferralStats {
  referralCode:     string
  totalReferrals:   number
  pendingEarnings:  number
  totalEarned:      number
  thisMonthEarned:  number
  recentEarnings:   ReferralEarning[]
}

// ── Get or generate referral code for the current user ──────────────────────
export async function getMyReferralCode(): Promise<{
  success: boolean
  code?: string
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('referral_code, username')
    .eq('id', user.id)
    .single()

  if (error || !profile) return { success: false, error: 'Profile not found' }

  // Code should already exist via DB trigger — but generate one if somehow missing
  if (profile.referral_code) {
    return { success: true, code: profile.referral_code }
  }

  // Fallback: generate and save
  const username = (profile as any).username ?? 'USR'
  const prefix   = (username as string).replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
  const suffix   = Math.random().toString(36).substring(2, 8).toUpperCase()
  const newCode  = `${prefix}${suffix}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referral_code: newCode })
    .eq('id', user.id)

  if (updateError) return { success: false, error: 'Failed to generate referral code' }
  return { success: true, code: newCode }
}

// ── Validate a referral code (public — used at signup) ──────────────────────
export async function validateReferralCode(code: string): Promise<{
  valid: boolean
  referrerId?: string
  referrerUsername?: string
}> {
  if (!code?.trim()) return { valid: false }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('referral_code', code.trim().toUpperCase())
    .single()

  if (!data) return { valid: false }
  return { valid: true, referrerId: data.id, referrerUsername: (data as any).username }
}

// ── Apply referral at signup — set referred_by on the new user's profile ────
export async function applyReferralAtSignup(
  newUserId:  string,
  referralCode: string
): Promise<void> {
  if (!referralCode?.trim()) return

  const supabase = await createClient()

  // Look up referrer
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode.trim().toUpperCase())
    .single()

  if (!referrer || referrer.id === newUserId) return  // invalid or self-referral

  // Set referred_by on the new user's profile
  await supabase
    .from('profiles')
    .update({ referred_by: referrer.id })
    .eq('id', newUserId)

  // If signup bonus is configured, credit referrer immediately
  if (REFERRAL_SIGNUP_BONUS > 0) {
    await supabase.from('referral_earnings').insert({
      referrer_id:      referrer.id,
      referred_user_id: newUserId,
      type:             'signup_bonus',
      amount:           REFERRAL_SIGNUP_BONUS,
      status:           'paid',
      paid_at:          new Date().toISOString(),
    })
  }
}

// ── Record a purchase commission when a referred user completes an order ─────
// Called from the order completion webhook / server action
export async function recordReferralCommission(params: {
  referredUserId: string
  orderId:        string
  platformFee:    number
}): Promise<void> {
  const { referredUserId, orderId, platformFee } = params
  if (!referredUserId || platformFee <= 0) return

  const supabase = await createClient()

  // Check if this user was referred
  const { data: profile } = await supabase
    .from('profiles')
    .select('referred_by')
    .eq('id', referredUserId)
    .single()

  const referrerId = (profile as any)?.referred_by
  if (!referrerId) return

  // Don't double-credit the same order
  const { data: existing } = await supabase
    .from('referral_earnings')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'purchase_commission')
    .single()

  if (existing) return  // already recorded

  const commission = parseFloat((platformFee * REFERRAL_COMMISSION_RATE).toFixed(2))
  if (commission <= 0) return

  await supabase.from('referral_earnings').insert({
    referrer_id:      referrerId,
    referred_user_id: referredUserId,
    order_id:         orderId,
    type:             'purchase_commission',
    amount:           commission,
    status:           'pending',
  })
}

// ── Get referral stats for the current user ──────────────────────────────────
export async function getReferralStats(): Promise<{
  success: boolean
  data?:   ReferralStats
  error?:  string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Get referral code
  const codeResult = await getMyReferralCode()
  if (!codeResult.success || !codeResult.code) {
    return { success: false, error: codeResult.error }
  }

  // Count total unique users referred
  const { count: totalReferrals } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', user.id)

  // Earnings aggregates
  const { data: earnings } = await supabase
    .from('referral_earnings')
    .select('*')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const earningsData = (earnings ?? []) as ReferralEarning[]

  const pendingEarnings = earningsData
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0)

  const totalEarned = earningsData
    .filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const thisMonthEarned = earningsData
    .filter(e => e.status === 'paid' && new Date(e.created_at) >= startOfMonth)
    .reduce((sum, e) => sum + e.amount, 0)

  return {
    success: true,
    data: {
      referralCode:    codeResult.code,
      totalReferrals:  totalReferrals ?? 0,
      pendingEarnings,
      totalEarned,
      thisMonthEarned,
      recentEarnings:  earningsData.slice(0, 20),
    },
  }
}
