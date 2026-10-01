'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { adminBtn, adminFieldCls, FilterChip, FilterRow } from '../../components/kit'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'awaiting_seller_response', label: 'Awaiting Seller' },
  { value: 'awaiting_buyer_response', label: 'Awaiting Buyer' },
]

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

/** Search + status/priority chips, all in the URL (same params as before). */
export function DisputeFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const push = (params: URLSearchParams) => {
    params.delete('page')
    router.push(`/admin/disputes?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) params.set('search', search)
    else params.delete('search')
    push(params)
  }

  const toggle = (key: 'status' | 'priority', value: string) => {
    const params = new URLSearchParams(searchParams)
    const current = params.getAll(key)
    params.delete(key)
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    next.forEach((v) => params.append(key, v))
    push(params)
  }

  const clearFilters = () => {
    setSearch('')
    router.push('/admin/disputes')
  }

  const activeFiltersCount =
    searchParams.getAll('status').length + searchParams.getAll('priority').length + (searchParams.get('search') ? 1 : 0)

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, title, buyer, seller or listing"
            aria-label="Search disputes"
            className={cn(adminFieldCls, 'pl-9 [&::-webkit-search-cancel-button]:hidden')}
          />
        </div>
        <button type="submit" className={adminBtn.primary}>
          Search
        </button>
        {activeFiltersCount > 0 && (
          <button type="button" onClick={clearFilters} className={adminBtn.secondary} aria-label="Clear all filters">
            <X aria-hidden weight="bold" className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </form>

      <div className="space-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2 lg:space-y-0">
        <FilterRow label="Status">
          {STATUS_OPTIONS.map((o) => (
            <FilterChip key={o.value} selected={searchParams.getAll('status').includes(o.value)} onClick={() => toggle('status', o.value)}>
              {o.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Priority">
          {PRIORITY_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              selected={searchParams.getAll('priority').includes(o.value)}
              onClick={() => toggle('priority', o.value)}
            >
              {o.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>
    </div>
  )
}
