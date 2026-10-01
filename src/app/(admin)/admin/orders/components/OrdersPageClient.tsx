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
import { listRefundToSourceRequests } from '@/lib/actions/refund-to-source'
import { OrdersTable } from './orders-table'
import { OrderFilters } from './order-filters'
import { StatsCards } from './stats-cards'
import { CancellationRequestsTable } from './cancellation-requests-table'
import { RefundRequestsTable } from './refund-requests-table'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { AdminLoadingRows, PageHeader } from '../../components/kit'
import { SkAdminStrip } from '../../components/AdminSkeletons'

// The old fourth "Disputes" tab was a placeholder card linking to
// /admin/disputes (the sidebar already does); it is gone.
type TabType = 'orders' | 'cancellations' | 'refunds'
const TABS: TabType[] = ['orders', 'cancellations', 'refunds']

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
  const [activeTab, setActiveTab] = useState<TabType>(tabParam && TABS.includes(tabParam) ? tabParam : 'orders')

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
  })

  // Refund-to-payment-method requests (refund policy): pending ones need a
  // decision, so the badge counts them from any tab.
  const { data: refundsData, isLoading: refundsLoading } = useQuery({
    queryKey: ['admin-refund-requests'],
    queryFn: async () => await listRefundToSourceRequests(),
  })
  const pendingRefundCount = (refundsData?.data ?? []).filter((r) => r.status === 'pending').length

  const cancelCount = cancellationsData?.data?.length ?? 0

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Every order, plus buyer cancellation and refund requests." className="mb-0 sm:mb-0" />

      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />

      <SegmentedTabs
        tabs={[
          { id: 'orders', label: 'Orders' },
          { id: 'cancellations', label: <>Cancel Requests{cancelCount > 0 && <TabCount n={cancelCount} />}</> },
          { id: 'refunds', label: <>Refund Requests{pendingRefundCount > 0 && <TabCount n={pendingRefundCount} />}</> },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        layoutId="admin-orders-tabs"
        ariaLabel="Order views"
      />

      {activeTab === 'orders' && (
        <div role="tabpanel" id="admin-orders-tabs-panel-orders" aria-labelledby="admin-orders-tabs-tab-orders" className="space-y-4">
          <OrderFilters />
          {ordersLoading ? (
            <AdminLoadingRows rows={8} />
          ) : (
            <OrdersTable
              orders={(ordersData?.success ? ordersData.orders : []) || []}
              pagination={(ordersData?.success ? ordersData.pagination : null) || null}
            />
          )}
        </div>
      )}

      {activeTab === 'cancellations' && (
        <div role="tabpanel" id="admin-orders-tabs-panel-cancellations" aria-labelledby="admin-orders-tabs-tab-cancellations">
          <CancellationRequestsTable requests={cancellationsData?.data || []} isLoading={cancellationsLoading} />
        </div>
      )}

      {activeTab === 'refunds' && (
        <div role="tabpanel" id="admin-orders-tabs-panel-refunds" aria-labelledby="admin-orders-tabs-tab-refunds">
          <RefundRequestsTable requests={(refundsData?.data as any) || []} isLoading={refundsLoading} />
        </div>
      )}
    </div>
  )
}

export default function OrdersPageClient(props: OrdersPageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <PageHeader title="Orders" description="Every order, plus buyer cancellation and refund requests." className="mb-0 sm:mb-0" />
          <SkAdminStrip count={6} lgCols="md:grid-cols-3 xl:grid-cols-6" />
          <AdminLoadingRows rows={8} />
        </div>
      }
    >
      <OrdersContent {...props} />
    </Suspense>
  )
}
