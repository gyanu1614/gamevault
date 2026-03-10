'use client'

import { AlertTriangle, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EscalationBannerProps {
  escalatedBy?: {
    username: string
    full_name?: string
  }
  escalatedAt: string
  escalationReason?: string
  className?: string
}

export default function EscalationBanner({
  escalatedBy,
  escalatedAt,
  escalationReason,
  className
}: EscalationBannerProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={cn(
      'rounded-xl border border-orange-500/30 bg-orange-500/[0.08] p-5',
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/20">
          <AlertTriangle className="h-5 w-5 text-orange-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider">
              Escalated to Senior Admin
            </h3>
          </div>

          <div className="space-y-2 text-sm">
            {escalatedBy && (
              <div className="flex items-center gap-2 text-gray-300">
                <User className="h-3.5 w-3.5 text-orange-400/60" />
                <span className="text-xs text-gray-500">Escalated by:</span>
                <span className="font-medium">{escalatedBy.full_name || escalatedBy.username}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="h-3.5 w-3.5 text-orange-400/60" />
              <span className="text-xs text-gray-500">Escalated on:</span>
              <span className="font-medium">{formatDate(escalatedAt)}</span>
            </div>

            {escalationReason && (
              <div className="mt-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.05] p-3">
                <p className="text-xs text-gray-500 font-semibold mb-1.5">Escalation Reason:</p>
                <p className="text-sm text-gray-300 leading-relaxed">{escalationReason}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-orange-500/20">
              <p className="text-xs text-gray-400 leading-relaxed">
                This dispute has been flagged for senior admin review. Senior admins have full authority to review and make final decisions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
