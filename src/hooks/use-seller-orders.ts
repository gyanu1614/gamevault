/**
 * Seller Orders Hook
 * Fetches and manages seller orders with mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi, Order, OrderStatus } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'

interface UseOrdersOptions {
  status?: OrderStatus
  search?: string
}

export function useSellerOrders(options?: UseOrdersOptions) {
  const queryClient = useQueryClient()

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
  })

  // Surface errors to console for debugging
  if (error) {
    console.error('[useSellerOrders] Failed to fetch seller orders:', error)
  }

  // Update order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success('Order status updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update order status')
    },
  })

  // Deliver order mutation
  const deliverOrder = useMutation({
    mutationFn: ({ id, deliveryDetails }: { id: string; deliveryDetails: any }) =>
      ordersApi.deliver(id, deliveryDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      toast.success('Order delivered successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deliver order')
    },
  })

  return {
    orders: orders || [],
    isLoading,
    error,
    updateOrderStatus: updateOrderStatus.mutateAsync,
    deliverOrder: deliverOrder.mutateAsync,
    isUpdating: updateOrderStatus.isPending,
    isDelivering: deliverOrder.isPending,
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
