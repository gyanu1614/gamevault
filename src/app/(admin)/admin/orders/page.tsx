/**
 * V54 — /admin/orders server wrapper.
 *
 * Fetches the default Orders-tab list + stats cards ON THE SERVER (same
 * server actions the client uses) and seeds the client component's
 * react-query caches via initialData. The page ships fully rendered —
 * no "Loading orders..." pass on refresh — while tabs, filters,
 * pagination and mutations keep their client-side flow.
 */

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { isActionResponseRender } from '@/lib/admin/action-render'
import { getOrders, getOrderStats } from '@/lib/actions/admin-orders'
import OrdersPageClient from './components/OrdersPageClient'

export const metadata = { title: 'Orders' }

export default async function AdminOrdersPage() {
  await requireAdmin()

  if (isActionResponseRender()) return <OrdersPageClient />

  // Default view only: page 1, no filters. Filtered/paginated/other-tab
  // fetches stay client-side exactly as before.
  const [initialOrders, initialStats] = await Promise.all([
    getOrders({ page: 1, limit: 20 }),
    getOrderStats(),
  ])

  return (
    <OrdersPageClient
      initialOrders={initialOrders}
      initialStats={initialStats}
    />
  )
}
