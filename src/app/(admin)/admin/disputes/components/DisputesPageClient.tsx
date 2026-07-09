'use client'

/**
 * V54 — /admin/disputes client page.
 *
 * Former page.tsx body, moved here so the route's page.tsx can be a thin
 * server component that pre-fetches the default disputes list + stats and
 * seeds the react-query caches via initialData. The page ships fully
 * rendered on refresh; filters, pagination and refetches keep their
 * existing client-side flow.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDisputes, getDisputeStats } from '@/lib/actions/admin-disputes'
import { DisputesTable } from './disputes-table'
import { DisputeFilters } from './dispute-filters'
import { StatsCards } from './stats-cards'

type DisputesResult = Awaited<ReturnType<typeof getDisputes>>
type DisputeStatsResult = Awaited<ReturnType<typeof getDisputeStats>>

interface DisputesPageClientProps {
  /** Server-fetched default view (page 1, no filters) — seeds react-query. */
  initialDisputes?: DisputesResult
  initialStats?: DisputeStatsResult
}

function DisputesContent({ initialDisputes, initialStats }: DisputesPageClientProps) {
  const searchParams = useSearchParams()

  const filters = {
    status: searchParams.getAll('status') as any[],
    priority: searchParams.getAll('priority') as any[],
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: 20,
  }

  // V54 — Only the default view (page 1, no filters) is server-seeded.
  // Filtered/paginated views keep today's client-side fetch + spinner.
  const isDefaultView =
    filters.status.length === 0 &&
    filters.priority.length === 0 &&
    !filters.search &&
    filters.page === 1

  // Fetch disputes
  const { data: disputesData, isLoading: disputesLoading } = useQuery({
    queryKey: ['disputes', filters],
    queryFn: async () => await getDisputes(filters),
    // V54 — Server-seeded: initialData counts as fresh for staleTime, so
    // the initial render never hits the loading branch and there's no
    // immediate client refetch. Mutations invalidate + refetch as before.
    ...(isDefaultView && initialDisputes !== undefined
      ? { initialData: initialDisputes, staleTime: 60_000 }
      : {}),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['dispute-stats'],
    queryFn: async () => await getDisputeStats(),
    ...(initialStats !== undefined
      ? { initialData: initialStats, staleTime: 60_000 }
      : {}),
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary">Disputes</h1>
          <p className="text-[13.5px] text-text-secondary mt-0.5">Manage and resolve buyer-seller disputes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />

      {/* Filters */}
      <DisputeFilters />

      {/* Disputes Table */}
      {disputesLoading ? (
        <div className="rounded-xl border border-border-default bg-bg-raised p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-lime border-r-transparent"></div>
            <p className="text-sm text-text-tertiary mt-3">Loading disputes...</p>
          </div>
        </div>
      ) : (
        <DisputesTable
          disputes={(disputesData?.success ? disputesData.disputes : []) || []}
          pagination={(disputesData?.success ? disputesData.pagination : null) || null}
        />
      )}
    </div>
  )
}

export default function DisputesPageClient(props: DisputesPageClientProps) {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary">Disputes</h1>
            <p className="text-[13.5px] text-text-secondary mt-0.5">Manage and resolve buyer-seller disputes</p>
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
      <DisputesContent {...props} />
    </Suspense>
  )
}
