import { AlertCircle } from 'lucide-react'

interface DisputeSystemCardProps {
  category: string
  reason: string
}

export default function DisputeSystemCard({ category, reason }: DisputeSystemCardProps) {
  return (
    <div className="my-4">
      <div className="bg-error-bg border border-error/40 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-error-bg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-error" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-error mb-2">
              🚨 Dispute Opened
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium text-text-secondary">Category:</span>{' '}
                <span className="text-text-secondary">{category}</span>
              </div>
              <div>
                <span className="font-medium text-text-secondary">Details:</span>{' '}
                <span className="text-text-secondary">{reason}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-error/40">
              <p className="text-xs text-text-secondary">
                The seller payout is paused pending dispute resolution. Both parties will be contacted within 24-48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
