/**
 * V54 — /admin/active-sellers server wrapper.
 *
 * Fetches the seller list + stats overview ON THE SERVER via the same
 * getActiveSellers/getSellerStats actions the client hooks use, and seeds
 * the react-query caches via initialData (threaded through
 * useActiveSellers/useSellerStats). The page ships fully rendered — no
 * "Loading active sellers..." pass on refresh — while search, filters,
 * sorting and refetches keep working client-side exactly as before.
 */

import { getActiveSellers, getSellerStats } from '@/lib/actions/admin-active-sellers'
import ActiveSellersPageClient from './_components/ActiveSellersPageClient'

export const metadata = { title: 'Active Sellers' }

export default async function AdminActiveSellersPage() {
  const [sellersResult, statsResult] = await Promise.all([
    getActiveSellers(),
    getSellerStats(),
  ])

  return (
    <ActiveSellersPageClient
      // On a failed fetch, pass undefined so the client hook falls back to
      // its own fetch (original loading/error states) instead of caching a
      // bad seed as fresh data.
      initialSellers={sellersResult.success ? sellersResult.sellers ?? [] : undefined}
      initialStats={statsResult.success ? statsResult.stats : undefined}
    />
  )
}
