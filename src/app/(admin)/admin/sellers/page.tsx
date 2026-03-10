'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSellerApplications } from '@/lib/actions/admin-seller-review'
import ApplicationsTable from './ApplicationsTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { FileText, Clock, CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SellersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'restricted' | null

  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  })

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
  })

  const handleStatusFilter = (status: 'pending' | 'approved' | 'rejected' | 'restricted' | null) => {
    setCurrentPage(1)
    if (status) {
      router.push(`/admin/sellers?status=${status}`)
    } else {
      router.push('/admin/sellers')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Seller Applications</h1>
          <p className="text-gray-400 mt-1">Review and manage seller registration applications</p>
        </div>
      </div>

      {/* Stats Cards - Clickable Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <button
          onClick={() => handleStatusFilter(null)}
          className={cn(
            "bg-black/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6 text-left transition-all hover:scale-[1.02]",
            !statusFilter ? "border-violet-500/50 ring-2 ring-violet-500/20" : "border-white/[0.1] hover:border-white/[0.2]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Applications</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{statsData?.total ?? '...'}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />
            </div>
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('pending')}
          className={cn(
            "bg-black/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6 text-left transition-all hover:scale-[1.02]",
            statusFilter === 'pending' ? "border-yellow-500/50 ring-2 ring-yellow-500/20" : "border-white/[0.1] hover:border-white/[0.2]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Pending Review</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{statsData?.pending ?? '...'}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('approved')}
          className={cn(
            "bg-black/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6 text-left transition-all hover:scale-[1.02]",
            statusFilter === 'approved' ? "border-green-500/50 ring-2 ring-green-500/20" : "border-white/[0.1] hover:border-white/[0.2]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Approved</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{statsData?.approved ?? '...'}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('rejected')}
          className={cn(
            "bg-black/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6 text-left transition-all hover:scale-[1.02]",
            statusFilter === 'rejected' ? "border-red-500/50 ring-2 ring-red-500/20" : "border-white/[0.1] hover:border-white/[0.2]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Rejected</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{statsData?.rejected ?? '...'}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center">
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
            </div>
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('restricted')}
          className={cn(
            "bg-black/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6 text-left transition-all hover:scale-[1.02]",
            statusFilter === 'restricted' ? "border-orange-500/50 ring-2 ring-orange-500/20" : "border-white/[0.1] hover:border-white/[0.2]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Restricted/Banned</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{statsData?.restricted ?? '...'}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
            </div>
          </div>
        </button>
      </div>

      {/* Applications Table */}
      <div className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.1]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {statusFilter === 'pending' && 'Pending Applications'}
                {statusFilter === 'approved' && 'Approved Applications'}
                {statusFilter === 'rejected' && 'Rejected Applications'}
                {statusFilter === 'restricted' && 'Restricted/Banned Sellers'}
                {!statusFilter && 'All Applications'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">Click on an application to view details and take action</p>
            </div>
            {statusFilter && (
              <button
                onClick={() => handleStatusFilter(null)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
            <p className="text-gray-400 mt-4">Loading applications...</p>
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