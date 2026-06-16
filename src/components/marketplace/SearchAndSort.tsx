'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function SearchAndSort() {
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
    <div className="flex items-center gap-2 w-full">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 min-w-0 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          placeholder="Search listings..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-bg-raised border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-lime-tint-border transition-all"
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

      {/* Sort */}
      <select
        value={sortValue}
        onChange={(e) => handleSortChange(e.target.value)}
        className="flex-shrink-0 px-3 py-2 bg-bg-raised border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500/60 cursor-pointer transition-all appearance-none pr-8"
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
