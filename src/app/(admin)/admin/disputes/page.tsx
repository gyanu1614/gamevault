/**
 * V54 — /admin/disputes server wrapper.
 *
 * Fetches the default disputes list + stats ON THE SERVER (same server
 * actions the client uses) and seeds the client component's react-query
 * caches via initialData. The page ships fully rendered — no "Loading
 * disputes..." pass on refresh — while filters, pagination and
 * mutations keep their client-side flow.
 */

import { getDisputes, getDisputeStats } from '@/lib/actions/admin-disputes'
import DisputesPageClient from './components/DisputesPageClient'

export const metadata = { title: 'Disputes' }

/**
 * getDisputes/getDisputeStats call requirePermission(), which throws on
 * permission denial. Client-side that surfaced as a react-query error
 * (empty table); mirror that here by skipping the seed instead of
 * erroring the whole page. Next.js control-flow errors (redirect/
 * notFound) are re-thrown so auth redirects keep working.
 */
async function seed<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise
  } catch (err: any) {
    if (typeof err?.digest === 'string' && (err.digest.startsWith('NEXT_REDIRECT') || err.digest === 'NEXT_NOT_FOUND')) {
      throw err
    }
    return undefined
  }
}

export default async function AdminDisputesPage() {
  // Default view only: page 1, no filters. Filtered/paginated fetches
  // stay client-side exactly as before.
  const [initialDisputes, initialStats] = await Promise.all([
    seed(getDisputes({ page: 1, limit: 20 })),
    seed(getDisputeStats()),
  ])

  return (
    <DisputesPageClient
      initialDisputes={initialDisputes}
      initialStats={initialStats}
    />
  )
}
