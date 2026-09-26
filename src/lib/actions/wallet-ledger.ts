'use server'

/**
 * Ledger-backed wallet balance actions (funds-flow cutover).
 *
 * The wallet is a read-model over the double-entry ledger:
 *   • buyer store credit  = sum of `user_wallet` entries (user_wallet_balance)
 *   • seller balance      = sum of `seller_available` entries
 *     (seller_available_balance, 20260715_ledger_payout_cutover.sql)
 *
 * These actions are the ONLY balance source UI may use. The legacy
 * wallet_balances/wallet_transactions float tables were moved to the
 * `archive` schema by 20260904000000_financial_cleanup_dummy_era.sql and
 * must never be read again.
 *
 * Currency: the platform is single-currency USD. The one real pre-switch EUR
 * balance was FX-converted to USD in the cleanup migration, so every nonzero
 * ledger balance is USD; EUR entries remain only as immutable history.
 *
 * Session is derived server-side; the service-role client only ever reads the
 * CURRENT user's balances.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getWalletBalance as getLedgerWalletBalance } from '@/lib/wallet/wallet'

const WALLET_CURRENCIES = ['USD'] as const

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** A user's ledger wallet (store credit) in major units. */
async function walletTotalMajor(userId: string): Promise<number> {
  let totalMinor = 0n
  for (const currency of WALLET_CURRENCIES) {
    totalMinor += await getLedgerWalletBalance(userId, currency)
  }
  return Number(totalMinor) / 100
}

/** A user's seller_available ledger balance in major units. */
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
 * ledger, plus the stat tiles the wallet page renders: cashback summed from
 * loyalty_credits (the history table the ledger awards write to — the
 * profiles.lifetime_cashback_earned counter is dead) and referral earnings
 * from the referral_earnings table. Nothing reads the archived
 * wallet_balances float table.
 */
export async function getMyWalletBalance(): Promise<{
  success: boolean
  balance?: LedgerWalletBalance
  error?: string
}> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }

    const service = createServiceRoleClient()
    const [available, cashbackRes, referralRes] = await Promise.all([
      walletTotalMajor(userId),
      service
        .from('loyalty_credits')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'earned'),
      service
        .from('referral_earnings')
        .select('amount, status')
        .eq('referrer_id', userId),
    ])

    // Casts: Supabase narrow-select inference returns `never` for columns
    // missing from the handwritten Database type (same pattern as loyalty.ts).
    const totalCashback = parseFloat(
      ((cashbackRes.data ?? []) as any[])
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
        .toFixed(2)
    )
    const referralRows = (referralRes.data ?? []) as any[]
    const referralPaid = referralRows
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)

    return {
      success: true,
      balance: {
        available_balance: available,
        pending_balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
        total_cashback: totalCashback,
        referral_earnings: referralPaid,
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


// ── PR 7: the seller balance breakdown (ONE SQL function) ──────────────────
export interface WalletOverview {
  currency: string
  /** Matured, not frozen — what a withdrawal can draw on. May be negative. */
  available: number
  /** Buyer-confirmed credits still inside the completion hold. */
  pending: number
  nextMaturityAt: string | null
  /** Seller amounts of orders under dispute (post-completion). */
  frozen: number
  /** Held by open withdrawal requests. */
  locked: number
  /** Store credit (refunds, cashback) — also withdrawable. */
  wallet: number
  negative: boolean
  gate: {
    eligible: boolean
    reason: 'account_age' | 'payout_details_freeze' | null
    sellerSince: string | null
    unlockAt: string | null
    freezeUntil: string | null
    minAgeDays: number
  }
  completionHoldHours: number
  disputeWindowDays: number
}

/** getMyWalletOverview — wallet_available_balance() for the session user. */
export async function getMyWalletOverview(): Promise<{ success: boolean; overview?: WalletOverview; error?: string }> {
  try {
    const userId = await sessionUserId()
    if (!userId) return { success: false, error: 'Not authenticated' }
    const service = createServiceRoleClient()
    const { data, error } = await (service.rpc as any)('wallet_available_balance', { p_seller_id: userId, p_currency: 'USD' })
    if (error) throw new Error(`wallet_available_balance failed: ${error.message}`)
    const d = data as any
    const minor = (v: unknown) => Number(v ?? 0) / 100
    return {
      success: true,
      overview: {
        currency: String(d.currency ?? 'USD'),
        available: minor(d.available_minor),
        pending: minor(d.pending_minor),
        nextMaturityAt: d.next_maturity_at ?? null,
        frozen: minor(d.frozen_minor),
        locked: minor(d.locked_minor),
        wallet: minor(d.wallet_minor),
        negative: Boolean(d.negative),
        gate: {
          eligible: Boolean(d.gate?.eligible),
          reason: (d.gate?.reason ?? null) as WalletOverview['gate']['reason'],
          sellerSince: d.gate?.seller_since ?? null,
          unlockAt: d.gate?.unlock_at ?? null,
          freezeUntil: d.gate?.freeze_until ?? null,
          minAgeDays: Number(d.gate?.min_age_days ?? 30),
        },
        completionHoldHours: Number(d.completion_hold_hours ?? 24),
        disputeWindowDays: Number(d.dispute_window_days ?? 7),
      },
    }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to fetch balance' }
  }
}
