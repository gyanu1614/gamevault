'use client'

/**
 * V54 — /admin/orders client page.
 *
 * Former page.tsx body, moved here so the route's page.tsx can be a thin
 * server component that pre-fetches the default Orders-tab data + stats
 * and seeds the react-query caches via initialData. The page ships fully
 * rendered on refresh; filters, tabs, pagination and refetches keep their
 * existing client-side flow.
 */

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getOrders, getOrderStats, type OrderStatus, type EscrowStatus } from '@/lib/actions/admin-orders'
import { getPendingCancellationRequests } from '@/lib/actions/order-cancellation'
import { OrdersTable } from './orders-table'
import { OrderFilters } from './order-filters'
import { StatsCards } from './stats-cards'
import { CancellationRequestsTable } from './cancellation-requests-table'
import { DisputesTable } from './disputes-table'
import { Package, Ban, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'orders' | 'cancellations' | 'disputes'

type OrdersResult = Awaited<ReturnType<typeof getOrders>>
type OrderStatsResult = Awaited<ReturnType<typeof getOrderStats>>

interface OrdersPageClientProps {
  /** Server-fetched default view (page 1, no filters) — seeds react-query. */
  initialOrders?: OrdersResult
  initialStats?: OrderStatsResult
}

function OrdersContent({ initialOrders, initialStats }: OrdersPageClientProps) {
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

  // V54 — Only the default view (page 1, no filters) is server-seeded.
  // Filtered/paginated views keep today's client-side fetch + spinner.
  const isDefaultView =
    filters.status.length === 0 &&
    filters.escrowStatus.length === 0 &&
    !filters.search &&
    filters.page === 1

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: async () => await getOrders(filters),
    // V54 — Server-seeded: initialData counts as fresh for staleTime, so
    // the initial render never hits the loading branch and there's no
    // immediate client refetch. Mutations invalidate + refetch as before.
    ...(isDefaultView && initialOrders !== undefined
      ? { initialData: initialOrders, staleTime: 60_000 }
      : {}),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['admin-order-stats'],
    queryFn: async () => await getOrderStats(),
    ...(initialStats !== undefined
      ? { initialData: initialStats, staleTime: 60_000 }
      : {}),
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
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary">Orders Management</h1>
          <p className="text-[13.5px] text-text-secondary mt-0.5">Manage orders, cancellations, and disputes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'orders'
              ? 'border-lime text-text-primary'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
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
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          )}
        >
          <Ban className="w-4 h-4" />
          Cancel Requests
          {cancellationsData?.data && cancellationsData.data.length > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-text-inverse">
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
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
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
            <div className="rounded-xl border border-border-default bg-bg-raised p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-lime border-r-transparent"></div>
                <p className="text-sm text-text-tertiary mt-3">Loading orders...</p>
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

export default function OrdersPageClient(props: OrdersPageClientProps) {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary">Orders</h1>
            <p className="text-[13.5px] text-text-secondary mt-0.5">View and manage all platform orders</p>
          </div>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-raised p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-lime border-r-transparent"></div>
            <p className="text-sm text-text-tertiary mt-3">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <OrdersContent {...props} />
    </Suspense>
  )
}
