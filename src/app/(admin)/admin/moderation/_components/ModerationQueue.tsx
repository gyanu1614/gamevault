'use client'

import { ChatText, CheckCircle, ClockCounterClockwise, XCircle } from '@phosphor-icons/react'
import { useNow } from '@/hooks/use-now'
import {
  AdminEmpty,
  AdminLoadingRows,
  StatusBadge,
  adminBtn,
  adminBtnSm,
} from '../../components/kit'
import { ErrorPanel } from './ErrorPanel'
import { ListingThumb } from './ModerationThumbs'
import { SellerGroupCard } from './SellerGroupCard'
import { type SellerGroup, money, relativeTime } from './moderation-format'

/** The Pending and Awaiting Seller tabs: error, loading, empty, or the rows. */
export function ModerationQueue({
  tab,
  errored,
  loading,
  errorMessage,
  retrying,
  onRetry,
  sellerGroups,
  filteredAwaiting,
  q,
  onViewHistory,
  onApprove,
  onReject,
  onChanges,
  onBulkApprove,
  onUpdateRequest,
}: {
  tab: 'pending' | 'awaiting'
  errored: boolean
  loading: boolean
  errorMessage?: string
  retrying: boolean
  onRetry: () => void
  sellerGroups: SellerGroup[]
  filteredAwaiting: any[]
  /** The trimmed, lower-cased search text. */
  q: string
  onViewHistory: () => void
  onApprove: (listing: any) => void
  onReject: (listing: any) => void
  onChanges: (listing: any) => void
  onBulkApprove: (group: SellerGroup) => void
  onUpdateRequest: (listing: any) => void
}) {
  const viewHistory = (
    <button type="button" onClick={onViewHistory} className={adminBtn.secondary}>
      <ClockCounterClockwise aria-hidden weight="bold" className="h-4 w-4" />
      View History
    </button>
  )

  return errored ? (
    <ErrorPanel message={errorMessage} onRetry={onRetry} retrying={retrying} />
  ) : loading ? (
    <AdminLoadingRows rows={5} />
  ) : tab === 'pending' ? (
    sellerGroups.length === 0 ? (
      <AdminEmpty
        icon={CheckCircle}
        tone={q ? 'neutral' : 'success'}
        title={q ? 'No Matches' : 'All Caught Up'}
        hint={q ? 'No pending listings match your search.' : 'Every submitted listing has been reviewed.'}
        action={viewHistory}
      />
    ) : (
      <div className="space-y-3">
        {sellerGroups.map((group) => (
          <SellerGroupCard
            key={group.sellerId}
            group={group}
            onApprove={onApprove}
            onReject={onReject}
            onChanges={onChanges}
            onBulkApprove={() => onBulkApprove(group)}
          />
        ))}
      </div>
    )
  ) : filteredAwaiting.length === 0 ? (
    <AdminEmpty
      icon={ChatText}
      title={q ? 'No Matches' : 'Nothing Awaiting Sellers'}
      hint={q ? 'No awaiting listings match your search.' : 'No listings are waiting on seller changes.'}
      action={viewHistory}
    />
  ) : (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {filteredAwaiting.map((listing: any) => (
        <AwaitingRow
          key={listing.id}
          listing={listing}
          onUpdateRequest={() => onUpdateRequest(listing)}
          onReject={() => onReject(listing)}
        />
      ))}
    </div>
  )
}

// ─── Awaiting-seller row ─────────────────────────────────────────────────────

function AwaitingRow({
  listing,
  onUpdateRequest,
  onReject,
}: {
  listing: any
  onUpdateRequest: () => void
  onReject: () => void
}) {
  const now = useNow()
  const requestedAt = listing.changes_requested_at || listing.updated_at

  return (
    <div className="flex flex-col rounded-lg bg-bg-raised p-4">
      <div className="flex min-w-0 items-start gap-3">
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
            <StatusBadge status="Awaiting Seller" tone="warning" className="shrink-0" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-tertiary">
            <span className="font-semibold tabular-nums text-text-primary">{money(listing.price)}</span>
            <span className="truncate">{listing.seller?.shop_name || listing.seller?.username || 'Unknown'}</span>
            <span className="truncate">
              {listing.game?.name}
              {listing.category?.name ? ` · ${listing.category.name}` : ''}
            </span>
            {now != null && requestedAt && <span>Asked {relativeTime(requestedAt, now)}</span>}
          </div>
        </div>
      </div>
      {listing.moderation_notes && (
        <p className="mt-3 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-warning">Requested: </span>
          {listing.moderation_notes}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
        <button type="button" onClick={onUpdateRequest} className={adminBtnSm.secondary}>
          <ChatText aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Update Request
        </button>
        <button type="button" onClick={onReject} className={adminBtnSm.danger}>
          <XCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  )
}
