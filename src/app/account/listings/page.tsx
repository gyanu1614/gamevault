'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useSellerListings } from '@/hooks/use-seller-listings'
import { ListingStatus } from '@/lib/api/seller-compatible'
import { useRouter } from 'next/navigation'
import { updateListingPrice, deleteListing as deleteListingAction } from '@/lib/actions/listings'
import { toast } from 'sonner'
import Link from 'next/link'
import RestrictionBanner from '@/components/seller/RestrictionBanner'
import {  canSellerPublish } from '@/lib/utils/seller-status'
import type { SellerStatus } from '@/lib/utils/seller-status'
import {
  Search,
  Grid3x3,
  List,
  Plus,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  Copy,
  Pause,
  Play,
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  X,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  Share2,
  Edit2,
  ShieldAlert,
  Zap,
  Infinity
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getDeliveryMethodLabel, getDeliveryMethodIcon } from '@/lib/config/delivery-methods'

// Slug → filename map for games where slug differs from filename in /public/games/
const GAME_ICON_MAP: Record<string, string> = {
  'steal-a-brainrot': 'sab',
  'grow-a-garden': 'gag',
  'apex-legends': 'apexlegends',
  'escape-from-tarkov': 'escapefromtarkov',
  'r6-siege': 'r6',
  'league-of-legends': 'lol',
  'gta-v': 'gta-v',
}

function getGameIconUrl(slug: string): string {
  const filename = GAME_ICON_MAP[slug] ?? slug
  return `/games/${filename}.png`
}

function GameIcon({ slug, emoji, size }: { slug: string; emoji: string; size: 'xs' | 'sm' }) {
  const sizeClass = size === 'xs'
    ? 'h-3 w-3 sm:h-4 sm:w-4 text-[10px] sm:text-xs'
    : 'h-5 w-5 text-sm'
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className={`flex flex-shrink-0 items-center justify-center leading-none ${sizeClass}`}>{emoji || '🎮'}</span>
  }
  return (
    <img
      src={getGameIconUrl(slug)}
      alt=""
      className={`${sizeClass} flex-shrink-0 rounded object-cover`}
      onError={() => setFailed(true)}
    />
  )
}

// Mock listings data - DEPRECATED: Now using real data from hook
const mockListings_DEPRECATED = [
  {
    id: '1',
    title: 'Valorant Radiant Account | 5000+ VP | All Agents',
    game: { name: 'Valorant', slug: 'valorant', image: '/games/valorant.png' },
    category: 'Accounts',
    price: 149.99,
    originalPrice: 199.99,
    quantity: 1,
    status: 'active',
    views: 1234,
    favorites: 45,
    sales: 12,
    image: 'https://placehold.co/400x300/6366f1/fff?text=Valorant',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20'
  },
  {
    id: '2',
    title: 'Fortnite Account | 200+ Skins | Rare Emotes',
    game: { name: 'Fortnite', slug: 'fortnite', image: '/games/fortnite.png' },
    category: 'Accounts',
    price: 89.99,
    quantity: 3,
    status: 'active',
    views: 856,
    favorites: 32,
    sales: 8,
    image: 'https://placehold.co/400x300/8b5cf6/fff?text=Fortnite',
    createdAt: '2024-01-18',
    updatedAt: '2024-01-22'
  },
  {
    id: '3',
    title: 'Roblox Account | 50k Robux | Premium',
    game: { name: 'Roblox', slug: 'roblox', image: '/games/roblox.png' },
    category: 'Currency',
    price: 45.00,
    quantity: 10,
    status: 'active',
    views: 2341,
    favorites: 89,
    sales: 34,
    image: 'https://placehold.co/400x300/ec4899/fff?text=Roblox',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-23'
  },
  {
    id: '4',
    title: 'GTA V Modded Account | $500M | Rank 200',
    game: { name: 'GTA V', slug: 'gta-v', image: '/games/gta-v.png' },
    category: 'Accounts',
    price: 29.99,
    quantity: 0,
    status: 'sold',
    views: 456,
    favorites: 12,
    sales: 1,
    image: 'https://placehold.co/400x300/10b981/fff?text=GTA+V',
    createdAt: '2024-01-12',
    updatedAt: '2024-01-19'
  },
  {
    id: '5',
    title: 'Minecraft Premium Account | Full Access',
    game: { name: 'Minecraft', slug: 'minecraft', image: '/games/minecraft.png' },
    category: 'Accounts',
    price: 15.99,
    quantity: 25,
    status: 'paused',
    views: 678,
    favorites: 23,
    sales: 15,
    image: 'https://placehold.co/400x300/f59e0b/fff?text=Minecraft',
    createdAt: '2024-01-14',
    updatedAt: '2024-01-21'
  },
  {
    id: '6',
    title: 'League of Legends | Diamond Account | 150+ Champs',
    game: { name: 'League of Legends', slug: 'lol', image: '/games/lol.png' },
    category: 'Accounts',
    price: 120.00,
    quantity: 2,
    status: 'draft',
    views: 0,
    favorites: 0,
    sales: 0,
    image: 'https://placehold.co/400x300/3b82f6/fff?text=LoL',
    createdAt: '2024-01-24',
    updatedAt: '2024-01-24'
  },
]

