'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function DisputeFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/admin/disputes?${params.toString()}`)
  }

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams)
    const currentStatus = params.getAll('status')

    if (currentStatus.includes(status)) {
      params.delete('status')
      currentStatus.filter(s => s !== status).forEach(s => params.append('status', s))
    } else {
      params.append('status', status)
    }
    params.delete('page')
    router.push(`/admin/disputes?${params.toString()}`)
  }

  const handlePriorityFilter = (priority: string) => {
    const params = new URLSearchParams(searchParams)
    const currentPriority = params.getAll('priority')

    if (currentPriority.includes(priority)) {
      params.delete('priority')
      currentPriority.filter(p => p !== priority).forEach(p => params.append('priority', p))
    } else {
      params.append('priority', priority)
    }
    params.delete('page')
    router.push(`/admin/disputes?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch('')
    router.push('/admin/disputes')
  }

  const activeFiltersCount = searchParams.getAll('status').length + searchParams.getAll('priority').length + (searchParams.get('search') ? 1 : 0)

  const statusOptions = [
    { value: 'open', label: 'Open', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'under_review', label: 'Under Review', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'escalated', label: 'Escalated', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { value: 'awaiting_seller_response', label: 'Awaiting Seller', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { value: 'awaiting_buyer_response', label: 'Awaiting Buyer', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ]

  const priorityOptions = [
    { value: 'urgent', label: 'Urgent', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { value: 'high', label: 'High', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { value: 'normal', label: 'Normal', color: 'border-border-strong bg-bg-overlay text-text-secondary' },
    { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ]

  return (
    <div className="rounded-xl border border-border-default bg-bg-raised p-4">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, buyer, or seller..."
              className="w-full pl-9 pr-3 py-2 bg-bg-base border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none transition-colors"
            />
          </div>
        </form>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 rounded-lg border border-border-default bg-bg-overlay hover:bg-bg-raised-hover text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-lime-pressed text-text-inverse rounded-full min-w-[18px] text-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-2 rounded-lg border border-border-default bg-bg-overlay hover:bg-bg-raised-hover text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-3">
          {/* Status Filters */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((option) => {
                const isActive = searchParams.getAll('status').includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => handleStatusFilter(option.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      isActive
                        ? option.color
                        : "bg-bg-overlay text-text-tertiary border-border-default hover:bg-bg-raised-hover hover:text-text-secondary"
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Priority Filters */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Priority</p>
            <div className="flex flex-wrap gap-1.5">
              {priorityOptions.map((option) => {
                const isActive = searchParams.getAll('priority').includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => handlePriorityFilter(option.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      isActive
                        ? option.color
                        : "bg-bg-overlay text-text-tertiary border-border-default hover:bg-bg-raised-hover hover:text-text-secondary"
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
