'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin, requireRole } from '@/lib/actions/admin-permissions'

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
  /** Minimum fee per withdrawal (PR 7): fee = max(pct + fixed, fee_min). */
  fee_min?: number | null
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

// 2. Quote (PR 7): ONE SQL function computes every fee field and the first
// refusal. TS never computes a fee; the page renders exactly what the RPC
// returns and withdrawal_request() re-runs the same quote inside its
// transaction (parity is a guard test).
export interface WithdrawalQuote {
  ok: boolean
  refusal:
    | 'method_unavailable' | 'account_age' | 'payout_details_freeze' | 'negative_balance' | 'open_withdrawal'
    | 'payout_details_missing' | 'below_minimum' | 'above_maximum' | 'insufficient_available' | 'fee_exceeds_amount'
    | null
  message: string | null
  amount: number
  feePct: number
  feeFixed: number
  feeMin: number
  feeAmount: number
  net: number
  minimum: number | null
  maximum: number | null
  /** Matured seller balance + store credit, in dollars. */
  available: number
  gate: { eligible: boolean; reason: string | null; unlockAt: string | null; freezeUntil: string | null; minAgeDays: number }
}

function toQuote(q: any): WithdrawalQuote {
  const n = (v: unknown) => Number(v ?? 0)
  return {
    ok: Boolean(q?.ok),
    refusal: q?.refusal ?? null,
    message: q?.message ?? null,
    amount: n(q?.amount),
    feePct: n(q?.fee_pct),
    feeFixed: n(q?.fee_fixed),
    feeMin: n(q?.fee_min),
    feeAmount: n(q?.fee_amount),
    net: n(q?.net),
    minimum: q?.minimum == null ? null : n(q.minimum),
    maximum: q?.maximum == null ? null : n(q.maximum),
    available: n(q?.available_minor) / 100,
    gate: {
      eligible: Boolean(q?.gate?.eligible),
      reason: q?.gate?.reason ?? null,
      unlockAt: q?.gate?.unlock_at ?? null,
      freezeUntil: q?.gate?.freeze_until ?? null,
      minAgeDays: n(q?.gate?.min_age_days ?? 30),
    },
  }
}

