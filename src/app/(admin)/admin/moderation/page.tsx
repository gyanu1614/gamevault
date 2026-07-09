/**
 * V54 — /admin/moderation server wrapper.
 *
 * Fetches the pending-listing queue + moderation stats ON THE SERVER
 * (same server actions the client uses) and seeds the client component
 * via props. The page ships fully rendered — no client-side "Loading
 * moderation queue…" pass on refresh — while approve/reject/request-
 * changes actions keep their loadData() refresh flow.
 */

import { getPendingListings, getModerationStats } from '@/lib/actions/moderation'
import ModerationPageClient from './_components/ModerationPageClient'

export const metadata = { title: 'Moderation' }

export default async function ModerationQueuePage() {
  const [listingsResult, statsResult] = await Promise.all([
    getPendingListings(),
    getModerationStats(),
  ])

  return (
    <ModerationPageClient
      initialListings={listingsResult.success ? listingsResult.listings ?? [] : []}
      initialStats={statsResult.success ? statsResult.stats ?? null : null}
    />
  )
}
