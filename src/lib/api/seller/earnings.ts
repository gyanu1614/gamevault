/**
 * Seller earnings, transactions and payouts.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { withOwnOrderFields } from '@/lib/orders/own-fields'
import type { EarningsStats, Transaction, Payout } from './types'

// =====================================================
// EARNINGS API
// =====================================================


export const earningsApi = {
  /**
   * Get earnings statistics
   */
  async getStats(): Promise<EarningsStats> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Ledger cutover: available balance comes from the internal ledger
    // (seller_available entries — already net of withdrawal holds), pending
    // from in-flight orders, withdrawn from withdrawal_requests. The old
    // "sum of completed orders" figure ignored withdrawals entirely.
    const { getMySellerAvailableBalance } = await import('@/lib/actions/wallet-ledger')

    const [{ data: completedRows }, { data: activeRows }, { data: withdrawals }, availableResult] =
      await Promise.all([
        // Paged: these are sums — a 1000-row cap would under-count them.
        fetchAllRows<any>((from, to) =>
          supabase
            .from('orders')
            .select('id, total_amount, created_at')
            .eq('seller_id', user.id)
            .eq('status', 'completed')
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<any>((from, to) =>
          supabase
            .from('orders')
            .select('id')
            .eq('seller_id', user.id)
            .in('status', ['paid', 'delivering', 'delivered', 'disputed'])
            .order('id', { ascending: true })
            .range(from, to),
        ),
        supabase
          .from('withdrawal_requests' as any)
          .select('amount, status')
          .eq('user_id', user.id)
          .in('status', ['pending', 'approved', 'processing', 'completed']) as any,
        getMySellerAvailableBalance(),
      ])

    // The payout is the seller's private column: merged in, not selected.
    const [orders, activeOrders] = await Promise.all([
      withOwnOrderFields(supabase, 'seller', completedRows || []),
      withOwnOrderFields(supabase, 'seller', activeRows || []),
    ])

    const total_earnings = (orders || []).reduce(
      (sum: number, order: any) => sum + (order.seller_payout || 0),
      0
    )

    // Calculate this month's earnings
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const this_month_earnings = (orders || [])
      .filter((order: any) => new Date(order.created_at) >= startOfMonth)
      .reduce((sum: number, order: any) => sum + (order.seller_payout || 0), 0)

    const pending_balance = (activeOrders || []).reduce(
      (sum: number, order: any) => sum + (order.seller_payout || 0),
      0
    )
    const total_payouts = (withdrawals || []).reduce(
      (sum: number, w: any) => sum + (Number(w.amount) || 0),
      0
    )

    return {
      total_earnings,
      pending_balance,
      available_balance:
        availableResult.success && availableResult.balance != null
          ? availableResult.balance
          : 0,
      total_payouts,
      this_month_earnings
    }
  },

  /**
   * Get transaction history
   */
  async getTransactions(): Promise<Transaction[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        status,
        created_at,
        buyer:profiles!buyer_id(username),
        listing:listings!listing_id(title)
      `)
      .eq('seller_id', user.id)
      .in('status', ['paid', 'delivering', 'delivered', 'disputed', 'completed', 'refunded'])
      .order('created_at', { ascending: false }) as any

    if (error) throw error

    // Fee + payout are the seller's private columns: merged in, not selected.
    const rows = await withOwnOrderFields(supabase, 'seller', (data || []) as any[])
    return rows.map((order: any) => ({
      id: order.id,
      order_id: order.id,
      order_number: order.order_number || `#${order.id.slice(0, 8)}`,
      buyer_username: order.buyer?.username || 'Unknown',
      amount: order.total_amount,
      platform_fee: order.platform_fee,
      net_amount: order.seller_payout,
      status: order.status,
      created_at: order.created_at,
      listing_title: order.listing?.title || 'N/A'
    }))
  },

  /**
   * Get the seller's withdrawal history (the real payout rail — every
   * cash-out goes through withdrawal_requests; RLS scopes to the user).
   */
  async getPayouts(): Promise<Payout[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await (supabase
      .from('withdrawal_requests' as any)
      .select('id, amount, status, method_name, created_at, processed_at, completed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50) as any)

    if (error || !data) return []

    return (data as any[]).map((w) => ({
      id: w.id,
      amount: Number(w.amount) || 0,
      status: w.status,
      method: w.method_name || 'Withdrawal',
      created_at: w.created_at,
      completed_at: w.completed_at ?? w.processed_at ?? null,
    }))
  },
}
