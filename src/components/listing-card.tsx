'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Star, Eye, ShoppingBag, Clock, Zap, Infinity, TrendingDown } from 'lucide-react'
import type { ListingWithRelations } from '@/types/database'
import { cn } from '@/lib/utils'
import WishlistButton from '@/components/wishlist/WishlistButton'

interface ListingCardProps {
  listing: ListingWithRelations
  /** Optional index for stagger delay when rendered inside a list */
  index?: number
}

export function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const primaryImage = listing.images?.[0] || null
  const isUnlimited = listing.is_unlimited
  const isLowStock = !isUnlimited && listing.quantity > 0 && listing.quantity <= 5
  const isSoldOut = !isUnlimited && listing.quantity === 0
  const hasPriceDrop = listing.original_price != null && listing.original_price > listing.price
  const discountPct = hasPriceDrop
    ? Math.round(((listing.original_price! - listing.price) / listing.original_price!) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4 }}
    >
      <Link
        href={`/listings/${listing.id}`}
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-2xl',
          'bg-white/[0.04] border border-white/[0.08]',
          'backdrop-blur-sm',
          'transition-all duration-300 ease-out',
          'hover:border-violet-500/40 hover:bg-white/[0.06]',
          'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]',
          isSoldOut && 'opacity-60'
        )}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl">
              {listing.game?.emoji ?? '🎮'}
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Game chip — top left */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10">
            {listing.game?.emoji && (
              <span className="text-xs">{listing.game.emoji}</span>
            )}
            <span className="text-[10px] font-medium text-white/80 leading-none">
              {listing.game?.name}
            </span>
          </div>

          {/* Top right corner — Wishlist + Stock badge */}
          <div className="absolute right-2.5 top-2.5 flex flex-col gap-2 items-end z-10">
            {/* Wishlist Button */}
            <WishlistButton
              listingId={listing.id}
              variant="card"
            />

            {/* Stock badge */}
            {isUnlimited && (
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 backdrop-blur-md">
                <Infinity className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400 leading-none">Unlimited</span>
              </div>
            )}
            {isLowStock && (
              <div className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-1 backdrop-blur-md">
                <span className="text-[10px] font-semibold text-amber-400 leading-none">
                  {listing.quantity} left
                </span>
              </div>
            )}
            {isSoldOut && (
              <div className="flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-1 backdrop-blur-md">
                <span className="text-[10px] font-semibold text-red-400 leading-none">Sold Out</span>
              </div>
            )}
          </div>

          {/* Price — bottom of image */}
          <div className="absolute bottom-2.5 left-2.5 flex flex-col items-start gap-0.5">
            {hasPriceDrop && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white/50 line-through leading-none">
                  ${listing.original_price!.toFixed(2)}
                </span>
                <span className="flex items-center gap-0.5 rounded bg-green-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  <TrendingDown className="h-2.5 w-2.5" />
                  -{discountPct}%
                </span>
              </div>
            )}
            <span className="font-mono text-xl font-bold text-white drop-shadow-md">
              ${listing.price.toFixed(2)}
            </span>
          </div>

          {/* Delivery time — bottom right of image */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md">
            {listing.delivery_time?.toLowerCase().includes('instant') ? (
              <Zap className="w-3 h-3 text-violet-400" />
            ) : (
              <Clock className="w-3 h-3 text-white/60" />
            )}
            <span className="text-[10px] text-white/70 leading-none">{listing.delivery_time}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Category pill */}
          <div className="flex items-center gap-1.5">
            {listing.category?.icon && (
              <span className="text-xs">{listing.category.icon}</span>
            )}
            <span className="text-[11px] font-medium text-violet-400/80 uppercase tracking-wide">
              {listing.category?.name}
            </span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug group-hover:text-violet-300 transition-colors duration-200">
            {listing.title}
          </h3>

          {/* Seller row */}
          <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 min-w-0">
              {/* Avatar */}
              <div className="relative shrink-0">
                {listing.seller?.avatar_url ? (
                  <img
                    src={listing.seller.avatar_url}
                    alt={listing.seller.username ?? ''}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-violet-500/20 ring-1 ring-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                    {(listing.seller?.username ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              {/* Username */}
              <span className="truncate text-xs text-muted-foreground">
                {listing.seller?.username}
              </span>
              {/* Rating */}
              {listing.seller?.seller_rating > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400">
                    {listing.seller.seller_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Micro stats */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {listing.views > 999 ? `${(listing.views / 1000).toFixed(1)}k` : listing.views}
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                {listing.sales}
              </span>
            </div>
          </div>
        </div>

        {/* Glow border on hover — purely decorative */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ring-1 ring-violet-500/30" />
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

export function ListingCardSkeleton() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] border border-white/[0.08]">
      {/* Image area */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <div className="skeleton absolute inset-0" />
        {/* Badge placeholders */}
        <div className="absolute left-2.5 top-2.5 h-5 w-20 rounded-full skeleton" />
        <div className="absolute right-2.5 top-2.5 h-5 w-16 rounded-full skeleton" />
        {/* Price placeholder */}
        <div className="absolute bottom-2.5 left-2.5 h-7 w-16 rounded skeleton" />
        <div className="absolute bottom-2.5 right-2.5 h-5 w-14 rounded-full skeleton" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Category */}
        <div className="h-3 w-20 rounded skeleton" />
        {/* Title */}
        <div className="space-y-1.5">
          <div className="h-4 w-full rounded skeleton" />
          <div className="h-4 w-3/4 rounded skeleton" />
        </div>
        {/* Seller row */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full skeleton" />
            <div className="h-3 w-20 rounded skeleton" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-8 rounded skeleton" />
            <div className="h-3 w-8 rounded skeleton" />
          </div>
        </div>
      </div>
    </div>
  )
}
