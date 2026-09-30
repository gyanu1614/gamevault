'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { adminBtn, adminFieldCls, FilterChip, FilterRow } from '../../components/kit'

// Values are the orders_status_check / orders_escrow_status_check keys.
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'delivering', label: 'Delivering' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

const ESCROW_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'held', label: 'Payout Pending' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'released', label: 'Seller Paid Out' },
  { value: 'refunded', label: 'Refunded' },
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
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Order number, buyer, seller or listing"
            aria-label="Search orders"
            className={cn(adminFieldCls, 'pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                updateFilters({ search: null })
              }}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="submit" className={adminBtn.primary}>
          Search
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className={cn(adminBtn.secondary, 'hidden sm:inline-flex')}>
            Clear All
          </button>
        )}
      </form>

      <div className="space-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2 lg:space-y-0">
        <FilterRow label="Status">
          {STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              selected={selectedStatuses.includes(option.value)}
              onClick={() => toggleFilter('status', option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>

        {/* escrowStatus param/values stay — DB keys */}
        <FilterRow label="Payout">
          {ESCROW_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              selected={selectedEscrow.includes(option.value)}
              onClick={() => toggleFilter('escrowStatus', option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[12.5px] font-semibold text-text-secondary underline-offset-4 hover:text-text-primary hover:underline sm:hidden"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  )
}
