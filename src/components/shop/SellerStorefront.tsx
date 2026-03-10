/**
 * Seller Storefront Component
 *
 * Client component for public seller shop with tabbed interface
 */

'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Store,
  Star,
  Package,
  ShoppingBag,
  MessageSquare,
  Clock,
  Shield,
  TrendingUp,
  MapPin,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  Grid3x3,
  List as ListIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { formatDistanceToNow } from 'date-fns'
import SellerProfileBanner from '@/components/shop/SellerProfileBanner'
import ReviewsList from '@/components/reviews/ReviewsList'

interface SellerStorefrontProps {
  seller: {
    profile: any
    listings: any[]
    reviews: any[]
    stats: {
      totalSales: number
      avgRating: number
      totalReviews: number
      positivePercentage: number
      activeListings: number
    }
  }
}

export default function SellerStorefront({ seller }: SellerStorefrontProps) {
  const [activeTab, setActiveTab] = useState<'shop' | 'reviews' | 'about'>('shop')
  const [selectedGame, setSelectedGame] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Group listings by game
  const listingsByGame = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    seller.listings.forEach((listing) => {
      const game = listing.game?.name || 'Other'
      if (!grouped[game]) {
        grouped[game] = []
      }
      grouped[game].push(listing)
    })
    return grouped
  }, [seller.listings])

  const games = ['all', ...Object.keys(listingsByGame)]

  const filteredListings = selectedGame === 'all'
    ? seller.listings
    : listingsByGame[selectedGame] || []

  const isOnline = false // TODO: Implement online status check

  const sellerTier = seller.profile.seller_tier || 'bronze'

  // JSON-LD Structured Data for SEO
  const businessName = seller.profile.shop_name || seller.profile.business_name || seller.profile.username;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: businessName,
    image: getAvatarUrl(seller.profile),
    description: `Gaming marketplace seller on GameVault`,
    url: `${typeof window !== 'undefined' ? window.location.origin : ''}/shop/${seller.profile.shop_slug || seller.profile.username}`,
    aggregateRating: seller.stats.totalReviews > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: seller.stats.avgRating,
      reviewCount: seller.stats.totalReviews,
      bestRating: 5,
      worstRating: 1
    } : undefined,
    founder: {
      '@type': 'Person',
      name: seller.profile.username,
    },
    memberOf: {
      '@type': 'Organization',
      name: 'GameVault'
    }
  };
  const tierColors = {
    bronze: 'text-orange-400',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    platinum: 'text-purple-400'
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
        {/* Seller Profile Banner */}
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <SellerProfileBanner
            sellerId={seller.profile.id}
            username={seller.profile.username}
            shopName={seller.profile.shop_name || seller.profile.business_name}
            avatarUrl={getAvatarUrl(seller.profile)}
            isOnline={isOnline}
            isVerified={true}
            rating={seller.stats.avgRating}
            reviewsCount={seller.stats.totalReviews}
            listingsCount={seller.stats.activeListings}
            totalSales={seller.stats.totalSales}
            sellerTier={sellerTier as 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'}
            bannerConfig={
              seller.profile.banner_url
                ? { type: 'custom', url: seller.profile.banner_url }
                : {
                    type: 'preset',
                    gradientFrom: '#6b46c1',
                    gradientTo: '#9333ea',
                    gradientDirection: 'to right'
                  }
            }
            onMessageClick={() => {
              window.location.href = `/messages?seller=${seller.profile.id}`
            }}
          />
        </div>

      {/* Tab Navigation */}
      <div className="border-b border-white/10 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {(['shop', 'reviews', 'about'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative border-b-2 py-4 text-sm font-medium capitalize transition-colors",
                  activeTab === tab
                    ? "border-primary text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Shop Tab */}
        {activeTab === 'shop' && (
          <div>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="all">All Games</option>
                  {Object.keys(listingsByGame).map((game) => (
                    <option key={game} value={game}>
                      {game} ({listingsByGame[game].length})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "rounded-lg p-2 transition-colors",
                    viewMode === 'grid' ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:text-white"
                  )}
                >
                  <Grid3x3 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "rounded-lg p-2 transition-colors",
                    viewMode === 'list' ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:text-white"
                  )}
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Listings Grid */}
            {filteredListings.length > 0 ? (
              <div className={cn(
                "grid gap-6",
                viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )}>
                {filteredListings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-primary/50 hover:bg-white/10"
                  >
                    {listing.images?.[0] && (
                      <div className="mb-4 aspect-video overflow-hidden rounded-lg">
                        <Image
                          src={listing.images[0]}
                          alt={listing.title}
                          width={400}
                          height={225}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {listing.game?.name} • {listing.category?.name}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          ${listing.price}
                        </span>
                        {listing.stock > 0 ? (
                          <span className="text-sm text-green-400">{listing.stock} in stock</span>
                        ) : (
                          <span className="text-sm text-red-400">Out of stock</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-600" />
                <h3 className="mt-4 text-lg font-medium text-white">No listings found</h3>
                <p className="mt-2 text-sm text-gray-400">This seller doesn't have any active listings{selectedGame !== 'all' && ' for this game'}.</p>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="w-full">
            <ReviewsList
              sellerId={seller.profile.id}
              initialReviews={seller.reviews}
              allowSellerReply={false}
            />
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="max-w-3xl space-y-6">
            {/* About Section */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">About</h2>
              <p className="text-gray-300">
                No description provided.
              </p>
            </div>

            {/* Stats & Info */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Seller Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Member since</span>
                  <span className="text-white">
                    {new Date(seller.profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Response time</span>
                  <span className="text-white">Within 2 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Seller tier</span>
                  <span className={cn("font-medium uppercase", tierColors[sellerTier as keyof typeof tierColors])}>
                    {sellerTier}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total sales</span>
                  <span className="text-white">{seller.stats.totalSales}</span>
                </div>
              </div>
            </div>

            {/* Policies */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Shop Policies</h2>
              <div className="space-y-4 text-gray-300">
                <div>
                  <h3 className="font-medium text-white">Returns & Refunds</h3>
                  <p className="mt-1 text-sm">All sales are covered by GameVault's buyer protection policy. Refunds available within 7 days if the product doesn't match the description.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white">Delivery</h3>
                  <p className="mt-1 text-sm">Digital goods are delivered immediately after payment confirmation. Physical items ship within 1-3 business days.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white">Support</h3>
                  <p className="mt-1 text-sm">Message me anytime for questions or support. I aim to respond within 2 hours during business hours.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
