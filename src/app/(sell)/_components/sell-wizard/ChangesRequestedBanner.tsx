import { Clock } from 'lucide-react'

/** Edit mode, an offer the review team bounced back: what they asked for. Saving resubmits it. */
export function ChangesRequestedBanner({ notes }: { notes: string | null }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-warning-bg px-3 py-2.5">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.5} />
      <div className="min-w-0 flex-1 text-[13px]">
        <span className="font-semibold text-warning">Changes Requested.</span>{' '}
        <span className="text-text-secondary">
          {notes || 'Our review team asked for changes to this offer.'} Saving your update resubmits it for review.
        </span>
      </div>
    </div>
  )
}
