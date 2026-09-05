import { useQuery } from '@tanstack/react-query'
import {
  getActiveSellers,
  getSellerStats,
  type ActiveSeller,
  type ActiveSellersFilters,
  type SellerStatsOverview,
} from '@/lib/actions/admin-active-sellers'

export type SellerStatsSummary = SellerStatsOverview

export function useActiveSellers(
  filters?: ActiveSellersFilters,
  options?: {
    /**
     * V54 — Server-fetched seed for the query cache so the page arrives
     * rendered (no loading flash). Only pass data fetched with the SAME
     * filters as this hook call; counts as fresh within staleTime.
     */
    initialData?: ActiveSeller[]
  },
) {
  return useQuery({
    queryKey: ['active-sellers', filters],
    queryFn: async () => {
      const result = await getActiveSellers(filters)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.sellers || []
    },
    initialData: options?.initialData,
    staleTime: 30000, // 30 seconds
  })
}

export function useSellerStats(options?: {
  /** V54 — Server-fetched seed for the query cache (see useActiveSellers). */
  initialData?: SellerStatsSummary
}) {
  return useQuery({
    queryKey: ['seller-stats'],
    queryFn: async () => {
      const result = await getSellerStats()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.stats
    },
    initialData: options?.initialData,
    staleTime: 60000, // 1 minute
  })
}
