/**
 * "How did it go?" — the slim Trustpilot line on a completed order.
 *
 * Shown to EVERY buyer of a completed order (never only the happy ones —
 * Trustpilot bans selective asking) and it offers nothing in return for a
 * review. Flat card, no stars or score: the profile has no reviews to show yet.
 */
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { cn } from '@/lib/utils'
import { TRUSTPILOT_REVIEW_URL } from '@/lib/trustpilot/links'

export function TrustpilotReviewLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg bg-[#16171B] px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm leading-snug text-text-secondary">
        <span className="font-semibold text-text-primary">How Did It Go?</span>{' '}
        Tell other buyers about DropMarket on Trustpilot.
      </p>
      <a
        href={TRUSTPILOT_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3.5 text-[13px] font-semibold text-[#0F1012] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring sm:self-auto"
      >
        Review Us On Trustpilot
        <OpenInNewIcon aria-hidden sx={{ fontSize: 15 }} />
      </a>
    </div>
  )
}
