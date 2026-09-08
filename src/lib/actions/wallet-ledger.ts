'use server'

/**
 * Ledger-backed wallet balance actions (funds-flow cutover).
 *
 * The wallet is a read-model over the double-entry ledger:
 *   • buyer store credit  = sum of `user_wallet` entries (user_wallet_balance)
 *   • seller balance      = sum of `seller_available` entries
 *     (seller_available_balance, 20260715_ledger_payout_cutover.sql)
 *
 * The legacy src/lib/actions/wallet.ts reads the wallet_balances float table,
 * whose writes were revoked in the ledger cutover — refund credits never show
 * there. These actions are the ONLY balance source UI should use.
 *
 * Currency note: orders settle EUR; legacy genesis wallet balances are USD.
 * The UI displays a single "$" figure, so balances are summed across both
 * currencies at par (beta simplification — revisit with real FX).
 *
 * Session is derived server-side; the service-role client only ever reads the
 * CURRENT user's balances.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getWalletBalance as getLedgerWalletBalance } from '@/lib/wallet/wallet'

const WALLET_CURRENCIES = ['EUR', 'USD'] as const

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Sum a user's ledger wallet (store credit) across currencies, in major units. */
async function walletTotalMajor(userId: string): Promise<number> {
  let totalMinor = 0n
  for (const currency of WALLET_CURRENCIES) {
    totalMinor += await getLedgerWalletBalance(userId, currency)
  }
  return Number(totalMinor) / 100
}

/** Sum a user's seller_available ledger balance across currencies, major units. */
async function sellerAvailableTotalMajor(userId: string): Promise<number> {
  const service = createServiceRoleClient()
  let totalMinor = 0n
  for (const currency of WALLET_CURRENCIES) {
    const { data, error } = await (service.rpc as any)('seller_available_balance', {
      p_seller_id: userId,
      p_currency: currency,
    })
    if (error) throw new Error(`seller_available_balance failed: ${error.message}`)
    totalMinor += BigInt(data ?? 0)
  }
  return Number(totalMinor) / 100
}

export interface LedgerWalletBalance {
  /** Spendable store credit (refunds, cashback, top-ups) — ledger-derived. */
  available_balance: number
  pending_balance: number
  lifetime_earned: number
  lifetime_spent: number
  total_cashback: number
  referral_earnings: number
}

/**
 * getMyWalletBalance — the session user's store-credit balance from the
 * ledger, plus the legacy stat fields (referrals etc.) the wallet page still
 * renders, read from the old wallet_balances row (per-user SELECT RLS
 * remains). total_cashback comes from loyalty_credits — the cashback history
 * table the ledger awards write to — not the dead legacy float column.
 * Missing rows → zeros.
 */
export async function getMyWalletBalance(): Promise<{
  success: boolean
  balance?: LedgerWalletBalance
  error?: string
}> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }

    const supabase = await createClient()
    const [available, { data: legacy }, { data: cashbackRows }] = await Promise.all([
      walletTotalMajor(userId),
      supabase
        .from('wallet_balances')
        .select('pending_balance, lifetime_earned, lifetime_spent, referral_earnings')
        .eq('user_id', userId)
        .maybeSingle() as any,
      supabase
        .from('loyalty_credits')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'earned') as any,
    ])

    const totalCashback = parseFloat(
      ((cashbackRows as any[] | null) ?? [])
        .reduce((sum, r) => sum + (r.amount ?? 0), 0)
        .toFixed(2)
    )

    return {
      success: true,
      balance: {
        available_balance: available,
        pending_balance: Number(legacy?.pending_balance ?? 0),
        lifetime_earned: Number(legacy?.lifetime_earned ?? 0),
        lifetime_spent: Number(legacy?.lifetime_spent ?? 0),
        total_cashback: totalCashback,
        referral_earnings: Number(legacy?.referral_earnings ?? 0),
      },
    }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to fetch wallet balance' }
  }
}

/** getMySellerAvailableBalance — ledger seller_available for the session user. */
export async function getMySellerAvailableBalance(): Promise<{
  success: boolean
  balance?: number
  error?: string
}> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }
    return { success: true, balance: await sellerAvailableTotalMajor(userId) }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to fetch seller balance' }
  }
}

export interface WithdrawableBalance {
  /** Released sale proceeds (seller_available). */
  sellerAvailable: number
  /** Store credit (user_wallet: refunds, cashback). */
  wallet: number
  /** What a withdrawal request can draw against (sum of the two). */
  total: number
}

/**
 * getMyWithdrawableBalance — everything the withdrawal rail can draw against
 * (matches withdrawal_debit's waterfall: seller_available then user_wallet).
 */
export async function getMyWithdrawableBalance(): Promise<{
  success: boolean
  balance?: WithdrawableBalance
  error?: string
}> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }

    const [sellerAvailable, wallet] = await Promise.all([
      sellerAvailableTotalMajor(userId),
      walletTotalMajor(userId),
    ])
    return {
      success: true,
      balance: {
        sellerAvailable,
        wallet,
        total: Number((sellerAvailable + wallet).toFixed(2)),
      },
    }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to fetch balance' }
  }
}
