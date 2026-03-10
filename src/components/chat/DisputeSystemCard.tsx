import { AlertCircle } from 'lucide-react'

interface DisputeSystemCardProps {
  category: string
  reason: string
}

export default function DisputeSystemCard({ category, reason }: DisputeSystemCardProps) {
  return (
    <div className="my-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-red-400 mb-2">
              🚨 Dispute Opened
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium text-gray-300">Category:</span>{' '}
                <span className="text-gray-400">{category}</span>
              </div>
              <div>
                <span className="font-medium text-gray-300">Details:</span>{' '}
                <span className="text-gray-400">{reason}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-red-500/20">
              <p className="text-xs text-gray-400">
                Funds are now held in escrow while our support team reviews this case. Both parties will be contacted within 24-48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
