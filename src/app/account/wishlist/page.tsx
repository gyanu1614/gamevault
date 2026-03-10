'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useWishlist } from '@/hooks/use-wishlist'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Heart,
  ShoppingBag,
  X,
  Grid3x3,
  List,
  Loader2,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ViewMode = 'grid' | 'list'

export default function WishlistPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { wishlistItems: wishlist = [], isLoading, removeFromWishlist } = useWishlist()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGame, setFilterGame] = useState<string>('')

  const filteredWishlist = useMemo(() => {
    let filtered = wishlist

    if (filterGame) {
      filtered = filtered.filter(item => item.listing?.game?.name === filterGame)
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.listing?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.listing?.game?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [wishlist, filterGame, searchQuery])

  const games = useMemo(() => {
    return Array.from(
      new Set(wishlist.map(item => item.listing?.game?.name).filter(Boolean) as string[])
    )
  }, [wishlist])

  const totalValue = useMemo(() => {
    return wishlist.reduce((sum, item) => sum + (item.listing?.price || 0), 0)
  }, [wishlist])

  const handleRemoveFromWishlist = async (listingId: string) => {
    try {
      await removeFromWishlist(listingId)
    } catch (error) {
      console.error('Failed to remove from wishlist:', error)
    }
  }

  const handleBuyNow = (item: any) => {
    if (!item.listing) return
    const listing = item.listing
    const inStock = listing.is_unlimited || (listing.quantity ?? 0) > 0
    if (!inStock) {
      toast.error('This item is out of stock')
      return
    }
    // Direct checkout without cart
    router.push(`/checkout/${listing.id}`)
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (isLoading) {
    return (
      <div className="w-full px-6 pb-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-7 w-7 text-violet-400 fill-violet-400" />
            <h1 className="text-3xl font-bold text-white">Wishlist</h1>
          </div>
          <p className="text-sm text-gray-400">Save your favorite items and track them</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center gap-2.5 text-violet-400">
            <Heart className="h-5 w-5 fill-violet-400" />
            <span className="text-sm font-medium">Total Items</span>
          </div>
          <div className="text-3xl font-bold text-white">{wishlist.length}</div>
          <div className="mt-1.5 text-xs text-gray-500">In your wishlist</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center gap-2.5 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Total Value</span>
          </div>
          <div className="text-3xl font-bold text-white">${totalValue.toFixed(2)}</div>
          <div className="mt-1.5 text-xs text-gray-500">If bought today</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center gap-2.5 text-cyan-400">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm font-medium">In Stock</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {wishlist.filter(item =>
              item.listing?.is_unlimited || (item.listing?.quantity ?? 0) > 0
            ).length}
          </div>
          <div className="mt-1.5 text-xs text-gray-500">Available to buy</div>
        </motion.div>
        </div>

        {/* Filters & View Toggle */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search wishlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Game Filter */}
          {games.length > 0 && (
            <select
              value={filterGame}
              onChange={(e) => setFilterGame(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
            >
              <option value="">All Games</option>
              {games.map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          )}

          {/* View Toggle */}
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-lg p-2 transition-all',
                viewMode === 'grid'
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-lg p-2 transition-all',
                viewMode === 'list'
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        </div>

        {/* Wishlist Items */}
        {filteredWishlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 backdrop-blur-sm">
          <Heart className="mb-4 h-20 w-20 text-gray-700/50 fill-gray-700/50" />
          <h3 className="mb-2 text-xl font-semibold text-white">Your wishlist is empty</h3>
          <p className="mb-8 text-sm text-gray-400 text-center max-w-sm">
            {searchQuery ? 'Try adjusting your search or filters' : 'Browse listings and click the heart icon to save your favorite items here'}
          </p>
          <Link
            href="/"
            className="rounded-xl bg-violet-500 hover:bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
          >
            Browse Listings
          </Link>
        </div>
        ) : viewMode === 'grid' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredWishlist.map((item, index) => {
            const listing = item.listing
            if (!listing) return null
            const inStock = listing.is_unlimited || (listing.quantity ?? 0) > 0

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden backdrop-blur-sm transition-all hover:border-violet-500/40 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => router.push(`/${listing.game?.slug}/${listing.category?.slug}/${listing.slug}`)}
              >
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFromWishlist(item.listing_id)
                  }}
                  className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/70 backdrop-blur-md p-2 text-white transition-all hover:bg-red-500 border border-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Image Placeholder */}
                <div className="aspect-video bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  ) : listing.game?.emoji ? (
                    <span className="text-4xl">{listing.game.emoji}</span>
                  ) : (
                    <span className="text-4xl">🎮</span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="font-medium">{listing.game?.name || 'Unknown Game'}</span>
                    <span>{listing.category?.name || ''}</span>
                  </div>

                  <h3 className="mb-3 line-clamp-2 text-sm font-semibold text-white">{listing.title}</h3>

                  {/* Price */}
                  <div className="mb-3">
                    <span className="text-xl font-bold text-white">${listing.price.toFixed(2)}</span>
                  </div>

                  {/* Stock Status */}
                  {!inStock && (
                    <div className="mb-3 flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Out of stock
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBuyNow(item)
                      }}
                      disabled={!inStock}
                      className={cn(
                        'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all',
                        inStock
                          ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/25'
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      )}
                    >
                      <ShoppingBag className="inline h-4 w-4 mr-1.5" />
                      {inStock ? 'Buy Now' : 'Out of Stock'}
                    </button>
                  </div>

                  <div className="mt-2.5 text-[11px] text-gray-600">
                    Added {getTimeAgo(item.created_at)}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        ) : (
        <div className="space-y-4">
          {filteredWishlist.map((item, index) => {
            const listing = item.listing
            if (!listing) return null
            const inStock = listing.is_unlimited || (listing.quantity ?? 0) > 0

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-sm transition-all hover:border-violet-500/40 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => router.push(`/${listing.game?.slug}/${listing.category?.slug}/${listing.slug}`)}
              >
                {/* Image */}
                <div className="h-24 w-32 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  ) : listing.game?.emoji ? (
                    <span className="text-4xl">{listing.game.emoji}</span>
                  ) : (
                    <span className="text-4xl">🎮</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{listing.title}</h3>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="font-medium">{listing.game?.name || 'Unknown'}</span>
                        {listing.category?.name && (
                          <>
                            <span>•</span>
                            <span>{listing.category.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-gray-600">{getTimeAgo(item.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFromWishlist(item.listing_id)
                      }}
                      className="rounded-full p-1.5 text-gray-500 transition-colors hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-3">
                    <span className="text-xl font-bold text-white">${listing.price.toFixed(2)}</span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBuyNow(item)
                      }}
                      disabled={!inStock}
                      className={cn(
                        'rounded-xl px-5 py-2.5 text-sm font-semibold transition-all',
                        inStock
                          ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/25'
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      )}
                    >
                      <ShoppingBag className="inline h-4 w-4 mr-1.5" />
                      {inStock ? 'Buy Now' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
