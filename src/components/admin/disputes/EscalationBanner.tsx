import { WarningOctagon } from '@phosphor-icons/react/dist/ssr/WarningOctagon'
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

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Shown on an escalated dispute: who, when, why. Fill only (warning tint). */
export default function EscalationBanner({ escalatedBy, escalatedAt, escalationReason, className }: EscalationBannerProps) {
  return (
    <div className={cn('rounded-lg bg-warning-bg p-4 sm:p-5', className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-warning">
          <WarningOctagon aria-hidden weight="bold" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-warning">Escalated to Senior Admin</h3>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            {escalatedBy && (
              <>
                By <span className="font-semibold text-text-primary">{escalatedBy.full_name || escalatedBy.username}</span> ·{' '}
              </>
            )}
            {formatDate(escalatedAt)}
          </p>
          {escalationReason && (
            <p className="mt-3 rounded-md bg-black/[0.18] px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
              {escalationReason}
            </p>
          )}
          <p className="mt-3 text-[12.5px] leading-relaxed text-text-tertiary">
            Flagged for senior admin review. Senior admins have full authority to review and make the final decision.
          </p>
        </div>
      </div>
    </div>
  )
}
