import 'server-only'

/**
 * The wallet and withdrawal pages' reads, for a user the caller already
 * authenticated. These pages used to load through a queue of server actions,
 * one at a time, each signing the user in again; a server page now runs these
 * together in one request. Never expose them as actions: the caller's identity
 * is the argument.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalMethod, WithdrawalRequest } from '@/lib/actions/withdrawals'
import { revealPayoutSecret } from '@/lib/crypto/payout-encryption'
import { createServiceRoleClient } from '@/lib/supabase/service'

const minor = (v: unknown) => Number(v ?? 0) / 100

/** wallet_available_balance: what a seller holds and whether they may withdraw. */
export async function readWalletOverview(userId: string): Promise<WalletOverview> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('wallet_available_balance', { p_seller_id: userId })
  if (error) throw new Error(`wallet_available_balance failed: ${error.message}`)
  const d = data as any
  return {
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
      message: typeof d.gate?.message === 'string' ? d.gate.message : null,
      sellerSince: d.gate?.seller_since ?? null,
      unlockAt: d.gate?.unlock_at ?? null,
      freezeUntil: d.gate?.freeze_until ?? null,
      minAgeDays: Number(d.gate?.min_age_days ?? 30),
    },
    completionHoldHours: Number(d.completion_hold_hours ?? 24),
    disputeWindowDays: Number(d.dispute_window_days ?? 7),
  }
}

/** The owner's saved destination. Decrypted here, so only for the owner. */
export async function readPayoutDetails(userId: string): Promise<PayoutDetails> {
  const service = createServiceRoleClient() as any
  const [{ data: row }, { data: settings }] = await Promise.all([
    service.from('seller_payout_details').select('*').eq('seller_id', userId).maybeSingle(),
    service.from('platform_fee_settings').select('payout_details_freeze_hours').eq('id', true).maybeSingle(),
  ])
  const changed = row?.details_changed_at ? new Date(row.details_changed_at) : null
  const freezeHours = Number(settings?.payout_details_freeze_hours ?? 24)
  return {
    cryptoCoin: row?.crypto_coin ?? null,
    cryptoChain: row?.crypto_chain ?? null,
    cryptoAddress: revealPayoutSecret(row?.crypto_address_enc ?? row?.crypto_address_plain),
    payoneerEmail: revealPayoutSecret(row?.payoneer_email_enc ?? row?.payoneer_email_plain),
    detailsChangedAt: changed?.toISOString() ?? null,
    freezeUntil: changed ? new Date(changed.getTime() + freezeHours * 3_600_000).toISOString() : null,
    freezeHours,
  }
}

/** Open rails plus coming-soon ones: a rail a seller has used should not vanish. */
export async function readWithdrawalMethods(client: SupabaseClient<any, any, any, any, any>): Promise<WithdrawalMethod[]> {
  const { data, error } = await client
    .from('withdrawal_methods')
    .select('*')
    .or('is_active.eq.true,coming_soon.eq.true')
    .order('sort_order', { ascending: true })
    .order('method_type', { ascending: true })
  if (error) throw error
  return (data ?? []) as WithdrawalMethod[]
}

export async function readWithdrawalRequests(
  client: SupabaseClient<any, any, any, any, any>,
  userId: string,
): Promise<WithdrawalRequest[]> {
  const { data, error } = await client
    .from('withdrawal_requests')
    // The name a seller knows the method by; method_name is the internal key.
    .select('*, method:withdrawal_methods!withdrawal_requests_method_id_fkey(display_name, coin)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WithdrawalRequest[]
}

export interface SellerEarningsSummary {
  /** Payouts from completed orders. */
  totalEarned: number
  thisMonth: number
  /** Payouts on orders still in flight. */
  pendingSales: number
}

/** One database call for the wallet's headline numbers. */
export async function readSellerEarnings(userId: string): Promise<SellerEarningsSummary> {
  const { data, error } = await (createServiceRoleClient().rpc as any)('seller_earnings_summary', { p_seller_id: userId })
  if (error) throw new Error(`seller_earnings_summary failed: ${error.message}`)
  return {
    totalEarned: Number(data?.total_earned ?? 0),
    thisMonth: Number(data?.this_month ?? 0),
    pendingSales: Number(data?.pending_sales ?? 0),
  }
}

/** Everything cashed out or on its way: what "Withdrawn" has always counted. */
export function withdrawnTotal(requests: Pick<WithdrawalRequest, 'amount' | 'status'>[]): number {
  const counted = new Set(['pending', 'approved', 'processing', 'completed'])
  return requests.reduce((sum, r) => (counted.has(r.status) ? sum + (Number(r.amount) || 0) : sum), 0)
}
