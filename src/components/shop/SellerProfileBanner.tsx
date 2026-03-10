/**
 * Seller Profile Banner Component
 *
 * Prominent banner for seller shop pages featuring:
 * - Custom uploaded banner or preset gradient (based on tier)
 * - Large seller avatar with online status
 * - Shop name and username
 * - Key stats: Reviews, Listings, Sales
 * - Seller tier badge
 * - Action buttons: Message, Follow
 *
 * Design: Apple-style minimalism with Framer Motion animations
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  ThumbsUp,
  Package,
  TrendingUp,
  MessageCircle,
  UserPlus,
  Check,
  Shield,
  Star,
  Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface BannerConfig {
  type: 'custom' | 'preset'
  url?: string
  gradientFrom?: string
  gradientTo?: string
  gradientDirection?: string
}

interface SellerProfileBannerProps {
  // Seller info
  sellerId: string
  username: string
  shopName?: string
  avatarUrl?: string
  isOnline?: boolean
  isVerified?: boolean

  // Stats
  rating: number
  reviewsCount: number
  listingsCount: number
  totalSales: number

  // Tier
  sellerTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

  // Banner
  bannerConfig?: BannerConfig

  // Actions
  currentUserId?: string
  onMessageClick?: () => void
  onFollowClick?: () => void
  isFollowing?: boolean

  // Optional
  className?: string
}

// Tier configurations
const tierConfig = {
  bronze: {
    label: 'Bronze Seller',
    icon: Shield,
    color: 'text-orange-700',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  silver: {
    label: 'Silver Seller',
    icon: Shield,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20'
  },
  gold: {
    label: 'Gold Seller',
    icon: Star,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20'
  },
  platinum: {
    label: 'Platinum Seller',
    icon: Crown,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20'
  },
  diamond: {
    label: 'Diamond Elite',
    icon: Crown,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  }
}

export default function SellerProfileBanner({
  sellerId,
  username,
  shopName,
  avatarUrl,
  isOnline = false,
  isVerified = false,
  rating,
  reviewsCount,
  listingsCount,
  totalSales,
  sellerTier = 'bronze',
  bannerConfig,
  currentUserId,
  onMessageClick,
  onFollowClick,
  isFollowing = false,
  className
}: SellerProfileBannerProps) {
  const tier = tierConfig[sellerTier]
  const TierIcon = tier.icon
  const isOwnShop = currentUserId === sellerId

  // Generate banner background style
  const getBannerStyle = (): React.CSSProperties => {
    if (!bannerConfig) {
      return {
        background: 'linear-gradient(to right, #6b46c1, #9333ea)'
      }
    }

    if (bannerConfig.type === 'custom' && bannerConfig.url) {
      return {
        backgroundImage: `url(${bannerConfig.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    }

    if (bannerConfig.type === 'preset') {
      const direction = bannerConfig.gradientDirection || 'to right'
      const from = bannerConfig.gradientFrom || '#6b46c1'
      const to = bannerConfig.gradientTo || '#9333ea'
      return {
        background: `linear-gradient(${direction}, ${from}, ${to})`
      }
    }

    return {
      background: 'linear-gradient(to right, #6b46c1, #9333ea)'
    }
  }

  // Calculate positive review percentage
  const positivePercentage = rating > 0 ? Math.round((rating / 5) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-white/[0.08]',
        className
      )}
    >
      {/* Banner Background */}
      <div
        className="absolute inset-0 opacity-90"
        style={getBannerStyle()}
      >
        {/* Overlay gradient for better text visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 px-6 pt-12 pb-6 sm:px-8 sm:pt-16 sm:pb-8">
        {/* Top Row: Avatar + Info */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative flex-shrink-0"
          >
            {/* Avatar Container */}
            <div className={cn(
              'relative w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white/20 overflow-hidden',
              'shadow-2xl shadow-black/50'
            )}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={shopName || username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-4xl">
                  {(shopName || username)[0]?.toUpperCase()}
                </div>
              )}

              {/* Online Status Indicator */}
              {isOnline && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute bottom-1 right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-500 border-4 border-white/90 shadow-lg"
                />
              )}
            </div>

            {/* Seller Tier Badge (overlaps avatar) */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                'border shadow-lg backdrop-blur-sm',
                tier.color,
                tier.bgColor,
                tier.borderColor
              )}
            >
              <TierIcon className="w-3.5 h-3.5" />
              <span>{tier.label}</span>
            </motion.div>
          </motion.div>

          {/* Shop Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex-1 text-center sm:text-left"
          >
            {/* Shop Name */}
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                {shopName || username}
              </h1>
              {isVerified && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ delay: 0.6, type: 'spring' }}
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center"
                  title="Verified Seller"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}
            </div>

            {/* Username */}
            <p className="text-white/80 text-sm sm:text-base mb-3 drop-shadow">
              @{username}
            </p>

            {/* Stats Row */}
            <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 flex-wrap">
              {/* Reviews */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2"
              >
                <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 fill-green-400" />
                <span className="text-white font-semibold text-sm sm:text-base">
                  {positivePercentage}%
                </span>
                <span className="text-white/60 text-xs sm:text-sm">
                  ({reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'})
                </span>
              </motion.div>

              {/* Listings */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <span className="text-white font-semibold text-sm sm:text-base">
                  {listingsCount}
                </span>
                <span className="text-white/60 text-xs sm:text-sm">
                  {listingsCount === 1 ? 'listing' : 'listings'}
                </span>
              </motion.div>

              {/* Sales */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <span className="text-white font-semibold text-sm sm:text-base">
                  {totalSales}
                </span>
                <span className="text-white/60 text-xs sm:text-sm">
                  {totalSales === 1 ? 'sale' : 'sales'}
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          {!isOwnShop && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3"
            >
              {/* Message Button */}
              <button
                onClick={onMessageClick}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                  'bg-white text-black hover:bg-white/90 active:scale-95 shadow-lg'
                )}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Message</span>
              </button>

              {/* Follow Button */}
              <button
                onClick={onFollowClick}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                  'border-2 backdrop-blur-sm shadow-lg active:scale-95',
                  isFollowing
                    ? 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                    : 'bg-purple-500/20 border-purple-400/40 text-purple-200 hover:bg-purple-500/30'
                )}
              >
                {isFollowing ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Follow</span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Dashboard Link for Own Shop */}
          {isOwnShop && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Link
                href="/account/dashboard"
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                  'bg-white text-black hover:bg-white/90 active:scale-95 shadow-lg'
                )}
              >
                <Package className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Border Accent */}
      <div className={cn('absolute bottom-0 left-0 right-0 h-1', tier.bgColor)} />
    </motion.div>
  )
}
