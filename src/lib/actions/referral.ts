'use server'

import { createClient } from '@/lib/supabase/server'
import type { ReferralEarning } from '@/types/database'

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
    .single() as any

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

  const { error: updateError } = await (supabase
    .from('profiles')
    .update as any)({ referral_code: newCode })
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
    .single() as any

  if (!data) return { valid: false }
  return { valid: true, referrerId: data.id, referrerUsername: (data as any).username }
}

// ── Money paths moved (AUTH-008) ─────────────────────────────────────────────
// applyReferralAtSignup / recordReferralCommission live in
// `@/lib/referral/commission` (server-only, service role, amounts read from
// the orders row). They are deliberately NOT exported from this 'use server'
// module — every export here is a publicly invokable action.

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
    .filter((e: any) => e.status === 'pending')
    .reduce((sum: number, e: any) => sum + e.amount, 0)

  const totalEarned = earningsData
    .filter((e: any) => e.status === 'paid')
    .reduce((sum: number, e: any) => sum + e.amount, 0)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const thisMonthEarned = earningsData
    .filter((e: any) => e.status === 'paid' && new Date(e.created_at) >= startOfMonth)
    .reduce((sum: number, e: any) => sum + e.amount, 0)

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
