'use client'

/**
 * /browse — universal marketplace browse.
 *
 * V3 reskin: GV tokens, Combobox for game/category/sort, NumberField for
 * price range, Tabs for category quick-switch, ListingCard reused. Mobile
 * filters slide in from the side via Dialog. Filter chip row shows active
 * filters with one-click clear.
 */

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X, Loader2, Package } from 'lucide-react'

import { getListings, getGames, getCategories } from '@/lib/api/listings'
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { NumberField } from '@/components/ui/number-field'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type SortBy = 'created_at' | 'price' | 'sales'

const SORT_OPTIONS: ComboboxOption[] = [
  { value: 'created_at', label: 'Newest first' },
  { value: 'price', label: 'Price: low to high' },
  { value: 'sales', label: 'Most popular' },
]

function BrowseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [gameId, setGameId] = useState(searchParams.get('game') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '')
  const [minPrice, setMinPrice] = useState<number>(
    searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : 0,
  )
  const [maxPrice, setMaxPrice] = useState<number>(
    searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : 0,
  )
  const [sortBy, setSortBy] = useState<SortBy>(
    (searchParams.get('sortBy') as SortBy) ?? 'created_at',
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: gamesData } = useQuery({ queryKey: ['games'], queryFn: getGames })
  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: listingsData, isLoading } = useQuery({
    queryKey: ['listings', { search, gameId, categoryId, minPrice, maxPrice, sortBy }],
    queryFn: () =>
      getListings({
        search: search || undefined,
        gameId: gameId || undefined,
        categoryId: categoryId || undefined,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice > 0 ? maxPrice : undefined,
        sortBy,
        sortOrder: 'desc',
      }),
  })

  const games = gamesData?.data ?? []
  const categories = categoriesData?.data ?? []
  const listings = listingsData?.data ?? []

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (gameId) params.set('game', gameId)
    if (categoryId) params.set('category', categoryId)
    if (minPrice > 0) params.set('minPrice', String(minPrice))
    if (maxPrice > 0) params.set('maxPrice', String(maxPrice))
    if (sortBy !== 'created_at') params.set('sortBy', sortBy)
    const next = params.toString() ? `/browse?${params.toString()}` : '/browse'
    router.replace(next, { scroll: false })
  }, [search, gameId, categoryId, minPrice, maxPrice, sortBy, router])

  const gameOptions: ComboboxOption[] = useMemo(
    () => [
      { value: '', label: 'All games' },
      ...games.map((g: any) => ({
        value: g.id,
        label: g.emoji ? `${g.emoji}  ${g.name}` : g.name,
      })),
    ],
    [games],
  )

  const categoryOptions: ComboboxOption[] = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...categories.map((c: any) => ({
        value: c.id,
        label: c.icon ? `${c.icon}  ${c.name}` : c.name,
      })),
    ],
    [categories],
  )

  const activeFilterCount = [gameId, categoryId, minPrice > 0, maxPrice > 0].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0 || !!search

  const clearAll = () => {
    setSearch('')
    setGameId('')
    setCategoryId('')
    setMinPrice(0)
    setMaxPrice(0)
    setSortBy('created_at')
  }

  // Looked-up labels for filter chips
  const gameLabel = games.find((g: any) => g.id === gameId)?.name
  const categoryLabel = categories.find((c: any) => c.id === categoryId)?.name

  // ── Filter panel content (used inline lg+ and inside dialog on mobile) ──
  const FilterPanel = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Game
        </label>
        <Combobox value={gameId} onChange={setGameId} options={gameOptions} unsorted ariaLabel="Game" />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Category
        </label>
        <Combobox value={categoryId} onChange={setCategoryId} options={categoryOptions} unsorted ariaLabel="Category" />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Price range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-text-tertiary">Min</span>
            <NumberField
              value={minPrice}
              onChange={(v) => setMinPrice(v ?? 0)}
              minValue={0}
              maxValue={99_999}
              step={1}
              ariaLabel="Minimum price"
              formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-text-tertiary">Max</span>
            <NumberField
              value={maxPrice}
              onChange={(v) => setMaxPrice(v ?? 0)}
              minValue={0}
              maxValue={99_999}
              step={1}
              ariaLabel="Maximum price"
              formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={clearAll}
          className="w-full justify-center text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
        >
          Clear all filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="w-full">
      {/* Search + sort + mobile filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search listings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-md border border-border-default bg-bg-raised pl-9 pr-9 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-bg-raised-hover hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:w-auto">
          {/* Sort — visible at all sizes (key control) */}
          <div className="flex-1 sm:w-52 sm:flex-none">
            <Combobox
              value={sortBy}
              onChange={(v) => setSortBy(v as SortBy)}
              options={SORT_OPTIONS}
              unsorted
              ariaLabel="Sort by"
            />
          </div>

          {/* Mobile filter trigger */}
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="h-10 gap-1.5 rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover hover:border-lime-tint-border lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-lime px-1.5 text-[10px] font-bold text-text-inverse">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {gameLabel && (
            <FilterChip label={`Game: ${gameLabel}`} onClear={() => setGameId('')} />
          )}
          {categoryLabel && (
            <FilterChip label={`Category: ${categoryLabel}`} onClear={() => setCategoryId('')} />
          )}
          {minPrice > 0 && (
            <FilterChip label={`Min $${minPrice}`} onClear={() => setMinPrice(0)} />
          )}
          {maxPrice > 0 && (
            <FilterChip label={`Max $${maxPrice}`} onClear={() => setMaxPrice(0)} />
          )}
          {search && (
            <FilterChip label={`"${search}"`} onClear={() => setSearch('')} />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary transition-colors hover:text-error"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main grid: sidebar filters lg+, listings */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 rounded-2xl border border-border-subtle bg-bg-overlay p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-lime-tint-bg px-2 py-0.5 text-[10px] font-bold text-lime-text">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {FilterPanel}
          </div>
        </aside>

        {/* Listings */}
        <section>
          <div className="mb-3 flex items-center justify-between text-xs text-text-tertiary">
            <span>
              {isLoading
                ? 'Loading…'
                : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'}`}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState onClear={clearAll} hasActiveFilters={hasActiveFilters} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile filter dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        {/* Mobile-audit — max-h/overflow now live on the base DialogContent
            (dvh-based); no per-call override needed. */}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Narrow your search by game, category, and price.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">{FilterPanel}</div>
          <div className="mt-4 flex justify-end gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearAll}
                className="text-text-secondary hover:text-text-primary"
              >
                Clear all
              </Button>
            )}
            <Button
              onClick={() => setFiltersOpen(false)}
              className="bg-lime text-text-inverse hover:bg-lime-hover"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-raised px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
        aria-label={`Remove filter ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function EmptyState({ onClear, hasActiveFilters }: { onClear: () => void; hasActiveFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-bg-overlay p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-bg-raised">
        <Package className="h-5 w-5 text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">No listings found</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Try adjusting your filters or search.
        </p>
      </div>
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onClear}
          className="rounded-md border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover hover:border-lime-tint-border"
        >
          Clear all filters
        </Button>
      )}
    </div>
  )
}

function BrowseLoadingFallback() {
  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="h-11 flex-1 animate-pulse rounded-md bg-bg-raised" />
        <div className="h-11 w-52 animate-pulse rounded-md bg-bg-raised" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function BrowseClient() {
  return (
    <Suspense fallback={<BrowseLoadingFallback />}>
      <BrowseContent />
    </Suspense>
  )
}
