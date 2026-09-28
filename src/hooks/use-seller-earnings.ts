/**
 * Seller Earnings Hook
 * Earnings stats and payout history for sellers
 */

import { useQuery } from '@tanstack/react-query'
import { earningsApi, EarningsStats, Payout } from '@/lib/api/seller-compatible'

export function useSellerEarnings() {
  // Fetch earnings statistics
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery<EarningsStats>({
    queryKey: ['seller', 'earnings', 'stats'],
    queryFn: () => earningsApi.getStats(),
  })

  // (No transaction-history query: nothing read it, and it held up the
  // wallet's loading state on every visit. The wallet builds its own Sales
  // list; earningsApi.getTransactions is still there if a page needs it.)

  // Fetch payout history
  const {
    data: payouts,
    isLoading: isLoadingPayouts,
    error: payoutsError,
  } = useQuery<Payout[]>({
    queryKey: ['seller', 'earnings', 'payouts'],
    queryFn: () => earningsApi.getPayouts(),
  })

  return {
    stats: stats || {
      total_earnings: 0,
      pending_balance: 0,
      available_balance: 0,
      total_payouts: 0,
      this_month_earnings: 0,
    },
    isLoadingStats,
    statsError,
    payouts: payouts || [],
    isLoadingPayouts,
    payoutsError,
    isLoading: isLoadingStats || isLoadingPayouts,
  }
}
