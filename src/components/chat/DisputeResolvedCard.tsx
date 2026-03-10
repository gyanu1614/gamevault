import { CheckCircle } from 'lucide-react'

interface DisputeResolvedCardProps {
  resolution: 'buyer_favor' | 'seller_favor' | 'partial'
  notes: string
  refundAmount?: number
}

export default function DisputeResolvedCard({ resolution, notes, refundAmount }: DisputeResolvedCardProps) {
  const resolutionLabels = {
    buyer_favor: 'Buyer Favor',
    seller_favor: 'Seller Favor',
    partial: 'Partial Refund'
  }

  return (
    <div className="my-4">
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-green-400 mb-2">
              ✅ Dispute Resolved - {resolutionLabels[resolution]}
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-300">Resolution:</span>{' '}
                <span className="text-gray-400">{notes}</span>
              </div>
              {refundAmount !== undefined && refundAmount > 0 && (
                <div>
                  <span className="font-medium text-gray-300">Refund Amount:</span>{' '}
                  <span className="text-green-400 font-semibold">${refundAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-xs text-gray-400">
                Thank you for your patience. This case is now closed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
