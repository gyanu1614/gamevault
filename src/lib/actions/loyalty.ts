'use server'

/**
 * P5.2 — Buyer Loyalty & Cashback (read side)
 *
 * Cashback lives on the double-entry ledger: src/lib/loyalty/award.ts posts a
 * wallet_credit (platform_commission → user_wallet) keyed `cashback:<orderId>`,
 * so cashback is spendable at checkout like any other wallet credit. The
 * award function is intentionally NOT exported from this 'use server' module
 * — every export here is a client-invocable endpoint, and awarding mints
 * money. loyalty_credits is the display/history table; the old
 * profiles.loyalty_balance counters are dead (lost-update race, never
 * spendable).
 *
 * Rate is configurable via LOYALTY_CASHBACK_RATE env var (default 0.02 = 2%).
 */

import { createClient } from '@/lib/supabase/server'
import { getWalletBalance } from '@/lib/wallet/wallet'
import type { LoyaltyCredit } from '@/types/database'

const LOYALTY_CASHBACK_RATE = parseFloat(
  process.env.LOYALTY_CASHBACK_RATE || '0.02'
)

// Ledger is USD end-to-end (decided 2026-09-04); EUR only holds pre-switch
// legacy balances, summed at par like wallet-ledger.ts does.
const WALLET_CURRENCIES = ['USD', 'EUR'] as const

export interface LoyaltyStats {
  balance: number
  lifetimeCashbackEarned: number
  pendingFromOrders: number         // orders delivered but not yet confirmed
  thisMonthEarned: number
  recentCredits: LoyaltyCredit[]
}

/** Spendable store credit (ledger user_wallet) in major units. */
async function walletTotalMajor(userId: string): Promise<number> {
  let totalMinor = 0n
  for (const currency of WALLET_CURRENCIES) {
    totalMinor += await getWalletBalance(userId, currency)
  }
  return Number(totalMinor) / 100
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

    // Spendable balance comes from the ledger — cashback lands in the same
    // user_wallet as refund credits, so this is what checkout can spend.
    const balance = await walletTotalMajor(user.id)

    // Lifetime + this-month earned from the history table.
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: earnedRaw } = await supabase
      .from('loyalty_credits')
      .select('amount, created_at')
      .eq('user_id', user.id)
      .eq('type', 'earned')

    const earned = (earnedRaw as any[] | null) ?? []
    const lifetimeCashbackEarned = parseFloat(
      earned.reduce((sum, r) => sum + (r.amount ?? 0), 0).toFixed(2)
    )
    const thisMonthEarned = parseFloat(
      earned
        .filter((r) => r.created_at && new Date(r.created_at) >= startOfMonth)
        .reduce((sum, r) => sum + (r.amount ?? 0), 0)
        .toFixed(2)
    )

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
