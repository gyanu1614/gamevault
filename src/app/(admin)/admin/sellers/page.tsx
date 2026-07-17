/**
 * V54 — /admin/sellers server wrapper.
 *
 * Fetches the default applications page (page 1, no status filter) plus
 * the five stat counts ON THE SERVER via the same getSellerApplications
 * action the client uses, and seeds the client component's react-query
 * caches via initialData. The page ships fully rendered — no client-side
 * "Loading applications..." pass on refresh — while filters, pagination
 * and refetches keep working client-side exactly as before.
 */

import { getSellerApplications } from '@/lib/actions/admin-seller-review'
import SellersPageClient from './_components/SellersPageClient'

export const metadata = { title: 'Seller Applications' }

export default async function AdminSellersPage() {
  const [allResult, pendingResult, changesResult, approvedResult, rejectedResult, restrictedResult] = await Promise.all([
    getSellerApplications({ page: 1, limit: 20 }),
    getSellerApplications({ page: 1, limit: 1, status: ['pending'] }),
    getSellerApplications({ page: 1, limit: 1, status: ['info_requested'] }),
    getSellerApplications({ page: 1, limit: 1, status: ['approved'] }),
    getSellerApplications({ page: 1, limit: 1, status: ['rejected'] }),
    getSellerApplications({ page: 1, limit: 1, status: ['restricted'] }),
  ])

  const statsReady = [allResult, pendingResult, changesResult, approvedResult, rejectedResult, restrictedResult]
    .every((r) => r.success)

  return (
    <SellersPageClient
      // On a failed fetch, pass undefined so the client falls back to its
      // own fetch (with the original loading state) instead of caching a
      // failed result as fresh data.
      initialApplications={allResult.success ? allResult : undefined}
      initialStats={
        statsReady
          ? {
              total: allResult.pagination?.total || 0,
              pending: pendingResult.pagination?.total || 0,
              changes: changesResult.pagination?.total || 0,
              approved: approvedResult.pagination?.total || 0,
              rejected: rejectedResult.pagination?.total || 0,
              restricted: restrictedResult.pagination?.total || 0,
            }
          : undefined
      }
    />
  )
}
