'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDisputes, getDisputeStats } from '@/lib/actions/admin-disputes'
import { DisputesTable } from './components/disputes-table'
import { DisputeFilters } from './components/dispute-filters'
import { StatsCards } from './components/stats-cards'

function DisputesContent() {
  const searchParams = useSearchParams()

  const filters = {
    status: searchParams.getAll('status') as any[],
    priority: searchParams.getAll('priority') as any[],
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: 20,
  }

  // Fetch disputes
  const { data: disputesData, isLoading: disputesLoading } = useQuery({
    queryKey: ['disputes', filters],
    queryFn: async () => await getDisputes(filters),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['dispute-stats'],
    queryFn: async () => await getDisputeStats(),
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Disputes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and resolve buyer-seller disputes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={(statsData?.success ? statsData.stats : null) || null} />

      {/* Filters */}
      <DisputeFilters />

      {/* Disputes Table */}
      {disputesLoading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-violet-500 border-r-transparent"></div>
            <p className="text-sm text-gray-500 mt-3">Loading disputes...</p>
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

export default function DisputesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Disputes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and resolve buyer-seller disputes</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-violet-500 border-r-transparent"></div>
            <p className="text-sm text-gray-500 mt-3">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <DisputesContent />
    </Suspense>
  )
}
