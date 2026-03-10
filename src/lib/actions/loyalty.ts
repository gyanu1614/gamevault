'use server'

/**
 * P5.2 — Buyer Loyalty & Cashback
 *
 * Every completed order earns the buyer 2% of their order subtotal as store
 * credits (loyalty_balance on their profile). Credits are tracked in the
 * loyalty_credits ledger.
 *
 * Rate is configurable via LOYALTY_CASHBACK_RATE env var (default 0.02 = 2%).
 */

import { createClient } from '@/lib/supabase/server'
import type { LoyaltyCredit } from '@/types/database'

const LOYALTY_CASHBACK_RATE = parseFloat(
  process.env.LOYALTY_CASHBACK_RATE || '0.02'
)

export interface LoyaltyStats {
  balance: number
  lifetimeCashbackEarned: number
  pendingFromOrders: number         // orders delivered but not yet confirmed
  thisMonthEarned: number
  recentCredits: LoyaltyCredit[]
}

// ── Internal: award cashback on order completion ──────────────────────────────

/**
 * Award cashback to a buyer when their order completes.
 * Called fire-and-forget from confirmOrderReceipt().
 * Safe to call multiple times — idempotent per order_id.
 */
export async function awardCashback(params: {
  userId: string
  orderId: string
  subtotal: number
}): Promise<void> {
  const { userId, orderId, subtotal } = params

  if (subtotal <= 0) return

  try {
    const supabase = await createClient()

    // Idempotency: skip if an 'earned' credit already exists for this order
    const { data: existing } = await supabase
      .from('loyalty_credits')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'earned')
      .maybeSingle()

    if (existing) return   // already awarded

    const cashbackAmount = parseFloat((subtotal * LOYALTY_CASHBACK_RATE).toFixed(2))
    if (cashbackAmount <= 0) return

    // Fetch current balance
    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('loyalty_balance, lifetime_cashback_earned')
      .eq('id', userId)
      .single()
    const profile = profileRaw as any

    const currentBalance      = profile?.loyalty_balance          ?? 0
    const currentLifetime     = profile?.lifetime_cashback_earned ?? 0
    const newBalance          = parseFloat((currentBalance + cashbackAmount).toFixed(2))
    const newLifetime         = parseFloat((currentLifetime + cashbackAmount).toFixed(2))

    // Insert ledger entry (cast: Supabase narrow-select inference returns `never`)
    await supabase.from('loyalty_credits').insert({
      user_id:      userId,
      order_id:     orderId,
      type:         'earned',
      amount:       cashbackAmount,
      balance_after: newBalance,
      description:  `${(LOYALTY_CASHBACK_RATE * 100).toFixed(0)}% cashback on order`,
    } as any)

    // Update profile balance (cast: Supabase narrow-select inference returns `never`)
    await (supabase.from('profiles') as any)
      .update({
        loyalty_balance:          newBalance,
        lifetime_cashback_earned: newLifetime,
      })
      .eq('id', userId)
  } catch (err) {
    console.error('[loyalty] awardCashback error:', err)
  }
}

// ── Public: fetch stats for the dashboard page ────────────────────────────────

export async function getLoyaltyStats(): Promise<{
  success: boolean
  data?: LoyaltyStats
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Profile balance
    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('loyalty_balance, lifetime_cashback_earned')
      .eq('id', user.id)
      .single()
    const profile = profileRaw as any

    const balance               = profile?.loyalty_balance          ?? 0
    const lifetimeCashbackEarned = profile?.lifetime_cashback_earned ?? 0

    // This-month earned (type = 'earned', created_at >= start of current month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: monthRaw } = await supabase
      .from('loyalty_credits')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'earned')
      .gte('created_at', startOfMonth.toISOString())

    const thisMonthEarned = (monthRaw as any[] | null)?.reduce(
      (sum, r) => sum + (r.amount ?? 0), 0
    ) ?? 0

    // Pending: orders in status 'paid'/'delivering' for this buyer (not yet confirmed → cashback not yet awarded)
    const { data: pendingOrdersRaw } = await supabase
      .from('orders')
      .select('subtotal')
      .eq('buyer_id', user.id)
      .in('status', ['paid', 'delivering'])
    const pendingFromOrders = parseFloat(
      ((pendingOrdersRaw as any[] | null)?.reduce(
        (sum, o) => sum + (o.subtotal ?? 0) * LOYALTY_CASHBACK_RATE, 0
      ) ?? 0).toFixed(2)
    )

    // Recent credits (last 50)
    const { data: creditsRaw } = await supabase
      .from('loyalty_credits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const recentCredits = (creditsRaw as LoyaltyCredit[] | null) ?? []

    return {
      success: true,
      data: {
        balance,
        lifetimeCashbackEarned,
        pendingFromOrders,
        thisMonthEarned,
        recentCredits,
      },
    }
  } catch (err: any) {
    console.error('[loyalty] getLoyaltyStats error:', err)
    return { success: false, error: err.message || 'Failed to load loyalty data' }
  }
}

// ── Public: get just the balance (lightweight, for checkout display) ──────────

export async function getLoyaltyBalance(): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('loyalty_balance')
      .eq('id', user.id)
      .single()
    return (profileRaw as any)?.loyalty_balance ?? 0
  } catch {
    return 0
  }
}
