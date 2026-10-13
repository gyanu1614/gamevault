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
 * Rendered only by <TrustpilotShowcase>, which shows it once an admin has
 * recorded 10+ reviews on /admin and no TrustBox template id is configured.
 */

import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { cn } from '@/lib/utils'
import { TRUSTPILOT_PROFILE_URL } from '@/lib/trustpilot/links'

/** Trustpilot brand green — used only for their star glyph. */
const TRUSTPILOT_GREEN = '#00B67A'


export function TrustpilotLink({ className }: { className?: string }) {
  return (
    <a
      href={TRUSTPILOT_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-2 rounded-lg bg-[#16171B] px-3.5 py-2 transition-colors duration-200 hover:bg-[#24252B] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
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
      <OpenInNewIcon aria-hidden sx={{ fontSize: 14 }} className="shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
    </a>
  )
}
