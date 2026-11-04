'use client'

/**
 * The four moderation dialogs (approve, reject, request changes, bulk
 * approve). The page loads this file with next/dynamic the first time one
 * opens; the state and the mutations stay in ModerationPageClient.
 */

import { ChatText, CheckCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { adminBtn } from '../../components/kit'
import { TierChip } from '../../components/TierChip'
import { ListingThumb, SellerAvatar } from './ModerationThumbs'
import { FIELD_LABEL, type SellerGroup, money } from './moderation-format'

export default function ModerationDialogs({
  dialog,
  selectedListing,
  bulkGroup,
  approvalNotes,
  setApprovalNotes,
  rejectReason,
  setRejectReason,
  changeRequest,
  setChangeRequest,
  closeDialog,
  closeBulk,
  onApprove,
  onReject,
  onRequestChanges,
  onBulkApprove,
}: {
  dialog: 'approve' | 'reject' | 'changes' | null
  selectedListing: any
  bulkGroup: SellerGroup | null
  approvalNotes: string
  setApprovalNotes: (value: string) => void
  rejectReason: string
  setRejectReason: (value: string) => void
  changeRequest: string
  setChangeRequest: (value: string) => void
  closeDialog: () => void
  closeBulk: () => void
  onApprove: (vars: { id: string; sellerId?: string; notes?: string }) => void
  onReject: (vars: { id: string; reason: string }) => void
  onRequestChanges: (vars: { id: string; changes: string }) => void
  onBulkApprove: (group: SellerGroup) => void
}) {
  return (
    <>
      {/* ── Approve dialog ── */}
      <ModDialog
        open={dialog === 'approve' && !!selectedListing}
        onClose={closeDialog}
        title="Approve Listing"
        description="This listing goes live for buyers immediately."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-approve-notes" className={FIELD_LABEL}>
            Notes (Optional)
          </label>
          <textarea
            id="mod-approve-notes"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add any internal notes…"
            className={cn(accountInputCls, 'resize-none')}
            rows={3}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={closeDialog} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              onApprove({
                id: selectedListing.id,
                sellerId: selectedListing.seller_id,
                notes: approvalNotes || undefined,
              })
            }
            className={adminBtn.primary}
          >
            <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
            Approve Listing
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Reject dialog ── */}
      <ModDialog
        open={dialog === 'reject' && !!selectedListing}
        onClose={closeDialog}
        title="Reject Listing"
        description="The seller is notified with your reason. The listing will not go live."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-reject-reason" className={FIELD_LABEL}>
            Rejection Reason <span className="text-error">*</span>
          </label>
          <textarea
            id="mod-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this listing is being rejected…"
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={closeDialog} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              onReject({ id: selectedListing.id, reason: rejectReason })
            }
            disabled={!rejectReason.trim()}
            className={adminBtn.danger}
          >
            <XCircle aria-hidden weight="bold" className="h-4 w-4" />
            Reject Listing
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Request-changes dialog ── */}
      <ModDialog
        open={dialog === 'changes' && !!selectedListing}
        onClose={closeDialog}
        title={
          selectedListing?.status === 'changes_requested' ? 'Update Request' : 'Request Changes'
        }
        description="The listing moves to Awaiting Seller. They see your notes and resubmit for review."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-changes" className={FIELD_LABEL}>
            Required Changes <span className="text-error">*</span>
          </label>
          <textarea
            id="mod-changes"
            value={changeRequest}
            onChange={(e) => setChangeRequest(e.target.value)}
            placeholder="Describe what needs to be changed…"
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={closeDialog} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              onRequestChanges({ id: selectedListing.id, changes: changeRequest })
            }
            disabled={!changeRequest.trim()}
            className={adminBtn.primary}
          >
            <ChatText aria-hidden weight="bold" className="h-4 w-4" />
            Send Request
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Bulk-approve confirm dialog ── */}
      <ModDialog
        open={!!bulkGroup}
        onClose={closeBulk}
        title="Approve All Listings"
        description={`All ${bulkGroup?.listings.length ?? 0} pending listing${
          (bulkGroup?.listings.length ?? 0) === 1 ? '' : 's'
        } from this seller go live for buyers immediately.`}
        sellerHeader={bulkGroup?.seller}
        sellerListingCount={bulkGroup?.listings.length ?? 0}
      >
        <DialogActions>
          <button type="button" onClick={closeBulk} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => bulkGroup && onBulkApprove(bulkGroup)}
            className={adminBtn.primary}
          >
            <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
            Approve All ({bulkGroup?.listings.length})
          </button>
        </DialogActions>
      </ModDialog>
    </>
  )
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

/**
 * Title + description, then a context row showing WHAT the admin is acting
 * on (listing thumbnail + title + seller — or the seller themselves for bulk
 * approve), then the caller's body + actions.
 */
function ModDialog({
  open,
  onClose,
  title,
  description,
  listing,
  sellerHeader,
  sellerListingCount,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  listing?: any
  /** Bulk mode: show the seller (avatar + name + pending count) instead of a listing. */
  sellerHeader?: any
  sellerListingCount?: number
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>
        </div>

        {listing && (
          <div className="flex items-center gap-3 rounded-md bg-bg-overlay px-3 py-2.5">
            <ListingThumb listing={listing} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
                <span className="font-semibold tabular-nums text-text-secondary">{money(listing.price)}</span>
                {listing.game?.name ? ` · ${listing.game.name}` : ''}
                {listing.category?.name ? ` · ${listing.category.name}` : ''}
                {' · '}
                {listing.seller?.shop_name || listing.seller?.username || 'Unknown seller'}
              </p>
            </div>
          </div>
        )}
        {sellerHeader !== undefined && (
          <div className="flex items-center gap-3 rounded-md bg-bg-overlay px-3 py-2.5">
            <SellerAvatar seller={sellerHeader} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-primary">
                {sellerHeader?.shop_name || sellerHeader?.username || 'Unknown Seller'}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
                {sellerListingCount} pending listing{sellerListingCount === 1 ? '' : 's'}
              </p>
            </div>
            <TierChip tier={sellerHeader?.seller_tier} className="shrink-0" />
          </div>
        )}

        {children}
      </DialogContent>
    </Dialog>
  )
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
}
