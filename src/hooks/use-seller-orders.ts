/**
 * Seller Orders Hook
 * Fetches seller orders. Order status only changes through the server
 * actions / RPCs (the old browser-side updateStatus / deliver writes were
 * blocked by the orders guard trigger and had no callers).
 */

import { useQuery } from '@tanstack/react-query'
import { ordersApi, Order, OrderStatus } from '@/lib/api/seller-compatible'

interface UseOrdersOptions {
  status?: OrderStatus
  search?: string
}

export function useSellerOrders(options?: UseOrdersOptions) {
  // Fetch orders
  const {
    data: orders,
    isLoading,
    error,
  } = useQuery<Order[]>({
    queryKey: ['seller', 'orders', options],
    queryFn: async () => {
      const result = await ordersApi.getAll(options)
      return result
    },
    retry: 1,
    // Like the buyer hook: a seller coming back from an order page (after
    // Mark As Delivered) sees the new status, not a cached list.
    refetchOnMount: 'always',
  })

  // Surface errors to console for debugging
  if (error) {
    console.error('[useSellerOrders] Failed to fetch seller orders:', error)
  }

  return {
    orders: orders || [],
    isLoading,
    error,
  }
}

// Hook for a single order
export function useOrder(id: string | null) {
  const { data, isLoading, error } = useQuery<Order | null>({
    queryKey: ['seller', 'order', id],
    queryFn: () => (id ? ordersApi.getById(id) : null),
    enabled: !!id,
  })

  return {
    order: data,
    isLoading,
    error,
  }
}
