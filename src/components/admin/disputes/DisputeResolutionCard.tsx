'use client'

import { CheckCircle, DollarSign, User, Calendar, FileText, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Image from 'next/image'

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
    resolutionColor = 'purple'
    winner = sellerUsername || 'Seller'
  } else if (status === 'resolved_partial') {
    resolutionTitle = 'Resolved - Partial Refund'
    resolutionDescription = 'The dispute has been resolved with a partial refund to the buyer.'
    resolutionColor = 'green'
    winner = 'Both Parties'
  }

  const colorClasses = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
      border: 'border-blue-500/30',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      text: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-500/10 to-violet-500/10',
      border: 'border-purple-500/30',
      iconBg: 'bg-gradient-to-br from-purple-500 to-violet-500',
      text: 'text-purple-400',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    green: {
      bg: 'bg-gradient-to-br from-green-500/10 to-emerald-500/10',
      border: 'border-green-500/30',
      iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
      text: 'text-green-400',
      badge: 'bg-green-500/20 text-green-300 border-green-500/30'
    }
  }

  const colors = colorClasses[resolutionColor as keyof typeof colorClasses]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        colors.bg,
        colors.border
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
          colors.iconBg
        )}>
          <CheckCircle className="h-5 w-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className={cn('text-base font-bold mb-0.5', colors.text)}>
            {resolutionTitle}
          </h2>
          <p className="text-xs text-gray-400">
            {resolutionDescription}
          </p>
        </div>

        <span className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
          colors.badge
        )}>
          Completed
        </span>
      </div>

      {/* Order Details Section (if provided) */}
      {(listingTitle || orderNumber || disputeReason) && (
        <div className="mb-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
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
                <h3 className="text-xs font-semibold text-white mb-0.5 line-clamp-2">
                  {listingTitle}
                </h3>
              )}
              {orderNumber && (
                <p className="text-[10px] text-gray-500 mb-1.5">Order #{orderNumber}</p>
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
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex-shrink-0',
              colors.badge
            )}>
              Resolved
            </span>
          </div>

          {/* Dispute Description (if provided) */}
          {disputeDescription && (
            <div className="mt-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[10px] text-gray-500 mb-0.5 font-medium">Dispute Details:</p>
              <p className="text-xs text-gray-300">{disputeDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Resolution Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Winner */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <User className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-[10px] text-gray-500 font-medium">Favored Party</span>
          </div>
          <p className="text-xs font-semibold text-white">{winner}</p>
        </div>

        {/* Amount */}
        {resolvedAmount !== undefined && (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-[10px] text-gray-500 font-medium">
                {status === 'resolved_buyer_favor' ? 'Refund Amount' :
                 status === 'resolved_partial' ? 'Partial Refund' :
                 'Seller Payout'}
              </span>
            </div>
            <p className="text-xs font-semibold text-white">{formatAmount(resolvedAmount)}</p>
          </div>
        )}

        {/* Resolved Date */}
        {resolvedAt && (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-[10px] text-gray-500 font-medium">Resolved On</span>
            </div>
            <p className="text-[10px] font-medium text-white">{formatDate(resolvedAt)}</p>
          </div>
        )}
      </div>

      {/* Resolution Notes */}
      {resolutionNotes && (
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Admin Resolution Notes</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
            {resolutionNotes}
          </p>
        </div>
      )}

      {/* Resolved By */}
      {resolvedBy && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <p className="text-[10px] text-gray-500">
            Resolved by <span className="text-gray-400 font-medium">{resolvedBy.full_name || resolvedBy.username || 'Admin'}</span>
          </p>
        </div>
      )}
    </motion.div>
  )
}
