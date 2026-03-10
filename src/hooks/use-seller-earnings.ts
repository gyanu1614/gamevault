/**
 * Seller Earnings Hook
 * Manages earnings, transactions, and payouts for sellers
 */

import { useQuery } from '@tanstack/react-query'
import { earningsApi, EarningsStats, Transaction, Payout } from '@/lib/api/seller-compatible'

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

  // Fetch transaction history
  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useQuery<Transaction[]>({
    queryKey: ['seller', 'earnings', 'transactions'],
    queryFn: () => earningsApi.getTransactions(),
  })

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
    transactions: transactions || [],
    isLoadingTransactions,
    transactionsError,
    payouts: payouts || [],
    isLoadingPayouts,
    payoutsError,
    isLoading: isLoadingStats || isLoadingTransactions || isLoadingPayouts,
  }
}
