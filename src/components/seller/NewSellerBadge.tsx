/**
 * NewSellerBadge — the plain "New Seller" label shown wherever the blue
 * VerifiedBadge would sit, for a seller who has not verified their identity
 * yet (open seller signup, 2026-10-08: list first, verify at withdrawal).
 * Deliberately quiet: text, not a chip, so it never competes with the one
 * trust mark (VerifiedBadge).
 */
import { cn } from '@/lib/utils'

export function NewSellerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-tertiary', className)}
      title="This seller has not verified their identity yet"
    >
      New Seller
    </span>
  )
}
