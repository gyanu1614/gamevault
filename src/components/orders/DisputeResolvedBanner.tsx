'use client'

import { CheckCircle, XCircle, DollarSign, Calendar, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DisputeResolvedBannerProps {
  favoredParty: 'buyer' | 'seller' | 'neutral'
  resolutionType: string
  refundAmount?: number
  resolvedAt: string
  resolutionNotes?: string
  className?: string
}

export default function DisputeResolvedBanner({
  favoredParty,
  resolutionType,
  refundAmount,
  resolvedAt,
  resolutionNotes,
  className
}: DisputeResolvedBannerProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const buyerWon = favoredParty === 'buyer'
  const Icon = buyerWon ? CheckCircle : XCircle
  const colorClasses = buyerWon
    ? 'border-success/30 bg-green-500/[0.08]'
    : 'border-error/40 bg-red-500/[0.08]'
  const iconColor = buyerWon ? 'text-success' : 'text-error'
  const titleColor = buyerWon ? 'text-success' : 'text-error'

  return (
    <div className={cn(
      'rounded-xl border p-5',
      colorClasses,
      className
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
          buyerWon ? 'border-green-500/40 bg-success-bg' : 'border-red-500/40 bg-error-bg'
        )}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn('text-sm font-bold uppercase tracking-wider mb-3', titleColor)}>
            {buyerWon ? '✅ Dispute Resolved in Your Favor' : '❌ Dispute Resolved - Claim Denied'}
          </h3>

          <div className="space-y-3">
            {/* Resolution Summary */}
            <div className={cn(
              'rounded-lg border p-3',
              buyerWon ? 'border-green-500/20 bg-green-500/[0.05]' : 'border-error/40 bg-red-500/[0.05]'
            )}>
              <p className="text-xs text-text-tertiary font-semibold mb-2">Resolution Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Decision:</span>
                  <span className={cn('font-semibold', buyerWon ? 'text-success' : 'text-error')}>
                    {buyerWon ? 'Buyer favored' : 'Seller favored'}
                  </span>
                </div>

                {refundAmount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Refund Amount:</span>
                    <span className={cn('font-bold', buyerWon ? 'text-success' : 'text-white')}>
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
              {buyerWon ? (
                <ul className="space-y-1.5 text-xs text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Your claim was approved by our support team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>A full refund has been issued for this order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Refunds typically complete within 3-5 business days</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span>
                    <span>Order is now closed</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-xs text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-error mt-0.5">✗</span>
                    <span>Your dispute claim was not approved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-error mt-0.5">✗</span>
                    <span>The seller has been paid out</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-error mt-0.5">✗</span>
                    <span>No refund will be issued</span>
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
