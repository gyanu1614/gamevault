'use client'

/**
 * /browse — universal marketplace browse.
 *
 * V3 reskin: GV tokens, Combobox for game/category/sort, NumberField for
 * price range, ListingCard reused. Mobile filters open in a Dialog. Filter
 * chip row shows active filters with one-click clear. 2026-10-15: Phosphor
 * icons, Title Case labels, plain names (no emoji prefixes).
 */

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'

import { getListings, getGames, getCategories } from '@/lib/api/listings'
import { LISTINGS_PAGE_SIZE } from '@/lib/api/listings-query'
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { NumberField } from '@/components/ui/number-field'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BrowseLoadingFallback, EmptyState, FilterChip } from './_BrowseBits'
import { MARKET_CARD } from '@/lib/ui/surfaces'

type SortBy = 'created_at' | 'price' | 'sales'

const SORT_OPTIONS: ComboboxOption[] = [
  { value: 'created_at', label: 'Newest First' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'sales', label: 'Most Popular' },
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
  // The search box queries 300 ms after typing stops, not on every key.
  const [query, setQuery] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // One page of listings at a time (it used to load every live listing).
  const listingsQuery = useInfiniteQuery({
    queryKey: ['listings', { query, gameId, categoryId, minPrice, maxPrice, sortBy }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getListings({
        search: query || undefined,
        gameId: gameId || undefined,
        categoryId: categoryId || undefined,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice > 0 ? maxPrice : undefined,
        sortBy,
        limit: LISTINGS_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last, all) =>
      (last.data?.length ?? 0) === LISTINGS_PAGE_SIZE ? all.length * LISTINGS_PAGE_SIZE : undefined,
  })
  const isLoading = listingsQuery.isLoading

  const games = useMemo(() => gamesData?.data ?? [], [gamesData])
  const categories = useMemo(() => categoriesData?.data ?? [], [categoriesData])
  const listings = useMemo(() => listingsQuery.data?.pages.flatMap((p) => p.data ?? []) ?? [], [listingsQuery.data])

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
      { value: '', label: 'All Games' },
      ...games.map((g: any) => ({ value: g.id, label: g.name })),
    ],
    [games],
  )

  const categoryOptions: ComboboxOption[] = useMemo(
    () => [
      { value: '', label: 'All Categories' },
      ...categories.map((c: any) => ({ value: c.id, label: c.name })),
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
        <label className="block text-[13px] font-semibold text-text-secondary">
          Game
        </label>
        <Combobox value={gameId} onChange={setGameId} options={gameOptions} unsorted ariaLabel="Game" />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[13px] font-semibold text-text-secondary">
          Category
        </label>
        <Combobox value={categoryId} onChange={setCategoryId} options={categoryOptions} unsorted ariaLabel="Category" />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[13px] font-semibold text-text-secondary">
          Price Range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[12px] text-text-tertiary">Min</span>
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
            <span className="text-[12px] text-text-tertiary">Max</span>
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
          Clear All Filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="w-full">
      {/* Search + sort + mobile filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon size={16} weight="bold" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search Listings"
            aria-label="Search listings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-md bg-bg-raised pl-9 pr-9 text-[16px] text-text-primary placeholder:text-text-tertiary transition-[background-color,box-shadow] hover:bg-bg-raised-hover focus:outline-none focus:ring-1 focus:ring-white/15 focus-visible:shadow-none sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-bg-raised-hover hover:text-text-primary"
              aria-label="Clear search"
            >
              <XIcon size={14} weight="bold" />
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
            className="h-11 gap-1.5 rounded-md border-0 bg-bg-raised text-text-primary hover:bg-bg-raised-hover lg:hidden"
          >
            <SlidersHorizontalIcon size={16} weight="bold" aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-white/[0.12] px-1.5 text-[11px] font-bold text-text-primary">
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
            className="h-7 rounded-md px-2 text-[12.5px] font-semibold text-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Main grid: sidebar filters lg+, listings */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className={cn('sticky top-32 rounded-lg p-4', MARKET_CARD)}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-text-primary">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/[0.1] px-2 py-0.5 text-[11px] font-bold text-text-primary">
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
            <span aria-live="polite">
              {isLoading
                ? 'Loading…'
                : `Showing ${listings.length}${listingsQuery.hasNextPage ? '+' : ''} ${listings.length === 1 ? 'listing' : 'listings'}`}
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
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {listingsQuery.hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => listingsQuery.fetchNextPage()}
                    disabled={listingsQuery.isFetchingNextPage}
                    className="h-11 min-w-[200px] rounded-md border-0 bg-bg-overlay px-5 font-semibold text-text-primary hover:bg-bg-overlay-2"
                  >
                    {listingsQuery.isFetchingNextPage ? 'Loading…' : 'Show More Listings'}
                  </Button>
                </div>
              )}
            </>
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
                Clear All
              </Button>
            )}
            <Button
              onClick={() => setFiltersOpen(false)}
              className="bg-white font-semibold text-black hover:bg-white/90"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
