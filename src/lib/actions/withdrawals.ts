'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

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

    // Get user's wallet balance
    const { data: wallet } = await supabase
      .from('wallet_balances')
      .select('available_balance')
      .eq('user_id', user.id)
      .single()

    if (!wallet || (wallet as any).available_balance < params.amount) {
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

    return { success: true, requestId: (request as any).id }
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

    const { error } = await (supabase as any)
      .from('withdrawal_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (error) throw error

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const serviceClient = createServiceRoleClient()
    const { error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        processed_by: user.id,
        admin_notes: params.adminNotes
      })
      .eq('id', params.requestId)
      .eq('status', 'pending')

    if (error) throw error

    // TODO: Create notification for user

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const serviceClient = createServiceRoleClient()
    const { error } = await (serviceClient as any)
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        processed_by: user.id,
        admin_notes: params.reason
      })
      .eq('id', params.requestId)
      .eq('status', 'pending')

    if (error) throw error

    // TODO: Create notification for user

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
