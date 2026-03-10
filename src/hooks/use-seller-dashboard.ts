/**
 * Dashboard Data Hook
 * Fetches and manages dashboard statistics and insights
 */

import { useQuery } from '@tanstack/react-query'
import { analyticsApi, settingsApi, DashboardStats, SellerProfile } from '@/lib/api/seller-compatible'

export function useSellerDashboard() {
  // Fetch dashboard stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStats>({
    queryKey: ['seller', 'dashboard', 'stats'],
    queryFn: () => analyticsApi.getDashboardStats(),
  })

  // Fetch seller profile (includes tier info)
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<SellerProfile>({
    queryKey: ['seller', 'profile'],
    queryFn: () => settingsApi.getProfile(),
  })

  return {
    stats: stats || {
      earnings: {
        today: 0,
        week: 0,
        month: 0,
        allTime: 0,
      },
      listings: {
        active: 0,
        paused: 0,
        draft: 0,
        sold: 0,
      },
      orders: {
        pending: 0,
        processing: 0,
        completed: 0,
        disputed: 0,
      },
      performance: {
        totalViews: 0,
        totalSales: 0,
        conversionRate: 0,
        avgRating: 0,
      },
    },
    profile: profile || {
      id: '',
      username: '',
      seller_tier: 'bronze',
      total_sales: 0,
      seller_rating: 0,
      total_reviews: 0,
    },
    isLoading: statsLoading || profileLoading,
    error: statsError || profileError,
  }
}
