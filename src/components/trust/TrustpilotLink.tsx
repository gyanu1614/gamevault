/**
 * TrustpilotLink — our own Trustpilot profile link, not a TrustBox.
 *
 * WHY THIS EXISTS INSTEAD OF <TrustBox>
 * Every Trustpilot *display* widget (mini / microCombo / microStar / carousel /
 * grid) requires a Trustpilot Plus plan. On our current plan their API answers:
 *
 *   {"Error":["BusinessUnit does not have access to that trustbox"],
 *    "FallbackLogo":["Allowed"]}
 *
 * …so the bootstrap script replaces our markup with Trustpilot's own fallback
 * logo: a white slab whose link goes to trustpilot.com/?utm_medium=
 * trustboxfallback, NOT to our profile. Because that lives inside a
 * cross-origin iframe we cannot restyle it, theme it, or fix its href —
 * `data-theme="dark"` is simply ignored. Hence a plain link we fully control.
 *
 * Deliberately shows NO star rating or TrustScore. Rendering Trustpilot's
 * marks or a score outside their own widgets is restricted by their brand
 * terms, and we have nothing to show yet regardless.
 *
 * Hidden until NEXT_PUBLIC_TRUSTPILOT_HAS_REVIEWS is set: the profile
 * currently has 0 reviews, and sending buyers to an empty review page costs
 * more trust than showing nothing. Flip that env var once reviews land — no
 * code change needed. When/if Plus is bought, swap these call sites back to
 * <TrustBox> for the real widget.
 */

import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Trustpilot brand green — used only for their star glyph. */
const TRUSTPILOT_GREEN = '#00B67A'

const PROFILE_URL = 'https://www.trustpilot.com/review/dropmarket.gg'

export function TrustpilotLink({ className }: { className?: string }) {
  if (!process.env.NEXT_PUBLIC_TRUSTPILOT_HAS_REVIEWS) return null

  return (
    <a
      href={PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-2 rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] px-3.5 py-2 backdrop-blur-md transition-colors duration-200 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]',
        className,
      )}
    >
      {/* Trustpilot's star, drawn inline so it inherits our dark surface
          instead of arriving on a white iframe background. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill={TRUSTPILOT_GREEN}
      >
        <path d="M12 1.6l2.9 7.1 7.6.4-5.9 4.8 2 7.4-6.6-4.2-6.6 4.2 2-7.4L1.5 9.1l7.6-.4L12 1.6z" />
      </svg>
      <span className="text-[13px] font-semibold text-text-primary">
        Reviews On Trustpilot
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
    </a>
  )
}
