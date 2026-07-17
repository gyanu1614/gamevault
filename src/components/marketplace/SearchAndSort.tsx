'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function SearchAndSort({
  filtersSlot,
}: {
  /** Mobile-audit — optional slot (the Filters toggle) rendered on the
   *  second mobile row next to the sort select. Hidden at sm+ where the
   *  caller renders its own copy inline. */
  filtersSlot?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '')
  const [sortValue, setSortValue] = useState(searchParams.get('sort') || 'newest')

  // Update URL when sort changes
  const handleSortChange = (newSort: string) => {
    setSortValue(newSort)
    const params = new URLSearchParams(searchParams.toString())

    if (newSort && newSort !== 'newest') {
      params.set('sort', newSort)
    } else {
      params.delete('sort')
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())

    if (searchValue.trim()) {
      params.set('search', searchValue.trim())
    } else {
      params.delete('search')
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  // Clear search
  const clearSearch = () => {
    setSearchValue('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    // Mobile-audit — stacked below sm: search takes a full-width first
    // line, Filters (slot) + sort share the second, so the input never
    // shrinks to ~90px at 360px. One row again at sm+.
    <div className="flex flex-wrap items-center gap-2 w-full">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative order-1 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          placeholder="Search listings..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-bg-raised border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-tint-bg focus:border-lime-tint-border transition-all"
        />
        {searchValue && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {/* Filters slot — mobile second row only (sm+ caller renders it inline) */}
      {filtersSlot ? <div className="order-2 sm:hidden">{filtersSlot}</div> : null}

      {/* Sort */}
      <select
        value={sortValue}
        onChange={(e) => handleSortChange(e.target.value)}
        className="order-3 min-w-0 flex-1 px-3 py-2 bg-bg-raised border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-lime-tint-bg focus:border-lime-tint-border cursor-pointer transition-all appearance-none pr-8 sm:order-none sm:flex-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
      >
        <option value="newest" className="bg-zinc-900">Newest First</option>
        <option value="popular" className="bg-zinc-900">Most Popular</option>
        <option value="price_low" className="bg-zinc-900">Price: Low → High</option>
        <option value="price_high" className="bg-zinc-900">Price: High → Low</option>
        <option value="rating" className="bg-zinc-900">Highest Rated</option>
      </select>
    </div>
  )
}
