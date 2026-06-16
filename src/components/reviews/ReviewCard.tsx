/**
 * Review Card Component - Minimalistic & Trustworthy Design
 *
 * Features:
 * - Compact card design
 * - Thumbs up/down instead of stars
 * - Anonymized buyer names
 * - Shield icon for verified purchases
 * - Game → Product display
 * - Minimal seller responses
 */

'use client'

import React, { useState } from 'react'
import { ThumbsUp, ThumbsDown, Shield, MessageCircle, ExternalLink, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { ReviewWithRelations } from '@/types/database'
import SellerResponseForm from './SellerResponseForm'
import EditReviewButton from './EditReviewButton'
import EditReviewModal from './EditReviewModal'
import Link from 'next/link'

interface ReviewCardProps {
  review: ReviewWithRelations
  showSellerResponse?: boolean
  allowSellerReply?: boolean
  currentUserId?: string
  onReplySuccess?: () => void
}

// Helper: Anonymize buyer name (show first 3 chars + ***)
function anonymizeName(name: string): string {
  if (!name || name.length === 0) return 'Anonymous'
  const visible = name.slice(0, Math.min(3, name.length))
  return `${visible}***`
}

// Helper: Shorten listing title
function shortenTitle(title: string, maxLength: number = 30): string {
  if (!title) return ''
  if (title.length <= maxLength) return title
  return title.slice(0, maxLength) + '...'
}

// Helper: Get game name from review
function getGameName(review: ReviewWithRelations): string {
  return review.game?.name || 'Game'
}

export default function ReviewCard({
  review,
  showSellerResponse = true,
  allowSellerReply = false,
  currentUserId,
  onReplySuccess
}: ReviewCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const buyerName = review.buyer?.username || 'Anonymous'
  const anonymizedName = anonymizeName(buyerName)
  const buyerAvatar = review.buyer?.avatar_url
  const sellerName = review.seller?.shop_name || review.seller?.username || 'Seller'

  const isSellerOwner = currentUserId === review.seller_id
  const isReviewer = currentUserId === review.reviewer_id
  const canReply = allowSellerReply && isSellerOwner && !review.seller_response
  const canViewOrder = isReviewer || isSellerOwner
  const isEdited = (review as any).edit_count > 0

  // Determine if positive or negative based on rating
  const isPositive = review.rating >= 4
  const ThumbIcon = isPositive ? ThumbsUp : ThumbsDown
  const thumbColor = isPositive ? 'text-success' : 'text-error'
  const thumbBg = isPositive ? 'bg-success-bg' : 'bg-error-bg'

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true })

  // Get game and listing info
  const gameName = getGameName(review)
  const listingTitle = review.listing?.title || 'Product'
  const shortListingTitle = shortenTitle(listingTitle, 25)

  return (
    <div className="max-w-2xl bg-bg-overlay border border-border-subtle rounded-xl p-4 space-y-3 hover:border-white/[0.1] transition-all">
      {/* Header: Avatar + Name + Verified + Thumbs */}
      <div className="flex items-start gap-3">
        {/* Avatar - Smaller and Compact */}
        <div className="relative flex-shrink-0">
          {buyerAvatar ? (
            <img
              src={buyerAvatar}
              alt={anonymizedName}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/80 to-cyan-600/80 flex items-center justify-center text-white font-semibold text-sm">
              {buyerName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + Verified + Time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-white">{anonymizedName}</h4>
            {review.is_verified_purchase && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-success-bg border border-green-500/20 rounded text-success">
                <Shield className="w-3 h-3" />
                <span className="text-[10px] font-medium">Verified</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-text-tertiary">{timeAgo}</p>
            {isEdited && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-500/10 border border-gray-500/20 text-text-secondary">
                <Edit3 className="w-2.5 h-2.5" />
                Edited
              </span>
            )}
          </div>
        </div>

        {/* Thumbs Icon */}
        <div className={cn('flex-shrink-0 p-1.5 rounded-lg', thumbBg)}>
          <ThumbIcon className={cn('w-4 h-4', thumbColor, 'fill-current')} />
        </div>
      </div>

      {/* Game → Product Info */}
      {review.listing && (
        <div className="text-xs text-text-secondary flex items-center gap-1.5">
          <span className="font-medium">{gameName}</span>
          <span className="text-text-disabled">→</span>
          <span className="truncate">{shortListingTitle}</span>
        </div>
      )}

      {/* Review Title (if exists) */}
      {review.title && (
        <h5 className="text-sm font-semibold text-gray-200">{review.title}</h5>
      )}

      {/* Review Comment */}
      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
        {review.comment}
      </p>

      {/* Action Buttons Row */}
      {(isReviewer || canViewOrder) && (
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          {/* Left: Edit Button */}
          <div>
            {isReviewer && (
              <EditReviewButton
                reviewId={review.id}
                reviewerId={review.reviewer_id}
                currentUserId={currentUserId}
                createdAt={review.created_at}
                lastEditedAt={(review as any).last_edited_at}
                onClick={() => setShowEditModal(true)}
              />
            )}
          </div>

          {/* Right: View Order Button */}
          {canViewOrder && review.order_id && (
            <Link
              href={`/orders/${review.order_id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-secondary hover:bg-bg-overlay rounded-lg transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Order
            </Link>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {isReviewer && (
        <EditReviewModal
          reviewId={review.id}
          currentRating={review.rating}
          currentTitle={review.title || undefined}
          currentComment={review.comment}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            if (onReplySuccess) {
              onReplySuccess()
            }
          }}
        />
      )}

      {/* Seller Response - Ultra Compact */}
      {showSellerResponse && review.seller_response && (
        <div className="ml-8 pl-3 border-l-2 border-purple-500/30">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageCircle className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-medium text-purple-400">{sellerName}</span>
            {review.seller_responded_at && (
              <span className="text-[10px] text-text-disabled">
                {formatDistanceToNow(new Date(review.seller_responded_at), { addSuffix: true })}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {review.seller_response}
          </p>
        </div>
      )}

      {/* Reply Button for Seller */}
      {canReply && !showReplyForm && (
        <div className="pt-2">
          <button
            onClick={() => setShowReplyForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Respond
          </button>
        </div>
      )}

      {/* Reply Form */}
      {showReplyForm && (
        <div className="pt-2">
          <SellerResponseForm
            reviewId={review.id}
            onSuccess={() => {
              setShowReplyForm(false)
              if (onReplySuccess) {
                onReplySuccess()
              }
            }}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}
    </div>
  )
}
