'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSellerApplications } from '@/lib/actions/admin-seller-review'
import ApplicationsTable from '../ApplicationsTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { FileText, Clock, CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, IconChip, type ChipTone } from '../../components/kit'

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'restricted' | null

export type SellerApplicationsResult = Awaited<
  ReturnType<typeof getSellerApplications>
>

export interface SellerApplicationStats {
  total: number
  pending: number
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
      const [allResult, pendingResult, approvedResult, rejectedResult, restrictedResult] = await Promise.all([
        getSellerApplications({ page: 1, limit: 1 }),
        getSellerApplications({ page: 1, limit: 1, status: ['pending'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['approved'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['rejected'] }),
        getSellerApplications({ page: 1, limit: 1, status: ['restricted'] }),
      ])
      return {
        total: allResult.pagination?.total || 0,
        pending: pendingResult.pagination?.total || 0,
        approved: approvedResult.pagination?.total || 0,
        rejected: rejectedResult.pagination?.total || 0,
        restricted: restrictedResult.pagination?.total || 0,
      }
    },
    // V54 — Server-seeded so the stat counts paint immediately. No
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

  const statCards: {
    key: StatusFilter
    label: string
    value: number | undefined
    icon: typeof FileText
    tone: ChipTone
  }[] = [
    { key: null, label: 'Total Applications', value: statsData?.total, icon: FileText, tone: 'lime' },
    { key: 'pending', label: 'Pending Review', value: statsData?.pending, icon: Clock, tone: 'warning' },
    { key: 'approved', label: 'Approved', value: statsData?.approved, icon: CheckCircle, tone: 'success' },
    { key: 'rejected', label: 'Rejected', value: statsData?.rejected, icon: XCircle, tone: 'error' },
    { key: 'restricted', label: 'Restricted/Banned', value: statsData?.restricted, icon: ShieldAlert, tone: 'warning' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Seller Applications"
        description="Review and manage seller registration applications"
        className="mb-0"
      />

      {/* Stats Cards - Clickable Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map(({ key, label, value, icon, tone }) => {
          const active = statusFilter === key || (!statusFilter && key === null)
          return (
            <button
              key={label}
              onClick={() => handleStatusFilter(key)}
              className={cn(
                'rounded-xl border bg-bg-raised p-4 text-left transition-colors',
                active
                  ? 'border-lime'
                  : 'border-border-default hover:border-border-strong hover:bg-bg-raised-hover',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {label}
                </span>
                <IconChip icon={icon} tone={tone} size="sm" />
              </div>
              <div className="mt-1.5 text-[24px] font-extrabold tabular-nums leading-none text-text-primary">
                {value ?? '...'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Applications Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
        <div className="border-b border-border-subtle p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">
                {statusFilter === 'pending' && 'Pending Applications'}
                {statusFilter === 'approved' && 'Approved Applications'}
                {statusFilter === 'rejected' && 'Rejected Applications'}
                {statusFilter === 'restricted' && 'Restricted/Banned Sellers'}
                {!statusFilter && 'All Applications'}
              </h2>
              <p className="mt-1 text-[13px] text-text-secondary">Click on an application to view details and take action</p>
            </div>
            {statusFilter && (
              <button
                onClick={() => handleStatusFilter(null)}
                className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-lime border-r-transparent"></div>
            <p className="mt-4 text-text-secondary">Loading applications...</p>
          </div>
        ) : (
          <>
            <ApplicationsTable applications={applications} />
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
    </div>
  )
}