export async function quoteWithdrawal(methodId: string, amount: number): Promise<{
  success: boolean
  quote?: WithdrawalQuote
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const amt = Number(amount)
    const { data, error } = await (createServiceRoleClient().rpc as any)('withdrawal_quote', {
      p_seller_id: user.id,
      p_method_id: methodId,
      p_amount: Number.isFinite(amt) && amt > 0 ? amt : 0,
    })
    if (error) throw error
    return { success: true, quote: toQuote(data) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Back-compat wrapper: fee + net for the session user through the quote. */
export async function calculateWithdrawalFee(
  amount: number,
  methodId: string
): Promise<{
  success: boolean
  fee?: number
  net?: number
  error?: string
}> {
  const r = await quoteWithdrawal(methodId, amount)
  if (!r.success || !r.quote) return { success: false, error: r.error }
  return { success: true, fee: r.quote.feeAmount, net: r.quote.net }
}

// 3. Create withdrawal request (PR 7): ONE RPC — advisory lock → quote →
// INSERT with every fee field snapshotted → ledger hold → deduped
// notification. The destination comes from the seller's saved payout details
// (seller_payout_details), never from the request body.
export async function createWithdrawalRequest(params: {
  amount: number
  methodId: string
  /** Ignored since PR 7 — kept so older callers still type-check. */
  paymentDetails?: Record<string, any>
}): Promise<{
  success: boolean
  requestId?: string
  quote?: WithdrawalQuote
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const amount = Number(params.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Enter a valid amount.' }
    }
    if (Math.round(amount * 100) / 100 !== amount) {
      return { success: false, error: 'Amount can have at most 2 decimal places.' }
    }

    const { data, error } = await (createServiceRoleClient().rpc as any)('withdrawal_request', {
      p_seller_id: user.id,
      p_method_id: params.methodId,
      p_amount: amount,
    })
    if (error) {
      // 23505 = the one-open-per-seller index caught a race the lock did not cover.
      if (String(error.code) === '23505') {
        return { success: false, error: 'You already have a withdrawal in progress. Wait for it to complete or cancel it first.' }
      }
      throw error
    }
    const quote = toQuote(data?.quote)
    if (!data?.requested) {
      return { success: false, quote, error: quote.message || 'This withdrawal cannot be requested right now.' }
    }

    // Email (in-app notification was written by the RPC, deduped).
    await (async () => {
      const service = createServiceRoleClient()
      const { data: profile } = await service.from('profiles').select('email, username, full_name').eq('id', user.id).single() as any
      if (profile?.email) {
        const { sendWithdrawalProcessedEmail } = await import('@/lib/email')
        await sendWithdrawalProcessedEmail({
          to: profile.email,
          name: profile.full_name || profile.username || 'Gamer',
          amount,
          method: data.display_name || data.method_name || 'your payout method',
          status: 'requested',
          net: quote.net,
          fee: quote.feeAmount,
        })
      }
    })().catch((err) => console.error('[Withdrawals] Request email failed:', err))

    return { success: true, requestId: data.request_id as string, quote }
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

    // DB-015: reversal FIRST, then the status flip — in ONE DB transaction.
    // The RPC locks the row, mirrors the hold back (payout_clearing → the
    // original sources), then flips pending → cancelled. If the ledger refuses
    // the reversal (hold already paid out) nothing changes and the user sees
    // the error instead of a "cancelled" row with the money gone. Ownership
    // (user_id) and the pending gate are enforced inside the RPC.
    const serviceClient = createServiceRoleClient()
    const { data, error } = await (serviceClient.rpc as any)('withdrawal_cancel', {
      p_request_id: requestId,
      p_user_id: user.id,
    })
    if (error) {
      console.error(`[Withdrawals] cancel failed for request ${requestId}:`, error)
      return { success: false, error: `Could not cancel this withdrawal: ${error.message}` }
    }
    if (data?.changed !== true && data?.reason === 'not_found') {
      return { success: false, error: 'Withdrawal request not found' }
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

    // PR 7: risk snapshot per row (account age, completed sales, open disputes,
    // refund rate, recent payout-detail change) from ONE SQL function.
    const service = createServiceRoleClient()
    const rows = (data ?? []) as any[]
    const sellerIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)))
    const snapshots = new Map<string, any>()
    await Promise.all(sellerIds.map(async (id) => {
      const { data: snap } = await (service.rpc as any)('withdrawal_risk_snapshot', { p_seller_id: id })
      if (snap) snapshots.set(id, snap)
    }))
    const requests = rows.map((r) => ({ ...r, risk: snapshots.get(r.user_id) ?? null }))

    return { success: true, requests }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 7. Approve withdrawal request (admin) — PR 7: ONE RPC (status flip +
// deduped notification); the email rides on top.
export async function approveWithdrawalRequest(params: {
  requestId: string
  adminNotes?: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // SECURITY: admin-only. Gate on admin_roles BEFORE switching to the
    // RLS-bypassing service-role client.
    const admin = await requireAdmin()

    // Ledger note: the funds were already moved into payout_clearing when
    // the request was created (withdrawal_request). Approval flips status only;
    // the payout_clearing → external_payout journal posts on Mark Paid.
    const serviceClient = createServiceRoleClient()
    const { data: approved, error } = await (serviceClient.rpc as any)('withdrawal_approve', {
      p_request_id: params.requestId,
      p_admin_id: admin.userId,
      p_notes: params.adminNotes ?? null,
    })
    if (error) throw error
    if (!approved?.changed) return { success: true }

    await (async () => {
      const { data: profile } = await serviceClient
        .from('profiles').select('email, username, full_name').eq('id', approved.user_id).single() as any
      if (profile?.email) {
        const { sendWithdrawalProcessedEmail } = await import('@/lib/email')
        await sendWithdrawalProcessedEmail({
          to: profile.email,
          name: profile.full_name || profile.username || 'Gamer',
          amount: Number(approved.amount) || 0,
          net: Number(approved.net_amount) || undefined,
          method: approved.display_name || approved.method_name || 'your withdrawal method',
          status: 'approved',
        })
      }
    })().catch((err) => console.error('[Withdrawals] Approval comms failed:', err))

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 8. Mark approved withdrawal as paid (admin) — PR 7: ONE RPC settles the
// ledger (withdrawal_payout) and flips to completed with the reference.
export async function markWithdrawalPaid(params: {
  requestId: string
  /** On-chain tx hash / Payoneer payment reference — proof of the send. */
  transactionHash?: string
  reference?: string
  adminNotes?: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // SECURITY: settles real money movement, so this is tighter than
    // approve/reject — support/moderator roles pass requireAdmin but must not
    // be able to record payouts. Checked BEFORE any service-role work.
    const admin = await requireRole(['admin', 'super_admin'])

    const reference = (params.reference ?? params.transactionHash ?? '').trim()
    if (!reference) {
      return { success: false, error: 'Enter the payment reference (tx hash or Payoneer reference) — it is sent to the seller.' }
    }

    const serviceClient = createServiceRoleClient()
    const { data: paid, error } = await (serviceClient.rpc as any)('withdrawal_mark_paid', {
      p_request_id: params.requestId,
      p_admin_id: admin.userId,
      p_reference: reference,
      p_notes: params.adminNotes ?? null,
    })
    if (error) {
      console.error(`[Withdrawals] mark paid failed for request ${params.requestId}:`, error)
      return { success: false, error: `Payout failed: ${error.message}` }
    }
    if (!paid?.changed) {
      // Replay of a finished payout is a success; anything else is a state error.
      if (paid?.status === 'completed') return { success: true }
      if (paid?.reason === 'not_found') return { success: false, error: 'Withdrawal request not found' }
      return { success: false, error: `Only an approved withdrawal can be marked paid — this one is ${paid?.status ?? 'unknown'}.` }
    }

    await (async () => {
      const { data: profile } = await serviceClient
        .from('profiles').select('email, username, full_name').eq('id', paid.user_id).single() as any
      if (profile?.email) {
        const { sendWithdrawalProcessedEmail } = await import('@/lib/email')
        await sendWithdrawalProcessedEmail({
          to: profile.email,
          name: profile.full_name || profile.username || 'Gamer',
          amount: Number(paid.amount) || 0,
          net: Number(paid.net_amount) || undefined,
          method: paid.display_name || paid.method_name || 'your withdrawal method',
          status: 'completed',
          txReference: paid.reference,
        })
      }
    })().catch((err) => console.error('[Withdrawals] Paid comms failed:', err))

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 9. Reject withdrawal request (admin)
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

    // DB-015: reversal FIRST, then the status flip — in ONE DB transaction
    // (withdrawal_reject RPC). A refused reversal (hold already paid out)
    // leaves the row pending and surfaces the error, so the "Funds stay in
    // your wallet" message below is only ever sent when it is TRUE.
    const serviceClient = createServiceRoleClient()
    const { data: rejected, error } = await (serviceClient.rpc as any)('withdrawal_reject', {
      p_request_id: params.requestId,
      p_admin_id: admin.userId,
      p_reason: params.reason,
    })
    if (error) {
      console.error(`[Withdrawals] reject failed for request ${params.requestId}:`, error)
      return { success: false, error: `Could not reject this withdrawal: ${error.message}` }
    }
    const updatedRows = rejected?.changed === true
      ? [{ user_id: rejected.user_id, amount: rejected.amount, method_id: rejected.method_id, method_name: rejected.method_name }]
      : []

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

        // In-app notification was written by the RPC (notify_once).
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
