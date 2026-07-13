'use client'

import { CheckCircle, XCircle, DollarSign, Calendar, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DisputeResolvedSellerBannerProps {
  favoredParty: 'buyer' | 'seller' | 'neutral'
  resolutionType: string
  refundAmount?: number
  resolvedAt: string
  resolutionNotes?: string
  className?: string
}

export default function DisputeResolvedSellerBanner({
  favoredParty,
  resolutionType,
  refundAmount,
  resolvedAt,
  resolutionNotes,
  className
}: DisputeResolvedSellerBannerProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const sellerWon = favoredParty === 'seller'
  const Icon = sellerWon ? CheckCircle : XCircle
  const colorClasses = sellerWon
    ? 'border-success/30 bg-green-500/[0.08]'
    : 'border-orange-500/30 bg-orange-500/[0.08]'
  const iconColor = sellerWon ? 'text-success' : 'text-orange-400'
  const titleColor = sellerWon ? 'text-success' : 'text-orange-400'

  return (
    <div className={cn(
      'rounded-xl border p-5',
      colorClasses,
      className
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
          sellerWon ? 'border-green-500/40 bg-success-bg' : 'border-orange-500/40 bg-orange-500/20'
        )}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn('text-sm font-bold uppercase tracking-wider mb-3', titleColor)}>
            {sellerWon ? '✅ Dispute Resolved in Your Favor' : '⚠️ Dispute Resolved - Refund Issued to Buyer'}
          </h3>

          <div className="space-y-3">
            {/* Resolution Summary */}
            <div className={cn(
              'rounded-lg border p-3',
              sellerWon ? 'border-green-500/20 bg-green-500/[0.05]' : 'border-orange-500/20 bg-orange-500/[0.05]'
            )}>
              <p className="text-xs text-text-tertiary font-semibold mb-2">Resolution Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Decision:</span>
                  <span className={cn('font-semibold', sellerWon ? 'text-success' : 'text-orange-400')}>
                    {sellerWon ? 'Seller favored' : 'Buyer favored'}
                  </span>
                </div>

                {refundAmount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">{sellerWon ? 'Payment Amount:' : 'Refund Amount:'}</span>
                    <span className={cn('font-bold', sellerWon ? 'text-success' : 'text-orange-400')}>
                      ${refundAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Resolved:</span>
                  <span className="text-white text-xs">{formatDate(resolvedAt)}</span>
                </div>
              </div>
            </div>

            {/* Resolution Notes */}
            {resolutionNotes && (
              <div className="rounded-lg border border-border-subtle bg-bg-overlay p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-3.5 w-3.5 text-lime-text" />
                  <p className="text-xs text-text-tertiary font-semibold">Resolution Details:</p>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{resolutionNotes}</p>
              </div>
            )}

            {/* What This Means */}
            <div className="pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-tertiary font-semibold mb-2">What This Means:</p>
              {sellerWon ? (
                <ul className="space-y-1.5 text-xs text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Your claim was approved by our support team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Your payout will be added to your Seller Balance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Your payout will be processed within 3-5 business days</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Order is now closed</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-xs text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">⚠</span>
                    <span>Buyer's dispute claim was approved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">⚠</span>
                    <span>Refund has been issued to the buyer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">⚠</span>
                    <span>No payout will be issued for this order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-text-tertiary mt-0.5">•</span>
                    <span>If you believe this decision was made in error, contact support within 7 days</span>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
