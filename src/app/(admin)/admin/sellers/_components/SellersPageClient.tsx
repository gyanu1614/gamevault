'use client'

/**
 * /admin/sellers page client (account-section design, 2026-09-30).
 *
 * Page header, status tabs with live counts (SegmentedTabs: All / Pending /
 * Changes / Approved / Rejected / Restricted — URL-driven as before), then
 * fill-only store rows (ApplicationsTable) and pagination. Filtering,
 * react-query caching and server seeding are unchanged from V54.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSellerApplications } from '@/lib/actions/admin-seller-review'
import ApplicationsTable from '../ApplicationsTable'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { AdminLoadingRows, AdminPagination, PageHeader } from '../../components/kit'

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

  const activeKey = tabs.find((t) => t.key === statusFilter)?.label ?? 'All'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Seller Applications"
        description="Open an application to review it and decide."
        className="mb-0 sm:mb-0"
      />

      <SegmentedTabs
        tabs={tabs.map((tab) => ({
          id: tab.label,
          label: (
            <>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && <TabCount n={tab.count} />}
            </>
          ),
        }))}
        value={activeKey}
        onChange={(label) => handleStatusFilter(tabs.find((t) => t.label === label)?.key ?? null)}
        layoutId="admin-applications-tabs"
        ariaLabel="Application status"
      />

      {isLoading ? (
        <AdminLoadingRows rows={8} />
      ) : (
        <>
          <ApplicationsTable applications={applications} />
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPage={setCurrentPage}
            noun="applications"
          />
        </>
      )}
    </div>
  )
}
