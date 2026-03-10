/**
 * Seller Analytics Hook
 * Fetches analytics data and top performing listings
 */

import { useQuery } from '@tanstack/react-query'
import { analyticsApi, DashboardStats, Listing } from '@/lib/api/seller-compatible'

export function useSellerAnalytics() {
  // Fetch dashboard stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStats>({
    queryKey: ['seller', 'analytics', 'stats'],
    queryFn: () => analyticsApi.getDashboardStats(),
  })

  // Fetch top performing listings
  const {
    data: topListings,
    isLoading: topListingsLoading,
    error: topListingsError,
  } = useQuery<Listing[]>({
    queryKey: ['seller', 'analytics', 'top-listings'],
    queryFn: () => analyticsApi.getTopListings(5),
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
    topListings: topListings || [],
    isLoading: statsLoading || topListingsLoading,
    error: statsError || topListingsError,
  }
}
