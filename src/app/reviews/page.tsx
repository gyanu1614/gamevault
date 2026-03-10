'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import {
  Search,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  User,
  Calendar,
  Filter,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Award,
  ShoppingBag
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Mock reviews data
const mockReviews = {
  received: [
    {
      id: '1',
      reviewer: { name: 'gamer123', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gamer123' },
      rating: 5,
      comment: 'Amazing seller! Fast delivery and account was exactly as described. Highly recommended!',
      listing: { title: 'Valorant Radiant Account', game: 'Valorant' },
      createdAt: '2024-01-24T10:30:00',
      helpful: 12,
      response: null,
    },
    {
      id: '2',
      reviewer: { name: 'proplayer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=proplayer' },
      rating: 4,
      comment: 'Good service, delivered within 2 hours. Account is great but had minor issue with login initially.',
      listing: { title: 'Fortnite Account | 200+ Skins', game: 'Fortnite' },
      createdAt: '2024-01-23T15:20:00',
      helpful: 5,
      response: 'Thank you for the feedback! Glad we could resolve the login issue quickly.',
    },
    {
      id: '3',
      reviewer: { name: 'casual_player', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casual_player' },
      rating: 5,
      comment: 'Perfect transaction! Will buy again.',
      listing: { title: 'Roblox Account | 50k Robux', game: 'Roblox' },
      createdAt: '2024-01-22T09:15:00',
      helpful: 8,
      response: null,
    },
  ],
  written: [
    {
      id: '4',
      seller: { name: 'ProGamer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ProGamer', tier: 'gold' },
      rating: 5,
      comment: 'Excellent seller! Fast delivery and great communication throughout the process.',
      listing: { title: 'GTA V Modded Account', game: 'GTA V' },
      createdAt: '2024-01-20T14:30:00',
      helpful: 15,
      sellerResponse: 'Thank you so much! Enjoy the game!',
    },
    {
      id: '5',
      seller: { name: 'GameMaster', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GameMaster', tier: 'platinum' },
      rating: 4,
      comment: 'Good account, everything works as promised. Delivery took a bit longer than expected but overall satisfied.',
      listing: { title: 'Minecraft Premium Account', game: 'Minecraft' },
      createdAt: '2024-01-19T11:00:00',
      helpful: 7,
      sellerResponse: null,
    },
  ]
}

type TabType = 'received' | 'written'

export default function ReviewsPage() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('received')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [selectedReview, setSelectedReview] = useState<any | null>(null)

  // TODO: Replace with real data fetch
  const reviews = mockReviews

  const currentReviews = activeTab === 'received' ? reviews.received : reviews.written

  const filteredReviews = useMemo(() => {
    let filtered = currentReviews

    if (filterRating) {
      filtered = filtered.filter(r => r.rating === filterRating)
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.listing.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [currentReviews, filterRating, searchQuery])

  const stats = useMemo(() => {
    const receivedReviews = reviews.received
    const avgRating = receivedReviews.length > 0
      ? receivedReviews.reduce((sum, r) => sum + r.rating, 0) / receivedReviews.length
      : 0
    const totalHelpful = receivedReviews.reduce((sum, r) => sum + r.helpful, 0)
    const responseRate = receivedReviews.length > 0
      ? (receivedReviews.filter(r => r.response).length / receivedReviews.length) * 100
      : 0

    const ratingDistribution = {
      5: receivedReviews.filter(r => r.rating === 5).length,
      4: receivedReviews.filter(r => r.rating === 4).length,
      3: receivedReviews.filter(r => r.rating === 3).length,
      2: receivedReviews.filter(r => r.rating === 2).length,
      1: receivedReviews.filter(r => r.rating === 1).length,
    }

    return { avgRating, totalHelpful, responseRate, ratingDistribution, total: receivedReviews.length }
  }, [reviews])

  const renderStars = (rating: number, size: string = 'h-4 w-4') => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size,
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
            )}
          />
        ))}
      </div>
    )
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-400">Loading reviews...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <Star className="mx-auto mb-4 h-16 w-16 text-gray-600" />
          <h2 className="mb-2 text-2xl font-bold text-white">Please log in</h2>
          <p className="mb-6 text-gray-400">You need to be logged in to view your reviews</p>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90"
          >
            Log In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] lg:max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white">My Reviews</h1>
          </div>
          <p className="text-gray-400">Manage your feedback and reputation</p>
        </div>

        {/* Stats - Only show for received reviews */}
        {activeTab === 'received' && user.isApprovedSeller && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-yellow-400">
                <Star className="h-5 w-5 fill-current" />
                <span className="text-sm font-medium">Average Rating</span>
              </div>
              <div className="text-3xl font-bold text-white">{stats.avgRating.toFixed(1)}</div>
              <div className="mt-1 text-xs text-gray-400">From {stats.total} reviews</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-green-400">
                <ThumbsUp className="h-5 w-5" />
                <span className="text-sm font-medium">Helpful Votes</span>
              </div>
              <div className="text-3xl font-bold text-white">{stats.totalHelpful}</div>
              <div className="mt-1 text-xs text-gray-400">Total received</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-blue-400">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Response Rate</span>
              </div>
              <div className="text-3xl font-bold text-white">{stats.responseRate.toFixed(0)}%</div>
              <div className="mt-1 text-xs text-gray-400">Of reviews responded</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-purple-400">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">5-Star Reviews</span>
              </div>
              <div className="text-3xl font-bold text-white">{stats.ratingDistribution[5]}</div>
              <div className="mt-1 text-xs text-gray-400">
                {stats.total > 0 ? ((stats.ratingDistribution[5] / stats.total) * 100).toFixed(0) : 0}% of total
              </div>
            </motion.div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-2 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('received')}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'received'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            Received ({reviews.received.length})
          </button>
          <button
            onClick={() => setActiveTab('written')}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'written'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            Written ({reviews.written.length})
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search reviews..."
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

          {/* Rating Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterRating || ''}
              onChange={(e) => setFilterRating(e.target.value ? parseInt(e.target.value) : null)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-primary focus:outline-none"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-12 backdrop-blur-md">
            <Star className="mb-4 h-16 w-16 text-gray-600" />
            <h3 className="mb-2 text-xl font-bold text-white">No reviews found</h3>
            <p className="text-gray-400">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : activeTab === 'received'
                ? 'Reviews from buyers will appear here'
                : 'Reviews you write will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-md"
              >
                {/* Review Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <img
                      src={activeTab === 'received' ? review.reviewer.avatar : review.seller.avatar}
                      alt={activeTab === 'received' ? review.reviewer.name : review.seller.name}
                      className="h-12 w-12 rounded-full ring-2 ring-white/10"
                    />
                    <div>
                      <div className="font-semibold text-white">
                        {activeTab === 'received' ? review.reviewer.name : review.seller.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {getTimeAgo(review.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {review.listing.title} • {review.listing.game}
                      </div>
                    </div>
                  </div>
                  {renderStars(review.rating, 'h-5 w-5')}
                </div>

                {/* Review Content */}
                <div className="mb-4">
                  <p className="text-gray-300 leading-relaxed">{review.comment}</p>
                </div>

                {/* Seller Response */}
                {activeTab === 'received' && review.response && (
                  <div className="ml-12 rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4">
                    <div className="mb-1 text-xs font-semibold text-primary">Your Response:</div>
                    <p className="text-sm text-gray-300">{review.response}</p>
                  </div>
                )}

                {activeTab === 'written' && review.sellerResponse && (
                  <div className="ml-12 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 mb-4">
                    <div className="mb-1 text-xs font-semibold text-blue-400">Seller Response:</div>
                    <p className="text-sm text-gray-300">{review.sellerResponse}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-primary">
                      <ThumbsUp className="h-4 w-4" />
                      Helpful ({review.helpful})
                    </button>
                  </div>

                  {activeTab === 'received' && !review.response && (
                    <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-95">
                      <MessageCircle className="h-4 w-4" />
                      Respond
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
