'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getOrders, getOrderStats, type OrderStatus, type EscrowStatus } from '@/lib/actions/admin-orders'
import { getPendingCancellationRequests } from '@/lib/actions/order-cancellation'
import { OrdersTable } from './components/orders-table'
import { OrderFilters } from './components/order-filters'
import { StatsCards } from './components/stats-cards'
import { CancellationRequestsTable } from './components/cancellation-requests-table'
import { DisputesTable } from './components/disputes-table'
import { Package, Ban, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'orders' | 'cancellations' | 'disputes'

function OrdersContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'orders')

  const filters = {
    status: searchParams.getAll('status') as OrderStatus[],
    escrowStatus: searchParams.getAll('escrowStatus') as EscrowStatus[],
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: 20,
  }

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: async () => await getOrders(filters),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['admin-order-stats'],
    queryFn: async () => await getOrderStats(),
  })

  // Fetch cancellation requests
  const { data: cancellationsData, isLoading: cancellationsLoading } = useQuery({
    queryKey: ['admin-cancellation-requests'],
    queryFn: async () => await getPendingCancellationRequests(),
    enabled: activeTab === 'cancellations',
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage orders, cancellations, and disputes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'orders'
              ? 'border-violet-500 text-violet-400'
              : 'border-transparent text-gray-500 hover:text-gray-400'
          )}
        >
          <Package className="w-4 h-4" />
          Orders
        </button>
        <button
          onClick={() => setActiveTab('cancellations')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative',
            activeTab === 'cancellations'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-500 hover:text-gray-400'
          )}
        >
          <Ban className="w-4 h-4" />
          Cancel Requests
          {cancellationsData?.data && cancellationsData.data.length > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {cancellationsData.data.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('disputes')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'disputes'
              ? 'border-red-500 text-red-400'
              : 'border-transparent text-gray-500 hover:text-gray-400'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          Disputes
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'orders' && (
        <>
          <OrderFilters />
          {ordersLoading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-violet-500 border-r-transparent"></div>
                <p className="text-sm text-gray-500 mt-3">Loading orders...</p>
              </div>
            </div>
          ) : (
            <OrdersTable
              orders={(ordersData?.success ? ordersData.orders : []) || []}
              pagination={(ordersData?.success ? ordersData.pagination : null) || null}
            />
          )}
        </>
      )}

      {activeTab === 'cancellations' && (
        <CancellationRequestsTable
          requests={cancellationsData?.data || []}
          isLoading={cancellationsLoading}
        />
      )}

      {activeTab === 'disputes' && (
        <DisputesTable />
      )}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and manage all platform orders</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-violet-500 border-r-transparent"></div>
            <p className="text-sm text-gray-500 mt-3">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
}
