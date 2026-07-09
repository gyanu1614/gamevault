'use client'

import { CheckCircle, DollarSign, User, Calendar, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DisputeResolutionCardProps {
  status: string
  resolutionType?: string
  resolvedAmount?: number
  resolutionNotes?: string
  resolvedBy?: {
    username?: string
    full_name?: string
  }
  resolvedAt?: string
  currency?: string
  buyerUsername?: string
  sellerUsername?: string
  // Order details (optional - for buyer/seller pages)
  orderNumber?: string
  disputeReason?: string
  disputeDescription?: string
  disputedAmount?: number
  disputeCreatedAt?: string
  listingTitle?: string
  listingImage?: string
}

export default function DisputeResolutionCard({
  status,
  resolutionType,
  resolvedAmount,
  resolutionNotes,
  resolvedBy,
  resolvedAt,
  currency = 'USD',
  buyerUsername,
  sellerUsername,
  orderNumber,
  disputeReason,
  disputeDescription,
  disputedAmount,
  disputeCreatedAt,
  listingTitle,
  listingImage,
}: DisputeResolutionCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  // Determine resolution details based on status
  let resolutionTitle = ''
  let resolutionDescription = ''
  let resolutionColor = 'green'
  let winner = ''

  if (status === 'resolved_buyer_favor') {
    resolutionTitle = 'Resolved in Buyer Favor'
    resolutionDescription = 'The dispute has been resolved in favor of the buyer. Full refund has been processed.'
    resolutionColor = 'blue'
    winner = buyerUsername || 'Buyer'
  } else if (status === 'resolved_seller_favor') {
    resolutionTitle = 'Resolved in Seller Favor'
    resolutionDescription = 'The dispute has been resolved in favor of the seller. Payment has been released.'
    resolutionColor = 'lime'
    winner = sellerUsername || 'Seller'
  } else if (status === 'resolved_partial') {
    resolutionTitle = 'Resolved - Partial Refund'
    resolutionDescription = 'The dispute has been resolved with a partial refund to the buyer.'
    resolutionColor = 'green'
    winner = 'Both Parties'
  }

  const colorClasses = {
    blue: {
      border: 'border-blue-500/30',
      glyph: 'text-blue-400',
      text: 'text-blue-400',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    lime: {
      border: 'border-lime-tint-border',
      glyph: 'text-lime-text',
      text: 'text-lime-text',
      badge: 'bg-lime-tint-bg text-lime-text border-lime-tint-border'
    },
    green: {
      border: 'border-green-500/30',
      glyph: 'text-green-400',
      text: 'text-green-400',
      badge: 'bg-green-500/10 text-green-400 border-green-500/30'
    }
  }

  const colors = colorClasses[resolutionColor as keyof typeof colorClasses]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-bg-raised p-4',
        colors.border
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-overlay">
          <CheckCircle className={cn('h-5 w-5', colors.glyph)} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className={cn('text-base font-bold mb-0.5', colors.text)}>
            {resolutionTitle}
          </h2>
          <p className="text-xs text-text-secondary">
            {resolutionDescription}
          </p>
        </div>

        <span className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider',
          colors.badge
        )}>
          Completed
        </span>
      </div>

      {/* Order Details Section (if provided) */}
      {(listingTitle || orderNumber || disputeReason) && (
        <div className="mb-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-overlay border border-border-subtle">
            {/* Listing Image */}
            {listingImage && (
              <img
                src={listingImage}
                alt={listingTitle || 'Order item'}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            )}

            {/* Order Info */}
            <div className="flex-1 min-w-0">
              {listingTitle && (
                <h3 className="text-xs font-semibold text-text-primary mb-0.5 line-clamp-2">
                  {listingTitle}
                </h3>
              )}
              {orderNumber && (
                <p className="text-[10px] text-text-tertiary mb-1.5">Order #{orderNumber}</p>
              )}

              {/* Dispute Reason Badge */}
              {disputeReason && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] font-medium text-red-400 capitalize">
                    {disputeReason.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider flex-shrink-0',
              colors.badge
            )}>
              Resolved
            </span>
          </div>

          {/* Dispute Description (if provided) */}
          {disputeDescription && (
            <div className="mt-2 p-2.5 rounded-lg bg-bg-overlay border border-border-subtle">
              <p className="text-[10px] text-text-tertiary mb-0.5 font-medium">Dispute Details:</p>
              <p className="text-xs text-text-secondary">{disputeDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Resolution Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Winner */}
        <div className="rounded-lg bg-bg-overlay border border-border-subtle p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <User className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-[10px] text-text-tertiary font-medium">Favored Party</span>
          </div>
          <p className="text-xs font-semibold text-text-primary">{winner}</p>
        </div>

        {/* Amount */}
        {resolvedAmount !== undefined && (
          <div className="rounded-lg bg-bg-overlay border border-border-subtle p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-[10px] text-text-tertiary font-medium">
                {status === 'resolved_buyer_favor' ? 'Refund Amount' :
                 status === 'resolved_partial' ? 'Partial Refund' :
                 'Seller Payout'}
              </span>
            </div>
            <p className="text-xs font-semibold tabular-nums text-text-primary">{formatAmount(resolvedAmount)}</p>
          </div>
        )}

        {/* Resolved Date */}
        {resolvedAt && (
          <div className="rounded-lg bg-bg-overlay border border-border-subtle p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-[10px] text-text-tertiary font-medium">Resolved On</span>
            </div>
            <p className="text-[10px] font-medium text-text-primary">{formatDate(resolvedAt)}</p>
          </div>
        )}
      </div>

      {/* Resolution Notes */}
      {resolutionNotes && (
        <div className="rounded-lg bg-bg-overlay border border-border-subtle p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider">Admin Resolution Notes</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
            {resolutionNotes}
          </p>
        </div>
      )}

      {/* Resolved By */}
      {resolvedBy && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <p className="text-[10px] text-text-tertiary">
            Resolved by <span className="text-text-secondary font-medium">{resolvedBy.full_name || resolvedBy.username || 'Admin'}</span>
          </p>
        </div>
      )}
    </motion.div>
  )
}
