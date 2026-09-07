'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getMyWithdrawableBalance } from '@/lib/actions/wallet-ledger'
import { PAYOUT_MIN_USD, round2 } from '@/lib/fees'
import { validatePayoutAddress } from '@/lib/crypto/address-validation'

// Types
export interface WithdrawalMethod {
  id: string
  method_name: string
  display_name: string
  method_type: 'fiat' | 'crypto'
  /** Asset ticker — btc | eth | usdt | usdc. Null for fiat. */
  coin?: string | null
  /** Settlement network — bitcoin | ethereum | tron | polygon. Null for fiat.
   *  Derived from the method, never entered by the seller. */
  chain?: string | null
  /** Rendered as unavailable rather than hidden (fiat, for now). */
  coming_soon?: boolean | null
  fee_percentage: number
  fee_fixed: number
  fee_currency: string
  min_withdrawal: number
  max_withdrawal: number
  processing_time: string
  icon_name: string
  description: string
  is_active: boolean
}

export interface WithdrawalRequest {
  id: string
  user_id: string
  amount: number
  method_id: string
  method_name: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'cancelled' | 'failed'
  fee_amount: number
  net_amount: number
  payment_details: Record<string, any>
  admin_notes?: string
  /** On-chain proof, set when an admin marks the payout sent. */
  transaction_hash?: string | null
  approved_at?: string | null
  rejected_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

// 1. Get available withdrawal methods
export async function getWithdrawalMethods(): Promise<{
  success: boolean
  methods?: WithdrawalMethod[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Include coming-soon rails: they render disabled with a "Coming soon"
    // label rather than disappearing. A payout method a seller has used
    // before silently vanishing reads as a fault, not a roadmap.
    const { data, error } = await supabase
      .from('withdrawal_methods')
      .select('*')
      .or('is_active.eq.true,coming_soon.eq.true')
      .order('sort_order', { ascending: true })
      .order('method_type', { ascending: true })

    if (error) throw error

    return { success: true, methods: data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 2. Calculate withdrawal fee
export async function calculateWithdrawalFee(
  amount: number,
  methodId: string
): Promise<{
  success: boolean
  fee?: number
  net?: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .rpc('calculate_withdrawal_fee', {
        p_amount: amount,
        p_method_id: methodId
      } as any)
      .single()

    if (error) throw error

    return {
      success: true,
      fee: (data as any).fee_amount,
      net: (data as any).net_amount
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 3. Create withdrawal request
export async function createWithdrawalRequest(params: {
  amount: number
  methodId: string
  paymentDetails: Record<string, any>
}): Promise<{
  success: boolean
  requestId?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Amount must be a real, sane money value before anything else touches
    // it — NaN/Infinity would sail through the comparisons below and reach
    // the ledger.
    const amount = Number(params.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Enter a valid amount.' }
    }
    // "At most 2 decimal places" — compare against a 2-dp rounding, NOT
    // `Math.round(amount*100) === amount*100`. Float multiplication makes
    // `64.01 * 100 === 6401.0000000000001`, so the old exact-equality guard
    // wrongly rejected ~12% of valid 2-decimal amounts.
    if (round2(amount) !== amount) {
      return { success: false, error: 'Amount can have at most 2 decimal places.' }
    }

    // Platform-wide payout minimum (lib/fees — single source of truth; the
    // per-method min_withdrawal rows mirror it).
    if (amount < PAYOUT_MIN_USD) {
      return { success: false, error: `Minimum withdrawal is $${PAYOUT_MIN_USD}` }
    }

    // One open request at a time. Without this a seller can submit N requests
    // against the same balance faster than an admin can review them; each
    // holds funds separately, but the queue fills with duplicates and the
    // review workload multiplies.
    const { count: openCount } = await supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved', 'processing'])

    if ((openCount ?? 0) > 0) {
      return {
        success: false,
        error: 'You already have a withdrawal in progress. Wait for it to complete or cancel it first.',
      }
    }

    // Balance check against the LEDGER (seller_available + wallet credit) —
    // the legacy wallet_balances float table is no longer written to.
    const balanceResult = await getMyWithdrawableBalance()
    if (!balanceResult.success || !balanceResult.balance) {
      return { success: false, error: balanceResult.error || 'Failed to check balance' }
    }
    if (balanceResult.balance.total < amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    // Get method details
    const { data: method } = await supabase
      .from('withdrawal_methods' as any)
      .select('*')
      .eq('id', params.methodId)
      .single()

    if (!method) throw new Error('Invalid withdrawal method')

    const methodRow = method as any
    if (methodRow.is_active === false) {
      return { success: false, error: 'That withdrawal method isn’t available yet.' }
    }

    // Crypto sends are irreversible, so the destination is validated here —
    // server-side and authoritative — not just in the browser. A live row in
    // this table reads { method_name: "btc", network: "Trc20",
    // wallet_address: "$sejsjsjwjh28383" }: Bitcoin over Tron, to junk. Both
    // faults were accepted, and approving it would have destroyed the funds.
    if (methodRow.method_type === 'crypto') {
      const details = params.paymentDetails ?? {}
      const address = String(details.wallet_address ?? '').trim()
      const chain = String(details.network ?? '').trim().toLowerCase()
      const coin = String(methodRow.coin ?? methodRow.method_name ?? '')
        .trim()
        .toLowerCase()

      const check = validatePayoutAddress(coin, chain, address)
      if (!check.valid) {
        return { success: false, error: check.error || 'Invalid wallet address.' }
      }

      // Persist only the fields we validated — never the raw client object,
      // which could otherwise smuggle extra keys into the admin's view.
      params = {
        ...params,
        paymentDetails: { wallet_address: address, network: chain, coin },
      }
    }

    // Calculate fees
    const feeCalc = await calculateWithdrawalFee(amount, params.methodId)
    if (!feeCalc.success) throw new Error(feeCalc.error)

    // Create request
    const serviceClient = createServiceRoleClient()
    const { data: request, error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount,
        method_id: params.methodId,
        method_name: (method as any).method_name,
        fee_amount: feeCalc.fee,
        fee_percentage: (method as any).fee_percentage,
        net_amount: feeCalc.net,
        payment_details: params.paymentDetails,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    const requestId = (request as any).id as string

    // HOLD the funds in the ledger (seller_available / user_wallet →
    // payout_clearing, idempotent on 'withdrawal:<requestId>') so a pending
    // withdrawal can't also be spent at checkout. If the hold fails (e.g. a
    // concurrent spend drained the balance), the request must not survive.
    const { error: debitError } = await (serviceClient.rpc as any)('withdrawal_debit', {
      p_user_id: user.id,
      p_amount_minor: Math.round(amount * 100),
      p_idempotency_key: `withdrawal:${requestId}`,
    })
    if (debitError) {
      await (serviceClient as any)
        .from('withdrawal_requests')
        .delete()
        .eq('id', requestId)
      return { success: false, error: 'Insufficient balance' }
    }

    return { success: true, requestId }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 4. Get user's withdrawal requests
export async function getMyWithdrawalRequests(): Promise<{
  success: boolean
  requests?: WithdrawalRequest[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('withdrawal_requests' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, requests: data as any }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 5. Cancel pending withdrawal request
export async function cancelWithdrawalRequest(requestId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: cancelled, error } = await (supabase as any)
      .from('withdrawal_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id')

    if (error) throw error

    // Release the ledger hold (payout_clearing → original sources) so the
    // funds are spendable again. Idempotent per request; only when this call
    // actually flipped pending → cancelled (a replay must not double-post —
    // the RPC's idempotency key guarantees it regardless).
    if (cancelled?.length) {
      const serviceClient = createServiceRoleClient()
      const { error: reversalError } = await (serviceClient.rpc as any)(
        'withdrawal_reversal',
        { p_request_id: requestId }
      )
      if (reversalError) {
        // The request is cancelled but the hold is still standing — surface
        // loudly; the reversal is idempotent and can be re-run by support.
        console.error(
          `[Withdrawals] CRITICAL: hold reversal failed for cancelled request ${requestId}:`,
          reversalError
        )
      }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ADMIN FUNCTIONS

// 6. Get all withdrawal requests (admin)
export async function getAllWithdrawalRequests(filters?: {
  status?: string
  method?: string
}): Promise<{
  success: boolean
  requests?: any[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('withdrawal_requests' as any)
      .select(`
        *,
        user:profiles!withdrawal_requests_user_id_fkey(username, email, avatar_url),
        method:withdrawal_methods(display_name, icon_name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.method) {
      query = query.eq('method_name', filters.method)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, requests: data as any }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 7. Approve withdrawal request (admin)
export async function approveWithdrawalRequest(params: {
  requestId: string
  adminNotes?: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // SECURITY: admin-only. Gate on admin_roles BEFORE switching to the
    // RLS-bypassing service-role client. Previously this only checked
    // "is logged in", letting any user self-approve their own cash-out.
    const admin = await requireAdmin()

    // Ledger note: the funds were already moved into payout_clearing when
    // the request was created (withdrawal_debit). Approval flips status only;
    // the payout_clearing → external journal posts when ops actually sends
    // the money (marking the request completed — separate flow).
    const serviceClient = createServiceRoleClient()
    const { data: updatedRows, error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        processed_by: admin.userId,
        admin_notes: params.adminNotes
      })
      .eq('id', params.requestId)
      .eq('status', 'pending')
      .select('user_id, amount, method_id, method_name')

    if (error) throw error

    // Tell the user their withdrawal was approved (in-app + email).
    // Awaited but isolated: comms failures must never fail the approval.
    const request = updatedRows?.[0]
    if (request) {
      await (async () => {
        const [{ data: profile }, { data: method }] = await Promise.all([
          serviceClient
            .from('profiles')
            .select('email, username, full_name')
            .eq('id', request.user_id)
            .single() as any,
          (serviceClient as any)
            .from('withdrawal_methods')
            .select('display_name')
            .eq('id', request.method_id)
            .single(),
        ])
        const methodName =
          method?.display_name || request.method_name || 'your withdrawal method'
        const amount = Number(request.amount) || 0

        const { error: notifError } = await (serviceClient as any)
          .from('notifications')
          .insert({
            user_id: request.user_id,
            type: 'withdrawal_approved',
            title: 'Withdrawal Approved',
            message: `$${amount.toFixed(2)} → ${methodName} — processing.`,
            link: '/account/wallet',
            is_read: false,
          })
        if (notifError) throw notifError

        if (profile?.email) {
          const { sendWithdrawalProcessedEmail } = await import('@/lib/email')
          await sendWithdrawalProcessedEmail({
            to: profile.email,
            name: profile.full_name || profile.username || 'Gamer',
            amount,
            method: methodName,
            status: 'approved',
          })
        }
      })().catch((err) => console.error('[Withdrawals] Approval comms failed:', err))
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 8. Reject withdrawal request (admin)
export async function rejectWithdrawalRequest(params: {
  requestId: string
  reason: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // SECURITY: admin-only. Gate on admin_roles BEFORE switching to the
    // RLS-bypassing service-role client. Previously this only checked
    // "is logged in", letting any user grief others' pending withdrawals.
    const admin = await requireAdmin()

    const serviceClient = createServiceRoleClient()
    const { data: updatedRows, error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        processed_by: admin.userId,
        admin_notes: params.reason
      })
      .eq('id', params.requestId)
      .eq('status', 'pending')
      .select('user_id, amount, method_id, method_name')

    if (error) throw error

    // Release the ledger hold (payout_clearing → original sources) so the
    // ":funds remain in your wallet" message below is TRUE. Idempotent per
    // request ('withdrawal_reversal:<requestId>').
    if (updatedRows?.length) {
      const { error: reversalError } = await (serviceClient.rpc as any)(
        'withdrawal_reversal',
        { p_request_id: params.requestId }
      )
      if (reversalError) {
        console.error(
          `[Withdrawals] CRITICAL: hold reversal failed for rejected request ${params.requestId}:`,
          reversalError
        )
      }
    }

    // Tell the user their withdrawal was declined (in-app + email).
    // Awaited but isolated: comms failures must never fail the decision.
    const request = updatedRows?.[0]
    if (request) {
      await (async () => {
        const [{ data: profile }, { data: method }] = await Promise.all([
          serviceClient
            .from('profiles')
            .select('email, username, full_name')
            .eq('id', request.user_id)
            .single() as any,
          (serviceClient as any)
            .from('withdrawal_methods')
            .select('display_name')
            .eq('id', request.method_id)
            .single(),
        ])
        const methodName =
          method?.display_name || request.method_name || 'your withdrawal method'
        const amount = Number(request.amount) || 0

        const { error: notifError } = await (serviceClient as any)
          .from('notifications')
          .insert({
            user_id: request.user_id,
            type: 'withdrawal_rejected',
            title: 'Withdrawal Declined',
            message: `$${amount.toFixed(2)} — ${params.reason}. Funds stay in your wallet.`,
            link: '/account/wallet',
            is_read: false,
          })
        if (notifError) throw notifError

        if (profile?.email) {
          const { sendWithdrawalProcessedEmail } = await import('@/lib/email')
          await sendWithdrawalProcessedEmail({
            to: profile.email,
            name: profile.full_name || profile.username || 'Gamer',
            amount,
            method: methodName,
            status: 'rejected',
            reason: params.reason,
          })
        }
      })().catch((err) => console.error('[Withdrawals] Rejection comms failed:', err))
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
