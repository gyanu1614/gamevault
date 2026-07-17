'use client'

/**
 * Forest Ledger — /admin/sellers page client (approved mockup ②).
 *
 * The list lives in a single forest frame: a forest-gradient header band
 * (title + segmented status tabs with live counts) over white ledger
 * rows on the deep-forest canvas. Filtering, react-query caching and
 * pagination are unchanged from V54 — this is a restyle:
 *   - stat cards → segmented tabs (All / Pending / Changes / Approved /
 *     Rejected / Restricted), counts from the same stats query
 *   - table → store-first white rows (ApplicationsTable)
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSellerApplications } from '@/lib/actions/admin-seller-review'
import ApplicationsTable from '../ApplicationsTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { cn } from '@/lib/utils'
import { FOREST_BG } from '../../_theme/forest'

type StatusFilter =
  | 'pending'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'restricted'
  | null

export type SellerApplicationsResult = Awaited<
  ReturnType<typeof getSellerApplications>
>

export interface SellerApplicationStats {
  total: number
  pending: number
  /** info_requested — the "Changes" tab. */
  changes: number
  approved: number
  rejected: number
  restricted: number
}

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
}

export default function SellersPageClient({
  initialApplications,
  initialStats,
}: {
  /** Server-fetched default view (page 1, no status filter); undefined if the server fetch failed. */
  initialApplications?: SellerApplicationsResult
  /** Server-fetched global stat counts; undefined if any server fetch failed. */
  initialStats?: SellerApplicationStats
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') as StatusFilter

  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState(
    // Seed pagination from the server result — the queryFn (whose side
    // effect normally populates this) does not run when initialData is used.
    () => initialApplications?.pagination ?? DEFAULT_PAGINATION,
  )

  // V54 — Only the default view (page 1, no status filter) is server-seeded;
  // filtered/paged views fetch client-side exactly as before.
  const isDefaultView = currentPage === 1 && !statusFilter

  // Fetch applications with pagination and filter
  const { data, isLoading } = useQuery({
    queryKey: ['seller-applications', currentPage, statusFilter],
    queryFn: async () => {
      const result = await getSellerApplications({
        page: currentPage,
        limit: 20,
        status: statusFilter ? [statusFilter] : undefined,
      })
      if (result.success && result.pagination) {
        setPagination(result.pagination)
      }
      return result
    },
    // V54 — Server-seeded: the default view arrives rendered (no
    // "Loading applications..." flash on refresh). initialData counts as
    // fresh for staleTime, so no immediate client refetch either.
    initialData: isDefaultView ? initialApplications : undefined,
    staleTime: isDefaultView ? 60_000 : 0,
  })

  const applications = data?.applications || []

  // Fetch global stats (all statuses)
  const { data: statsData } = useQuery({
    queryKey: ['seller-stats'],
    queryFn: async () => {
      const [
        allResult,
        pendingResult,
        changesResult,
        approvedResult,
        rejectedResult,
        restrictedResult,
      ] = await Promise.all([
        getSellerApplications({ page: 1, limit: 1 }),
        getSellerApplications({ page: 1, limit: 1, status: ['pending'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['info_requested'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['approved'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['rejected'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['restricted'] }),
      ])
      return {
        total: allResult.pagination?.total || 0,
        pending: pendingResult.pagination?.total || 0,
        changes: changesResult.pagination?.total || 0,
        approved: approvedResult.pagination?.total || 0,
        rejected: rejectedResult.pagination?.total || 0,
        restricted: restrictedResult.pagination?.total || 0,
      }
    },
    // V54 — Server-seeded so the tab counts paint immediately. No
    // staleTime override on purpose: the ['seller-stats'] key is shared
    // with useSellerStats() (different payload shape) on
    // /admin/active-sellers, and the mount refetch here is what corrects
    // the cache after cross-page navigation — same as before seeding.
    initialData: initialStats,
  })

  const handleStatusFilter = (status: StatusFilter) => {
    setCurrentPage(1)
    if (status) {
      router.push(`/admin/sellers?status=${status}`)
    } else {
      router.push('/admin/sellers')
    }
  }

  const tabs: { key: StatusFilter; label: string; count: number | undefined }[] = [
    { key: null, label: 'All', count: statsData?.total },
    { key: 'pending', label: 'Pending', count: statsData?.pending },
    { key: 'info_requested', label: 'Changes', count: statsData?.changes },
    { key: 'approved', label: 'Approved', count: statsData?.approved },
    { key: 'rejected', label: 'Rejected', count: statsData?.rejected },
    { key: 'restricted', label: 'Restricted', count: statsData?.restricted },
  ]

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/[0.09]"
      style={{ background: FOREST_BG.canvas }}
    >
      {/* Forest header band — title + segmented status tabs */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-[18px]"
        style={{ background: FOREST_BG.listHeader }}
      >
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em] text-white">
            Seller Applications
          </h2>
          <p className="mt-0.5 text-[11.5px] text-white/50">
            Click a row to review the application and decide
          </p>
        </div>

        <div className="ml-auto max-w-full overflow-x-auto">
          <div className="inline-flex gap-0.5 rounded-[9px] bg-white/10 p-[3px]">
            {tabs.map((tab) => {
              const active =
                statusFilter === tab.key || (!statusFilter && tab.key === null)
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => handleStatusFilter(tab.key)}
                  className={cn(
                    'whitespace-nowrap rounded-[7px] px-3 py-[5px] text-[11.5px] font-bold transition-colors',
                    active
                      ? 'bg-[#A3E635] text-[#0F3320]'
                      : 'text-white/60 hover:text-white',
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={cn('ml-1', active ? 'opacity-70' : 'opacity-60')}>
                      · {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="px-6 py-14 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#A3E635] border-r-transparent" />
          <p className="mt-4 text-[13px] text-white/60">Loading applications…</p>
        </div>
      ) : (
        <>
          <div className="px-3.5 pb-3.5 pt-2.5">
            <ApplicationsTable applications={applications} />
          </div>
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage}
            onPageChange={setCurrentPage}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
          />
        </>
      )}
    </div>
  )
}
