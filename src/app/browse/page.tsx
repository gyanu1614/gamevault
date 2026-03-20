'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, SlidersHorizontal } from 'lucide-react'
import { getListings, getGames, getCategories } from '@/lib/api/listings'
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export const dynamic = 'force-dynamic'

function BrowseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [gameId, setGameId] = useState(searchParams.get('game') || '')
  const [categoryId, setCategoryId] = useState(searchParams.get('category') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [sortBy, setSortBy] = useState<'created_at' | 'price' | 'sales'>(
    (searchParams.get('sortBy') as any) || 'created_at'
  )
  const [showFilters, setShowFilters] = useState(false)

  // Fetch data
  const { data: gamesData } = useQuery({
    queryKey: ['games'],
    queryFn: getGames,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const { data: listingsData, isLoading } = useQuery({
    queryKey: ['listings', { search, gameId, categoryId, minPrice, maxPrice, sortBy }],
    queryFn: () =>
      getListings({
        search: search || undefined,
        gameId: gameId || undefined,
        categoryId: categoryId || undefined,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy,
        sortOrder: 'desc',
      }),
  })

  const games = gamesData?.data || []
  const categories = categoriesData?.data || []
  const listings = listingsData?.data || []

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (gameId) params.set('game', gameId)
    if (categoryId) params.set('category', categoryId)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (sortBy !== 'created_at') params.set('sortBy', sortBy)

    const newUrl = params.toString() ? `/browse?${params.toString()}` : '/browse'
    router.replace(newUrl, { scroll: false })
  }, [search, gameId, categoryId, minPrice, maxPrice, sortBy, router])

  const clearFilters = () => {
    setSearch('')
    setGameId('')
    setCategoryId('')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('created_at')
  }

  const hasActiveFilters = search || gameId || categoryId || minPrice || maxPrice

  return (
    <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Browse Listings</h1>
        <p className="text-muted-foreground">
          Find the best gaming items, currency, and accounts
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {[gameId, categoryId, minPrice, maxPrice].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="rounded-lg border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Game Filter */}
              <div className="space-y-2">
                <Label htmlFor="game">Game</Label>
                <select
                  id="game"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Games</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.emoji} {game.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label htmlFor="minPrice">Min Price</Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="$0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Price</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="$1000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Sort & Results Count */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${listings.length} listings found`}
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="sortBy" className="text-sm">
              Sort by:
            </Label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="created_at">Newest</option>
              <option value="price">Price: Low to High</option>
              <option value="sales">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed">
          <Filter className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No listings found</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Try adjusting your filters or search terms
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}

function BrowseLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
      <div className="mb-8">
        <div className="h-9 w-64 bg-muted/50 rounded animate-pulse mb-2"></div>
        <div className="h-5 w-96 bg-muted/30 rounded animate-pulse"></div>
      </div>
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-muted/50 rounded animate-pulse"></div>
          <div className="h-10 w-24 bg-muted/50 rounded animate-pulse"></div>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowseLoadingFallback />}>
      <BrowseContent />
    </Suspense>
  )
}
