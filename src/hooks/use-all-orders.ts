/**
 * All Orders Hook
 * Fetches both sold orders (as seller) and purchased orders (as buyer)
 */

import { useQuery } from '@tanstack/react-query'
import { ordersApi, buyerOrdersApi, Order, OrderStatus } from '@/lib/api/seller-compatible'

interface UseAllOrdersOptions {
  status?: OrderStatus
  search?: string
}

export function useAllOrders(options?: UseAllOrdersOptions) {
  // Fetch orders where user is seller
  const {
    data: soldOrders,
    isLoading: isSoldLoading,
    error: soldError,
  } = useQuery<Order[]>({
    queryKey: ['orders', 'sold', options],
    queryFn: () => ordersApi.getAll(options),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Fetch orders where user is buyer
  const {
    data: purchasedOrders,
    isLoading: isPurchasedLoading,
    error: purchasedError,
  } = useQuery<Order[]>({
    queryKey: ['orders', 'purchased', options],
    queryFn: () => buyerOrdersApi.getAll(options),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  return {
    soldOrders: soldOrders || [],
    purchasedOrders: purchasedOrders || [],
    isLoading: isSoldLoading || isPurchasedLoading,
    error: soldError || purchasedError,
  }
}
