/**
 * V54 — /admin/sellers server wrapper.
 *
 * Fetches the default applications page (page 1, no status filter) plus
 * the tab counts ON THE SERVER via the same actions the client uses, and
 * seeds the client component's react-query caches via initialData. The page ships fully rendered — no client-side
 * "Loading applications..." pass on refresh — while filters, pagination
 * and refetches keep working client-side exactly as before.
 */

import { getSellerApplicationCounts, getSellerApplications } from '@/lib/actions/admin-seller-review'
import SellersPageClient from './_components/SellersPageClient'

export const metadata = { title: 'Seller Applications' }

export default async function AdminSellersPage() {
  const [allResult, counts] = await Promise.all([
    getSellerApplications({ page: 1, limit: 20 }),
    // A failed count falls back to the client's own fetch.
    getSellerApplicationCounts().catch(() => undefined),
  ])

  return (
    <SellersPageClient
      // On a failed fetch, pass undefined so the client falls back to its
      // own fetch (with the original loading state) instead of caching a
      // failed result as fresh data.
      initialApplications={allResult.success ? allResult : undefined}
      initialStats={counts}
    />
  )
}
