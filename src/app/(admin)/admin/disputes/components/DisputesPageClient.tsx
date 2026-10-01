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
import { AdminLoadingRows, PageHeader } from '../../components/kit'
import { SkAdminStrip } from '../../components/AdminSkeletons'

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
      <PageHeader title="Disputes" description="Manage and resolve buyer–seller disputes." className="mb-0 sm:mb-0" />
      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />
      <DisputeFilters />
      {disputesLoading ? (
        <AdminLoadingRows rows={8} />
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
    <Suspense
      fallback={
        <div className="space-y-5">
          <PageHeader title="Disputes" description="Manage and resolve buyer–seller disputes." className="mb-0 sm:mb-0" />
          <SkAdminStrip count={4} />
          <AdminLoadingRows rows={8} />
        </div>
      }
    >
      <DisputesContent {...props} />
    </Suspense>
  )
}
