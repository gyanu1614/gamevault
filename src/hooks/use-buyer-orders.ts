/**
 * Buyer Orders Hook
 * Fetches and manages buyer purchase orders
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerOrdersApi, Order, OrderStatus } from '@/lib/api/seller-compatible'

interface UseOrdersOptions {
  status?: OrderStatus
  search?: string
}

export function useBuyerOrders(options?: UseOrdersOptions) {
  const queryClient = useQueryClient()

  // Fetch orders
  const {
    data: orders,
    isLoading,
    error,
  } = useQuery<Order[]>({
    queryKey: ['buyer', 'orders', options],
    queryFn: () => buyerOrdersApi.getAll(options),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  return {
    orders: orders || [],
    isLoading,
    error,
  }
}

// Hook for a single order
export function useBuyerOrder(id: string | null) {
  const { data, isLoading, error } = useQuery<Order | null>({
    queryKey: ['buyer', 'order', id],
    queryFn: () => (id ? buyerOrdersApi.getById(id) : null),
    enabled: !!id,
  })

  return {
    order: data,
    isLoading,
    error,
  }
}
