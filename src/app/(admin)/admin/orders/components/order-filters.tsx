'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { IconSearch, IconFilter, IconX } from '@tabler/icons-react'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'blue' },
  { value: 'processing', label: 'Processing', color: 'amber' },
  { value: 'paid', label: 'Paid', color: 'green' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'refunded', label: 'Refunded', color: 'orange' },
]

const ESCROW_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'blue' },
  { value: 'held', label: 'Held', color: 'amber' },
  { value: 'released', label: 'Released', color: 'green' },
  { value: 'refunded', label: 'Refunded', color: 'red' },
]

export function OrderFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')

  const selectedStatuses = searchParams.getAll('status')
  const selectedEscrow = searchParams.getAll('escrowStatus')

  const updateFilters = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      params.delete(key)
      if (value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else {
          params.set(key, value)
        }
      }
    })

    params.delete('page') // Reset to page 1
    router.push(`?${params.toString()}`)
  }, [searchParams, router])

  const toggleFilter = (type: 'status' | 'escrowStatus', value: string) => {
    const current = type === 'status' ? selectedStatuses : selectedEscrow
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]

    updateFilters({ [type]: newValues.length > 0 ? newValues : null })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchInput || null })
  }

  const clearAllFilters = () => {
    setSearchInput('')
    router.push('/admin/orders')
  }

  const hasActiveFilters = selectedStatuses.length > 0 || selectedEscrow.length > 0 || searchInput

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order number, buyer, seller, or listing..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                updateFilters({ search: null })
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <IconX className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-sm font-medium border border-violet-500/20 transition-colors"
        >
          Search
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-white rounded-lg text-sm font-medium border border-white/[0.08] transition-colors"
          >
            Clear All
          </button>
        )}
      </form>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          {STATUS_OPTIONS.map((option) => {
            const isSelected = selectedStatuses.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => toggleFilter('status', option.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  isSelected
                    ? option.color === 'green' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : option.color === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : option.color === 'blue' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : option.color === 'red' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                    : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:bg-white/[0.04] hover:text-gray-300'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {/* Escrow Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Escrow:</span>
          {ESCROW_OPTIONS.map((option) => {
            const isSelected = selectedEscrow.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => toggleFilter('escrowStatus', option.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  isSelected
                    ? option.color === 'green' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : option.color === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : option.color === 'blue' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:bg-white/[0.04] hover:text-gray-300'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
