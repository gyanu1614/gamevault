'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

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
      month: 'short',
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
  let winner = ''

  if (status === 'resolved_buyer_favor') {
    resolutionTitle = 'Resolved in Buyer’s Favor'
    resolutionDescription = 'Resolved for the buyer. The full refund has been processed.'
    winner = buyerUsername || 'Buyer'
  } else if (status === 'resolved_seller_favor') {
    resolutionTitle = 'Resolved in Seller’s Favor'
    resolutionDescription = 'Resolved for the seller. The payment has been released.'
    winner = sellerUsername || 'Seller'
  } else if (status === 'resolved_partial') {
    resolutionTitle = 'Resolved – Partial Refund'
    resolutionDescription = 'Resolved with a partial refund to the buyer.'
    winner = 'Both Parties'
  } else if (status === 'closed') {
    resolutionTitle = 'Closed'
    resolutionDescription = 'This dispute was closed.'
    winner = '—'
  }

  const tile = 'rounded-md bg-bg-overlay px-3.5 py-3'
  const tileLabel = 'text-[12px] text-text-tertiary'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-bg-raised p-4 sm:p-6"
    >
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-success-bg text-success">
          <CheckCircle aria-hidden weight="fill" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-text-primary">{resolutionTitle}</h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">{resolutionDescription}</p>
        </div>
        <span className="shrink-0 rounded-full bg-success-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-success">Completed</span>
      </div>

      {/* Order details (if provided) */}
      {(listingTitle || orderNumber || disputeReason) && (
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-3 rounded-md bg-bg-overlay p-3">
            {listingImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listingImage} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {listingTitle && <h3 className="line-clamp-2 text-[13.5px] font-semibold text-text-primary">{listingTitle}</h3>}
              {orderNumber && <p className="mt-0.5 text-[12px] text-text-tertiary">Order #{orderNumber}</p>}
              {disputeReason && (
                <span className="mt-1.5 inline-flex rounded-full bg-error-bg px-2 py-0.5 text-[11.5px] font-semibold capitalize text-error">
                  {disputeReason.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
          {disputeDescription && (
            <div className={tile}>
              <p className={tileLabel}>Dispute Details</p>
              <p className="mt-0.5 text-[13px] text-text-secondary">{disputeDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Resolution details */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className={tile}>
          <p className={tileLabel}>Favored Party</p>
          <p className="mt-0.5 text-[13.5px] font-semibold text-text-primary">{winner}</p>
        </div>
        {resolvedAmount !== undefined && (
          <div className={tile}>
            <p className={tileLabel}>
              {status === 'resolved_buyer_favor' ? 'Refund Amount' : status === 'resolved_partial' ? 'Partial Refund' : 'Seller Payout'}
            </p>
            <p className="mt-0.5 text-[13.5px] font-semibold tabular-nums text-text-primary">{formatAmount(resolvedAmount)}</p>
          </div>
        )}
        {resolvedAt && (
          <div className={tile}>
            <p className={tileLabel}>Resolved On</p>
            <p className="mt-0.5 text-[13px] font-medium text-text-primary">{formatDate(resolvedAt)}</p>
          </div>
        )}
      </div>

      {resolutionNotes && (
        <div className={tile}>
          <p className={tileLabel}>Admin Resolution Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">{resolutionNotes}</p>
        </div>
      )}

      {resolvedBy && (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-[12.5px] text-text-tertiary">
          Resolved by <span className="font-medium text-text-secondary">{resolvedBy.full_name || resolvedBy.username || 'Admin'}</span>
        </p>
      )}
    </motion.div>
  )
}
