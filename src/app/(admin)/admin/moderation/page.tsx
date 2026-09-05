/**
 * /admin/moderation server wrapper.
 *
 * Fetches the pending-listing queue + moderation stats ON THE SERVER
 * (same server actions the client uses) and seeds the client component
 * via props. The page ships fully rendered — no client-side "Loading
 * moderation queue…" pass on refresh. When either server fetch fails,
 * `fetchFailed` tells the client to show a real error state (with a
 * retry) instead of a fake "All Caught Up" empty queue.
 */

import { getPendingListings, getModerationStats } from '@/lib/actions/moderation'
import ModerationPageClient from './_components/ModerationPageClient'

export const metadata = { title: 'Moderation' }

export default async function ModerationQueuePage() {
  const [listingsResult, statsResult] = await Promise.all([
    getPendingListings(),
    getModerationStats(),
  ])

  const fetchFailed = !listingsResult.success || !statsResult.success

  return (
    <ModerationPageClient
      initialListings={listingsResult.success ? listingsResult.listings ?? [] : []}
      initialStats={statsResult.success ? statsResult.stats ?? null : null}
      fetchFailed={fetchFailed}
    />
  )
}
