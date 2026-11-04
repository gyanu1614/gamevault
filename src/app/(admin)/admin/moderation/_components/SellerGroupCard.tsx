'use client'

import { ChatText, CheckCircle, Eye, XCircle } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { adminBtnSm } from '../../components/kit'
import { TierChip } from '../../components/TierChip'
import { ListingThumb, SellerAvatar } from './ModerationThumbs'
import {
  CHIP,
  type SellerGroup,
  isOlderThan24h,
  joinedLabel,
  money,
  previewHref,
  relativeTime,
  templateChips,
} from './moderation-format'

// ─── Seller group ────────────────────────────────────────────────────────────

export function SellerGroupCard({
  group,
  onApprove,
  onReject,
  onChanges,
  onBulkApprove,
}: {
  group: SellerGroup
  onApprove: (listing: any) => void
  onReject: (listing: any) => void
  onChanges: (listing: any) => void
  onBulkApprove: () => void
}) {
  const { seller, context } = group
  const name = seller?.shop_name || seller?.username || 'Unknown Seller'
  const joined = joinedLabel(seller?.created_at)

  const willCross =
    !!context && context.approvedCount + context.pendingCount >= context.threshold

  return (
    <section aria-label={name} className="overflow-hidden rounded-lg bg-bg-raised">
      {/* Group header */}
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <SellerAvatar seller={seller} />
          <div className="min-w-0 flex-1">
            {group.sellerId !== 'unknown' ? (
              <Link
                href={`/admin/active-sellers/${group.sellerId}`}
                className="block truncate text-[14.5px] font-semibold text-text-primary underline-offset-4 hover:underline"
              >
                {name}
              </Link>
            ) : (
              <p className="truncate text-[14.5px] font-semibold text-text-primary">{name}</p>
            )}
            <p className="truncate text-[12px] text-text-tertiary">
              {seller?.shop_name && seller?.username ? `@${seller.username}` : null}
              {seller?.shop_name && seller?.username && joined ? ' · ' : null}
              {joined}
            </p>
          </div>
          <button
            type="button"
            onClick={onBulkApprove}
            className={cn(adminBtnSm.primary, 'shrink-0')}
          >
            <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Approve All ({group.listings.length})
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-[52px]">
          <TierChip tier={seller?.seller_tier} />
          {context && (
            <span
              className={cn(CHIP, willCross ? 'bg-lime-tint-bg text-lime-text' : 'bg-white/[0.07] text-text-secondary')}
              title={`${context.approvedCount} of ${context.threshold} pre-moderation listings already approved · ${context.pendingCount} pending`}
            >
              {context.approvedCount}/{context.threshold} Reviewed
            </span>
          )}
          {context?.storePaused && <span className={cn(CHIP, 'bg-warning-bg text-warning')}>Store Paused</span>}
          {seller?.seller_status === 'restricted' && (
            <span className={cn(CHIP, 'bg-error-bg text-error')}>Restricted</span>
          )}
          {seller?.is_test && <span className={cn(CHIP, 'bg-white/[0.07] text-text-tertiary')}>Test</span>}
        </div>
      </div>

      {/* Listing rows */}
      <div className="space-y-1.5 px-2 pb-2">
        {group.listings.map((listing: any) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            onApprove={() => onApprove(listing)}
            onReject={() => onReject(listing)}
            onChanges={() => onChanges(listing)}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Listing row (pending) ───────────────────────────────────────────────────

function ListingRow({
  listing,
  onApprove,
  onReject,
  onChanges,
}: {
  listing: any
  onApprove: () => void
  onReject: () => void
  onChanges: () => void
}) {
  const now = useNow()
  const chips = templateChips(listing.template_data)
  const stale = isOlderThan24h(listing.created_at, now)
  const resubmitted =
    listing.status === 'pending_approval' && !!(listing.moderation_notes || '').trim()
  const preview = previewHref(listing)

  return (
    <div className="flex flex-col gap-3 rounded-md bg-bg-overlay p-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {preview ? (
              <Link
                href={preview}
                target="_blank"
                className="truncate text-[13.5px] font-semibold text-text-primary underline-offset-4 hover:underline"
              >
                {listing.title}
              </Link>
            ) : (
              <p className="truncate text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
            )}
            {resubmitted && (
              <span
                className={cn(CHIP, 'shrink-0 bg-white/[0.07] text-text-secondary')}
                title={`Previous request: ${listing.moderation_notes}`}
              >
                Resubmitted
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-tertiary">
            <span className="font-semibold tabular-nums text-text-primary">{money(listing.price)}</span>
            {listing.quantity != null && Number(listing.quantity) > 1 && (
              <span className="tabular-nums">×{listing.quantity}</span>
            )}
            {listing.reviewReason && (
              <span className="font-medium text-warning" title="Why this listing is in review">{listing.reviewReason}</span>
            )}
            <span className="truncate">
              {listing.game?.name}
              {listing.category?.name ? ` · ${listing.category.name}` : ''}
            </span>
            <span className={cn(stale && 'font-semibold text-warning')}>
              {relativeTime(listing.created_at, now)}
            </span>
            {chips.map((chip) => (
              <span
                key={chip.k}
                className="rounded bg-white/[0.06] px-1.5 py-px text-[11px] font-medium capitalize text-text-secondary"
              >
                {chip.k}: {chip.v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onApprove} className={cn(adminBtnSm.primary, 'min-w-0 flex-1 md:flex-none')}>
          <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Approve
        </button>
        <button type="button" onClick={onChanges} className={cn(adminBtnSm.secondary, 'min-w-0 flex-1 md:flex-none')}>
          <ChatText aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Changes
        </button>
        <button type="button" onClick={onReject} className={cn(adminBtnSm.danger, 'min-w-0 flex-1 md:flex-none')}>
          <XCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Reject
        </button>
        {/* Phones open the preview from the title instead. */}
        {preview && (
          <Link href={preview} target="_blank" className={cn(adminBtnSm.secondary, 'hidden md:inline-flex')}>
            <Eye aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Preview
          </Link>
        )}
      </div>
    </div>
  )
}
