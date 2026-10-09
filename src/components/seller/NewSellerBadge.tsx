/**
 * NewSellerBadge — the trust mark for a seller who has not verified their
 * identity yet (open seller signup, 2026-10-08: list first, verify at
 * withdrawal). Owner call: the SAME scalloped check as VerifiedBadge, greyed,
 * with "New Seller" on hover — no text on the surface. Once verified the
 * surface swaps to the blue VerifiedBadge; buyers learn one shape, two states.
 */
import VerifiedIcon from '@mui/icons-material/Verified'
import { cn } from '@/lib/utils'

const NEW_GREY = 'rgba(154,166,179,0.55)'

export function NewSellerBadge({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <VerifiedIcon
      sx={{ width: size, height: size, color: NEW_GREY }}
      className={cn('inline-block shrink-0 align-[-0.12em]', className)}
      role="img"
      aria-label="New seller, not yet identity-verified"
      titleAccess="New Seller"
      focusable="false"
    />
  )
}
