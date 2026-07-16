'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getMyWithdrawableBalance } from '@/lib/actions/wallet-ledger'
import { PAYOUT_MIN_USD } from '@/lib/fees'

// Types
export interface WithdrawalMethod {
  id: string
  method_name: string
  display_name: string
  method_type: 'fiat' | 'crypto'
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

    const { data, error } = await supabase
      .from('withdrawal_methods')
      .select('*')
      .eq('is_active', true)
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

    // Platform-wide payout minimum (lib/fees — single source of truth; the
    // per-method min_withdrawal rows mirror it).
    if (params.amount < PAYOUT_MIN_USD) {
      return { success: false, error: `Minimum withdrawal is $${PAYOUT_MIN_USD}` }
    }

    // Balance check against the LEDGER (seller_available + wallet credit) —
    // the legacy wallet_balances float table is no longer written to.
    const balanceResult = await getMyWithdrawableBalance()
    if (!balanceResult.success || !balanceResult.balance) {
      return { success: false, error: balanceResult.error || 'Failed to check balance' }
    }
    if (balanceResult.balance.total < params.amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    // Get method details
    const { data: method } = await supabase
      .from('withdrawal_methods' as any)
      .select('*')
      .eq('id', params.methodId)
      .single()

    if (!method) throw new Error('Invalid withdrawal method')

    // Calculate fees
    const feeCalc = await calculateWithdrawalFee(params.amount, params.methodId)
    if (!feeCalc.success) throw new Error(feeCalc.error)

    // Create request
    const serviceClient = createServiceRoleClient()
    const { data: request, error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount: params.amount,
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
      p_amount_minor: Math.round(params.amount * 100),
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
            message: `Your $${amount.toFixed(2)} withdrawal was approved and is being processed to ${methodName}.`,
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
            message: `Your $${amount.toFixed(2)} withdrawal was declined: ${params.reason}. The funds remain in your wallet balance.`,
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
