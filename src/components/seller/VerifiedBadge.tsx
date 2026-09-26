/**
 * VerifiedBadge — the blue check shown wherever a seller is KYC-verified.
 *
 * The glyph is Material Symbols' `Verified` via `@mui/icons-material`
 * (Apache-2.0, already a dependency and already used across the
 * calculator pages). It is the standard scalloped-disc-with-check mark,
 * so it carries the meaning people already recognise — and it stays
 * correct at any size without anyone maintaining path data by hand.
 *
 * One mark, one meaning. The listing card used to show a lime dot for
 * "verified" AND an invented rank shield beside it, which read as two
 * competing trust marks, one of them self-awarded. Rank belongs on the
 * storefront (see `SellerTierBadge`), not on a card where the only
 * question is whether the seller is real.
 */

import VerifiedIcon from '@mui/icons-material/Verified'
import { cn } from '@/lib/utils'

/** Twitter/X blue — the colour the mark is universally read in. */
const VERIFIED_BLUE = '#1D9BF0'

interface VerifiedBadgeProps {
  /** Rendered pixel size (width = height). Default 14. */
  size?: number
  className?: string
  /**
   * Set false when adjacent text already says "Verified", so a screen
   * reader does not announce it twice.
   */
  titled?: boolean
}

export function VerifiedBadge({
  size = 14,
  className,
  titled = true,
}: VerifiedBadgeProps) {
  return (
    <VerifiedIcon
      // MUI sizes from its own `fontSize` scale; an explicit px width
      // and height keeps the badge locked to the text it sits beside.
      sx={{ width: size, height: size, color: VERIFIED_BLUE }}
      className={cn('inline-block shrink-0 align-[-0.12em]', className)}
      role={titled ? 'img' : undefined}
      aria-label={titled ? 'Verified seller' : undefined}
      aria-hidden={titled ? undefined : true}
      focusable="false"
    />
  )
}
