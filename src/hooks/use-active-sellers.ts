import { useQuery } from '@tanstack/react-query'
import { getActiveSellers, getSellerStats } from '@/lib/actions/admin-active-sellers'

export function useActiveSellers(filters?: {
  status?: 'active' | 'restricted' | 'banned' | 'warning' | 'suspended'
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  searchQuery?: string
  sortBy?: 'sales' | 'earnings' | 'rating' | 'listings' | 'joined' | 'activity'
  sortOrder?: 'asc' | 'desc'
}) {
  return useQuery({
    queryKey: ['active-sellers', filters],
    queryFn: async () => {
      const result = await getActiveSellers(filters)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.sellers || []
    },
    staleTime: 30000, // 30 seconds
  })
}

export function useSellerStats() {
  return useQuery({
    queryKey: ['seller-stats'],
    queryFn: async () => {
      const result = await getSellerStats()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.stats
    },
    staleTime: 60000, // 1 minute
  })
}