type ViewMode = 'grid' | 'list'
type SortBy = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'views' | 'sales'
type FilterStatus = 'all' | 'active' | 'paused' | 'sold' | 'draft' | 'archived' | 'suspended' | 'pending_approval'

export default function ListingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({})
  const [updatingListings, setUpdatingListings] = useState<Set<string>>(new Set())
  const [deletingListings, setDeletingListings] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [bulkPriceInput, setBulkPriceInput] = useState('')
  const [showBulkPriceInput, setShowBulkPriceInput] = useState(false)

  // Fetch listings from database
  const {
    listings: dbListings,
    isLoading: listingsLoading,
    updateListing,
    deleteListing,
    bulkUpdate,
    bulkDelete,
    isUpdating,
    isDeleting
  } = useSellerListings({
    search: searchQuery,
    status: selectedStatus !== 'all' ? (selectedStatus as ListingStatus) : undefined
  })

  // Convert database listings to match UI format
  const listings = useMemo(() => {
    return dbListings.map(listing => ({
      id: listing.id,
      title: listing.title,
      game: {
        name: listing.game?.name || 'Unknown',
        slug: listing.game?.slug || '',
        emoji: listing.game?.emoji || '🎮'
      },
      category: listing.category?.name || 'Uncategorized',
      categorySlug: listing.category?.slug || '',
      slug: listing.id, // Use id as fallback for slug
      price: listing.price,
      originalPrice: undefined,
      quantity: listing.quantity,
      status: listing.status,
      views: listing.views,
      favorites: 0,
      sales: listing.sales,
      delivery_method: listing.delivery_method || 'manual',
      delivery_time: listing.delivery_time || '1-24 hours',
      image: listing.images && listing.images.length > 0 ? listing.images[0] : `https://placehold.co/400x300/6366f1/fff?text=${encodeURIComponent(listing.title.slice(0, 20))}`,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at
    }))
  }, [dbListings])

  // Filter and sort listings (filtering and sorting on client side)
  const filteredListings = useMemo(() => {
    let result = [...listings]

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(listing =>
        listing.categorySlug?.toLowerCase() === selectedCategory.toLowerCase() ||
        listing.category?.toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'price-low':
          return a.price - b.price
        case 'price-high':
          return b.price - a.price
        case 'views':
          return b.views - a.views
        case 'sales':
          return b.sales - a.sales
        default:
          return 0
      }
    })

    return result
  }, [listings, sortBy, selectedCategory])

  const statusCounts = useMemo(() => ({
    all: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    paused: listings.filter(l => l.status === 'paused').length,
    sold: listings.filter(l => l.status === 'sold').length,
    draft: listings.filter(l => l.status === 'draft').length,
    pending_approval: listings.filter(l => (l.status as any) === 'pending_approval').length,
  }), [listings])

  // Bulk action handlers
  const handleBulkActivate = async () => {
    // Prevent restricted sellers from activating listings
    if (isRestricted) {
      toast.error('Your account is restricted. You cannot activate listings at this time.')
      return
    }
    const ids = Array.from(selectedListings)
    await bulkUpdate({ ids, updates: { status: 'active' } })
    setSelectedListings(new Set())
    setShowBulkActions(false)
  }

  const handleBulkPause = async () => {
    const ids = Array.from(selectedListings)
    await bulkUpdate({ ids, updates: { status: 'paused' } })
    setSelectedListings(new Set())
    setShowBulkActions(false)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedListings.size} listing(s)? This action cannot be undone.`)) {
      return
    }
    const ids = Array.from(selectedListings)
    await bulkDelete(ids)
    setSelectedListings(new Set())
    setShowBulkActions(false)
  }

  const handleBulkPriceUpdate = async () => {
    const newPrice = parseFloat(bulkPriceInput)
    if (!bulkPriceInput || isNaN(newPrice) || newPrice <= 0) {
      toast.error('Enter a valid price greater than 0')
      return
    }
    const ids = Array.from(selectedListings)
    await bulkUpdate({ ids, updates: { price: newPrice } })
    setBulkPriceInput('')
    setShowBulkPriceInput(false)
    setSelectedListings(new Set())
    setShowBulkActions(false)
  }

  const toggleSelectListing = (id: string) => {
    const newSet = new Set(selectedListings)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedListings(newSet)
  }

  const selectAll = () => {
    if (selectedListings.size === filteredListings.length) {
      setSelectedListings(new Set())
    } else {
      setSelectedListings(new Set(filteredListings.map(l => l.id)))
    }
  }

  // Price editing handlers
  const handlePriceChange = (listingId: string, newPrice: number) => {
    setEditingPrices(prev => ({ ...prev, [listingId]: newPrice }))
  }

  const handleUpdatePrice = async (listingId: string) => {
    const newPrice = editingPrices[listingId]
    if (!newPrice || newPrice <= 0) {
      toast.error('Price must be greater than 0')
      return
    }

    setUpdatingListings(prev => new Set(prev).add(listingId))

    try {
      // Use updateListing with silent: true to suppress the hook's toast
      await updateListing({ id: listingId, updates: { price: newPrice }, silent: true })

      // Show only our custom toast
      toast.success('Price updated successfully!')

      // Remove from editing state
      setEditingPrices(prev => {
        const newState = { ...prev }
        delete newState[listingId]
        return newState
      })

      // Refresh listings data
    } catch (error: any) {
      toast.error(error.message || 'Failed to update price')
    } finally {
      setUpdatingListings(prev => {
        const newSet = new Set(prev)
        newSet.delete(listingId)
        return newSet
      })
    }
  }

  const handleCancelPriceEdit = (listingId: string) => {
    setEditingPrices(prev => {
      const newState = { ...prev }
      delete newState[listingId]
      return newState
    })
  }

  // Delete handlers
  const handleDeleteClick = (listingId: string) => {
    setConfirmingDelete(listingId)
  }

  const handleConfirmDelete = async (listingId: string) => {
    setDeletingListings(prev => new Set(prev).add(listingId))

    try {
      await deleteListing({ id: listingId, silent: true })  // ✅ Use silent to prevent duplicate toast
      toast.success('Listing deleted successfully')
      setConfirmingDelete(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete listing')
    } finally {
      setDeletingListings(prev => {
        const newSet = new Set(prev)
        newSet.delete(listingId)
        return newSet
      })
    }
  }

  const handleToggleStatus = async (listingId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'

    // Prevent restricted sellers from resuming listings
    if (newStatus === 'active' && isRestricted) {
      toast.error('Your account is restricted. You cannot resume listings at this time.')
      return
    }

    setUpdatingListings(prev => new Set(prev).add(listingId))

    try {
      await updateListing({ id: listingId, updates: { status: newStatus } })
      toast.success(`Listing ${newStatus === 'active' ? 'activated' : 'paused'}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    } finally {
      setUpdatingListings(prev => {
        const newSet = new Set(prev)
        newSet.delete(listingId)
        return newSet
      })
    }
  }

  const handleCopyLink = (listing: any) => {
    const url = `${window.location.origin}/marketplace/${listing.game?.slug || 'game'}/${listing.categorySlug || 'category'}/${listing.slug || listing.id}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }

  const handleCancelDelete = () => {
    setConfirmingDelete(null)
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500/10 text-green-400 border-green-500/30',
      paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      sold: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
      draft: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      pending_approval: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    }
    return colors[status as keyof typeof colors] || colors.draft
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-3 w-3" />
      case 'paused': return <Pause className="h-3 w-3" />
      case 'sold': return <Check className="h-3 w-3" />
      case 'draft': return <Edit className="h-3 w-3" />
      case 'pending_approval': return <Clock className="h-3 w-3" />
      default: return null
    }
  }

  if (authLoading || listingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-400">Loading listings...</p>
        </div>
      </div>
    )
  }

  // Get seller status from profile
  const sellerStatus = ((user?.profile as any)?.seller_status as SellerStatus) || 'active'
  const isRestricted = !canSellerPublish(sellerStatus)

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Restriction Banner */}
        {isRestricted && (
          <RestrictionBanner
            status={sellerStatus}
            reason={(user?.profile as any)?.seller_restriction_reason}
            dismissible={false}
          />
        )}

        {/* Header - Compact & Modern */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">My Listings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your products and track performance
              </p>
            </div>
            {isRestricted ? (
              <Link
                href="/account/restrictions"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors"
              >
                <ShieldAlert className="h-4 w-4" />
                Selling Restricted
              </Link>
            ) : (
              <Link
                href="/sell/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Create Listing
              </Link>
            )}
          </div>

          {/* Tab-Style Stats Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { label: 'All', value: statusCounts.all, status: 'all' as FilterStatus },
              { label: 'Active', value: statusCounts.active, status: 'active' as FilterStatus },
              { label: 'Under Review', value: statusCounts.pending_approval, status: 'pending_approval' as FilterStatus },
              { label: 'Paused', value: statusCounts.paused, status: 'paused' as FilterStatus },
              { label: 'Sold', value: statusCounts.sold, status: 'sold' as FilterStatus },
              { label: 'Drafts', value: statusCounts.draft, status: 'draft' as FilterStatus },
            ].map((stat) => (
              <button
                key={stat.status}
                onClick={() => setSelectedStatus(stat.status)}
                className={cn(
                  'flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  selectedStatus === stat.status
                    ? 'bg-white text-black'
                    : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] hover:text-gray-300'
                )}
              >
                {stat.label} <span className="ml-1.5 opacity-60">{stat.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="mb-5 flex flex-col gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 sm:p-4 backdrop-blur-md">
          {/* Top Row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Categories</option>
                <option value="currency">Currency</option>
                <option value="items">Items</option>
                <option value="top-up">Top-Up</option>
                <option value="accounts">Accounts</option>
                <option value="boosting">Boosting</option>
              </select>

              {/* View Mode */}
              <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-2 transition-all',
                    viewMode === 'grid'
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-2 transition-all',
                    viewMode === 'list'
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white transition-all hover:bg-white/10"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>

              {/* Bulk Actions */}
              {selectedListings.size > 0 && (
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white transition-all hover:bg-white/10"
                >
                  <Check className="h-4 w-4" />
                  {selectedListings.size} Selected
                </button>
              )}

              {/* Import/Export */}
              <button className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-all hover:text-white">
                <Upload className="h-4 w-4" />
              </button>
              <button className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-all hover:text-white">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-3 border-t border-white/10 pt-4"
              >
                {/* Status Filter */}
                <div className="flex flex-wrap gap-2">
                  {(['all', 'active', 'pending_approval', 'paused', 'sold', 'draft'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                        selectedStatus === status
                          ? 'border-primary bg-primary text-white'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      )}
                    >
                      {status === 'pending_approval' ? 'Under Review' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="views">Most Viewed</option>
                  <option value="sales">Best Selling</option>
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {showBulkActions && selectedListings.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 border-t border-white/10 pt-4"
              >
                <button
                  onClick={handleBulkActivate}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-all hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Activate ({selectedListings.size})
                </button>
                <button
                  onClick={handleBulkPause}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400 transition-all hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Pause ({selectedListings.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete ({selectedListings.size})
                </button>

                {/* Bulk Price Update */}
                {!showBulkPriceInput ? (
                  <button
                    onClick={() => setShowBulkPriceInput(true)}
                    disabled={isUpdating}
                    className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-400 transition-all hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DollarSign className="h-4 w-4" />
                    Set Price
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
                      <span className="text-sm text-violet-400 font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={bulkPriceInput}
                        onChange={e => setBulkPriceInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleBulkPriceUpdate(); if (e.key === 'Escape') { setShowBulkPriceInput(false); setBulkPriceInput('') } }}
                        placeholder="0.00"
                        autoFocus
                        className="w-24 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleBulkPriceUpdate}
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Apply ({selectedListings.size})
                    </button>
                    <button
                      onClick={() => { setShowBulkPriceInput(false); setBulkPriceInput('') }}
                      className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 hover:bg-white/10 text-gray-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Listings Grid/List */}
        {filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-12 backdrop-blur-md">
            <Package className="mb-4 h-16 w-16 text-gray-600" />
            <h3 className="mb-2 text-xl font-bold text-white">No listings found</h3>
            <p className="mb-6 text-gray-400">
              {searchQuery ? 'Try adjusting your search or filters' : 'Create your first listing to get started'}
            </p>
            {!searchQuery && (
              isRestricted ? (
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-500 px-6 py-3 font-semibold text-gray-300 cursor-not-allowed opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  Create Listing
                </button>
              ) : (
                <Link
                  href="/sell/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-all hover:bg-primary/90"
                >
                  <Plus className="h-5 w-5" />
                  Create Listing
                </Link>
              )
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing, index) => (
              <ListingCardGrid
                key={listing.id}
                listing={listing}
                index={index}
                isSelected={selectedListings.has(listing.id)}
                onToggleSelect={() => toggleSelectListing(listing.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredListings.map((listing, index) => (
              <ListingCardList
                key={listing.id}
                listing={listing}
                index={index}
                isSelected={selectedListings.has(listing.id)}
                onToggleSelect={() => toggleSelectListing(listing.id)}
                editingPrice={editingPrices[listing.id]}
                onPriceChange={(newPrice: any) => handlePriceChange(listing.id, newPrice)}
                onUpdatePrice={() => handleUpdatePrice(listing.id)}
                onCancelEdit={() => handleCancelPriceEdit(listing.id)}
                onDeleteClick={() => handleDeleteClick(listing.id)}
                onConfirmDelete={() => handleConfirmDelete(listing.id)}
                onCancelDelete={handleCancelDelete}
                onToggleStatus={() => handleToggleStatus(listing.id, listing.status)}
                onCopyLink={() => handleCopyLink(listing)}
                isUpdating={updatingListings.has(listing.id)}
                isDeleting={deletingListings.has(listing.id)}
                confirmingDelete={confirmingDelete === listing.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Grid Card Component
function ListingCardGrid({ listing, index, isSelected, onToggleSelect }: any) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md transition-all hover:border-primary/50"
    >
      {/* Checkbox */}
      <div className="absolute left-3 top-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-5 w-5 rounded border-white/20 bg-white/10 text-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Status Badge */}
      <div className="absolute right-3 top-3 z-10">
        <div
          className={cn('flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium', listing.status && getStatusColor(listing.status))}
          title={listing.status === 'pending_approval' ? 'Under Moderation - Your listing is being reviewed by our team' : undefined}
        >
          {getStatusIcon(listing.status)}
          {listing.status === 'pending_approval' ? 'Moderation' : listing.status}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-video overflow-hidden bg-white/5">
        <img
          src={listing.image}
          alt={listing.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-110"
        />
        {listing.originalPrice && (
          <div className="absolute bottom-2 left-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100)}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Game */}
        <div className="mb-2 flex items-center gap-2">
          <GameIcon slug={listing.game.slug} emoji={listing.game.emoji} size="sm" />
          <span className="text-xs text-gray-400">{listing.game.name}</span>
          <span className="text-xs text-gray-600">•</span>
          <span className="text-xs text-gray-400">{listing.category}</span>
        </div>

        {/* Title */}
        <h3 className="mb-3 line-clamp-2 font-semibold text-white">{listing.title}</h3>

        {/* Stats */}
        <div className="mb-3 flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {listing.views}
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {listing.sales} sales
          </div>
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {listing.quantity}
          </div>
        </div>

        {/* Price & Actions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-white">${listing.price}</div>
            {listing.originalPrice && (
              <div className="text-xs text-gray-500 line-through">${listing.originalPrice}</div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-all hover:text-white"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-white/10 bg-black/95 p-2 shadow-xl backdrop-blur-xl">
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">
                  <Eye className="h-4 w-4" />
                  View
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-white/10">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// List Card Component
function ListingCardList({
  listing,
  index,
  isSelected,
  onToggleSelect,
  editingPrice,
  onPriceChange,
  onUpdatePrice,
  onCancelEdit,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onToggleStatus,
  onCopyLink,
  isUpdating,
  isDeleting,
  confirmingDelete
}: any) {
  const isEditing = editingPrice !== undefined
  const hasChanged = isEditing && editingPrice !== listing.price
  const canToggleStatus = listing.status === 'active' || listing.status === 'paused'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-2 sm:gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 sm:p-4 backdrop-blur-md transition-all hover:border-primary/50"
    >
      {/* Checkbox - Hidden on mobile */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="hidden sm:block h-5 w-5 rounded border-white/20 bg-white/10 text-primary focus:ring-2 focus:ring-primary/20"
      />

      {/* Image */}
      <img src={listing.image} alt={listing.title} className="h-12 w-16 sm:h-16 sm:w-24 rounded-lg object-cover flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-1 sm:gap-2">
          <GameIcon slug={listing.game.slug} emoji={listing.game.emoji} size="xs" />
          <span className="text-[10px] sm:text-xs text-gray-400 truncate">{listing.game.name}</span>
          <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:inline">•</span>
          <span className="text-[10px] sm:text-xs text-gray-400 truncate hidden sm:inline">{listing.category}</span>
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-white truncate">{listing.title}</h3>

        {/* Mobile badges - Only visible on mobile/tablet */}
        <div className="flex items-center gap-2 mt-2 lg:hidden">
          {/* Delivery badge */}
          {listing.delivery_method === 'instant' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400 border border-violet-500/20">
              <Zap className="w-3 h-3" />
              Instant
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-white/10">
              <Clock className="w-3 h-3" />
              {listing.delivery_time || '1hr'}
            </span>
          )}

          {/* Low stock warning badge */}
          {listing.quantity > 0 && listing.quantity <= 5 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-3 h-3" />
              Low Stock ({listing.quantity})
            </span>
          )}

          {/* Sold out badge */}
          {listing.status === 'sold' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
              Sold Out
            </span>
          )}

          {/* Unlimited badge */}
          {listing.quantity > 10000 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              <Infinity className="w-3 h-3" />
              Unlimited
            </span>
          )}
        </div>
      </div>

      {/* Stats - Hidden on mobile, visible on larger screens */}
      <div className="hidden lg:flex items-center gap-4 text-sm text-gray-400 mr-8">
        {/* Views */}
        <div className="w-16 text-center">
          <div className="font-semibold text-white tabular-nums">{listing.views}</div>
          <div className="text-xs">Views</div>
        </div>

        {/* Stock - Enhanced with color coding */}
        <div className="w-20 text-center">
          <div className={cn(
            "font-semibold tabular-nums flex items-center justify-center gap-1",
            listing.quantity > 10000 && "text-emerald-400", // High stock (likely "unlimited")
            listing.status === 'sold' && "text-red-400",
            listing.quantity > 0 && listing.quantity <= 5 && "text-amber-400",
            listing.quantity > 5 && listing.quantity <= 10000 && "text-white"
          )}>
            {listing.quantity > 10000 ? (
              <>
                <Infinity className="w-3.5 h-3.5" />
                <span>∞</span>
              </>
            ) : (
              listing.quantity
            )}
          </div>
          <div className="text-xs">
            {listing.quantity > 10000 ? 'Unlimited' : 'Stock'}
          </div>
        </div>

        {/* Delivery - NEW */}
        <div className="w-24 text-center">
          <div className="inline-flex items-center justify-center gap-1">
            {listing.delivery_method === 'instant' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-violet-400">Instant</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-400">{listing.delivery_time || '1hr'}</span>
              </>
            )}
          </div>
          <div className="text-xs">Delivery</div>
        </div>
      </div>

      {/* Price - Inline editing - Compact on mobile */}
      <div className="relative flex items-center justify-end flex-shrink-0 w-24 sm:w-32">
        {!isEditing ? (
          /* Display state - clickable badge */
          <button
            onClick={() => onPriceChange(listing.price)}
            className="rounded-full border border-white/10 bg-white/5 px-2 sm:px-4 py-1.5 sm:py-2 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/10 hover:scale-105 active:scale-95 min-w-[80px] sm:min-w-[120px]"
            title="Click to edit price"
          >
            <div className="text-center">
              <div className={cn(
                "font-bold text-white tabular-nums",
                "text-xs sm:text-base"
              )}>
                ${listing.price}
              </div>
              {listing.originalPrice && (
                <div className="text-[10px] sm:text-xs text-gray-500 line-through tabular-nums hidden sm:block">${listing.originalPrice}</div>
              )}
            </div>
          </button>
        ) : (
          /* Editing state - just the input */
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-bold text-white/60">$</span>
            <input
              type="number"
              value={editingPrice}
              onChange={(e) => onPriceChange(parseFloat(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-20 sm:w-28 rounded-lg border border-primary/30 bg-white/5 px-2 sm:px-3 py-1.5 sm:py-2 pl-5 sm:pl-7 text-center text-xs sm:text-sm font-bold text-white tabular-nums backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              step="0.01"
              min="0"
              autoFocus
            />
          </motion.div>
        )}
      </div>

      {/* Status column - Shows status OR edit buttons */}
      <div className="hidden sm:flex w-24 sm:w-28 items-center relative min-h-[40px]">
        {/* Status badge - fades out when editing */}
        <motion.div
          initial={false}
          animate={{
            opacity: isEditing ? 0 : 1,
            scale: isEditing ? 0.95 : 1
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center"
        >
          {listing.status === 'sold' ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">Sold Out</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'h-2 w-2 rounded-full',
                listing.status === 'active' && 'bg-green-500',
                listing.status === 'paused' && 'bg-yellow-500',
                listing.status === 'draft' && 'bg-blue-500',
                listing.status === 'pending_approval' && 'bg-orange-500',
                listing.status === 'suspended' && 'bg-red-500',
                listing.status === 'archived' && 'bg-gray-600'
              )} />
              <span className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                listing.status === 'active' && 'text-green-400',
                listing.status === 'paused' && 'text-yellow-400',
                listing.status === 'draft' && 'text-blue-400',
                listing.status === 'pending_approval' && 'text-orange-400',
                listing.status === 'suspended' && 'text-red-400',
                listing.status === 'archived' && 'text-gray-500'
              )}>
                {listing.status === 'pending_approval' ? 'Review' : listing.status}
              </span>
            </div>
          )}
        </motion.div>

        {/* Edit buttons - fade in when editing */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center gap-1.5"
          >
            <button
              onClick={onUpdatePrice}
              disabled={isUpdating || !hasChanged}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              disabled={isUpdating}
              className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Actions - Compact on mobile */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Restock Button - shown only for sold-out listings */}
        {listing.status === 'sold' && (
          <Link href={`/account/listings/new?id=${listing.id}`}>
            <button
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-orange-400 shadow-sm transition-all hover:bg-orange-500/20 hover:border-orange-500/40 hover:scale-105 active:scale-95"
              title="Restock this listing"
            >
              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Restock</span>
            </button>
          </Link>
        )}

        {/* Pause/Resume Toggle */}
        {canToggleStatus && (
          <button
            onClick={onToggleStatus}
            disabled={isUpdating}
            className={cn(
              'rounded-xl border p-1.5 sm:p-2.5 shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95',
              listing.status === 'active'
                ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/30'
                : 'border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500/30',
              isUpdating && 'opacity-50 hover:scale-100'
            )}
            title={listing.status === 'active' ? 'Pause listing' : 'Resume listing'}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            ) : listing.status === 'active' ? (
              <Pause className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <Play className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </button>
        )}

        {/* Edit Button - Navigate to edit page */}
        <Link href={`/account/listings/${listing.id}/edit`}>
          <button
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 sm:p-2.5 text-gray-400 shadow-sm backdrop-blur-xl transition-all hover:text-white hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:scale-105 active:scale-95"
            title="Edit listing"
          >
            <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
        </Link>

        {/* Share Button - Copy link - Hidden on small mobile */}
        <button
          onClick={onCopyLink}
          className="hidden sm:block rounded-xl border border-white/10 bg-white/5 p-1.5 sm:p-2.5 text-gray-400 shadow-sm backdrop-blur-xl transition-all hover:text-white hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:scale-105 active:scale-95"
          title="Copy link"
        >
          <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>

        {/* Delete with inline confirmation */}
        {confirmingDelete ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex items-center gap-1 sm:gap-2 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5 px-2 sm:px-4 py-1.5 sm:py-2.5 shadow-lg shadow-red-500/10 backdrop-blur-xl"
          >
            <span className="text-xs sm:text-sm font-medium text-red-300 whitespace-nowrap">Sure?</span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : 'Yes'}
              </button>
              <button
                onClick={onCancelDelete}
                disabled={isDeleting}
                className="rounded-xl bg-white/10 px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-gray-300 backdrop-blur-xl transition-all hover:bg-white/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                No
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={onDeleteClick}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 sm:p-2.5 text-red-400 shadow-sm transition-all hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-md hover:scale-105 active:scale-95"
            title="Delete listing"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

function getStatusColor(status: string) {
  const colors = {
    active: 'bg-green-500/10 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    sold: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    draft: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    pending_approval: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }
  return colors[status as keyof typeof colors] || colors.draft
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active': return <Play className="h-3 w-3" />
    case 'paused': return <Pause className="h-3 w-3" />
    case 'sold': return <Check className="h-3 w-3" />
    case 'draft': return <Edit className="h-3 w-3" />
    case 'pending_approval': return <Clock className="h-3 w-3" />
    default: return null
  }
}
