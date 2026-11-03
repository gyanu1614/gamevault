'use client'

/**
 * The five application dialogs (approve, reject, message, request changes,
 * Didit session). ApplicationDetail loads this file with next/dynamic the
 * first time one opens; the state and the handlers stay there.
 */

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { IdentityAssessment } from '@/lib/utils/seller-verification'
import {
  CheckCircle,
  CircleNotch,
  PaperPlaneTilt,
  Warning,
  XCircle,
} from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { accountInputCls } from '@/components/account/AccountSurface'
import { adminBtn } from '../../components/kit'
import { FIELD_LABEL } from './application-format'

// ssr:false — the Didit session body only mounts inside its open dialog.
const DiditSessionBody = dynamic(() => import('./DiditSessionBody'), { ssr: false })

/** The shared Radix dialog, sized for these forms; closing is blocked while busy. */
function ActionDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className={cn('max-w-[480px] border-0 p-5 sm:p-6', className)}>
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default function ApplicationDialogs({
  shopName,
  diditSessionId,
  isProcessing,
  isSendingMessage,
  showApproveModal,
  approveGap,
  kycGap,
  pendingFounding,
  closeApprove,
  handleApprove,
  showRejectModal,
  rejectionCategory,
  setRejectionCategory,
  rejectionReason,
  setRejectionReason,
  closeReject,
  handleReject,
  showMessageModal,
  outreachText,
  setOutreachText,
  closeMessage,
  handleSendMessage,
  showChangesModal,
  changesMessage,
  setChangesMessage,
  closeChanges,
  handleRequestChanges,
  showDiditModal,
  closeDidit,
}: {
  shopName: string
  diditSessionId: string | null
  isProcessing: boolean
  isSendingMessage: boolean
  // Approve
  showApproveModal: boolean
  approveGap: boolean
  kycGap: IdentityAssessment | null
  pendingFounding: boolean
  closeApprove: () => void
  handleApprove: (asFounding?: boolean, acknowledgeKycGap?: boolean) => void
  // Reject
  showRejectModal: boolean
  rejectionCategory: string
  setRejectionCategory: (value: string) => void
  rejectionReason: string
  setRejectionReason: (value: string) => void
  closeReject: () => void
  handleReject: () => void
  // Message the seller
  showMessageModal: boolean
  outreachText: string
  setOutreachText: (value: string) => void
  closeMessage: () => void
  handleSendMessage: () => void
  // Request changes
  showChangesModal: boolean
  changesMessage: string
  setChangesMessage: (value: string) => void
  closeChanges: () => void
  handleRequestChanges: () => void
  // Didit session
  showDiditModal: boolean
  closeDidit: () => void
}) {
  return (
    <>
      <ActionDialog
        open={showApproveModal}
        busy={isProcessing}
        onClose={closeApprove}
        title="Approve Seller?"
        description={
          <>
            This grants <span className="font-semibold text-text-primary">{shopName}</span> the seller dashboard and lets
            them start listing.
          </>
        }
      >
        {/* ACC-02 — identity not verified: say exactly what is missing. The
            admin may still approve; the decision is recorded in the audit log
            and profiles.kyc_status stays 'pending'. */}
        {approveGap && (
          <div role="alert" className="rounded-md bg-warning-bg px-4 py-3 text-[13px] leading-relaxed text-warning">
            <p className="font-semibold">Identity Not Verified</p>
            {kycGap ? (
              <ul className="mt-1 list-disc pl-4">
                {kycGap.missing.map((m) => <li key={`m-${m}`}>{m}: not uploaded</li>)}
                {kycGap.unverified.map((u) => <li key={`u-${u}`}>{u}: uploaded, not verified</li>)}
              </ul>
            ) : (
              <p className="mt-1">A verified government ID and selfie (or a Didit session) are not on file.</p>
            )}
            <p className="mt-1.5 text-text-secondary">
              Approving now grants seller access without a verified identity and records that you accepted the gap.
            </p>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={closeApprove}
            disabled={isProcessing}
            className={cn(adminBtn.secondary, 'sm:flex-1')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleApprove(kycGap ? pendingFounding : false, kycGap !== null)}
            disabled={isProcessing}
            className={cn(adminBtn.primary, 'sm:flex-1')}
          >
            {isProcessing ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
            )}
            {isProcessing ? 'Approving…' : kycGap ? 'Approve Anyway' : 'Approve'}
          </button>
        </div>
        {/* Founding grant is otherwise a separate toggle the admin has to
            remember; this closes the promise for a courted lead in one click.
            (A waitlist founder is auto-granted founding by plain Approve too —
            this button forces it for anyone.) */}
        <button
          type="button"
          onClick={() => handleApprove(true, kycGap !== null)}
          disabled={isProcessing}
          className={cn(adminBtn.secondary, 'w-full text-warning')}
        >
          <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
          Approve as Founding Seller
        </button>
      </ActionDialog>

      <ActionDialog
        open={showRejectModal}
        busy={isProcessing}
        onClose={closeReject}
        title="Reject Application"
        description="Give a clear reason; the applicant sees it."
      >
        <div>
          <label htmlFor="reject-category" className={FIELD_LABEL}>
            Rejection Category
          </label>
          <select
            id="reject-category"
            value={rejectionCategory}
            onChange={(e) => setRejectionCategory(e.target.value)}
            className={accountInputCls}
            required
          >
            <option value="incomplete_documentation">Incomplete Documentation</option>
            <option value="invalid_documents">Invalid or Expired Documents</option>
            <option value="information_mismatch">Information Mismatch</option>
            <option value="suspicious_activity">Suspicious Activity</option>
            <option value="business_verification_failed">Business Verification Failed</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="reject-reason" className={FIELD_LABEL}>
            Rejection Reason
          </label>
          <textarea
            id="reject-reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
            placeholder="Enter a detailed reason for the rejection…"
            required
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={closeReject} disabled={isProcessing} className={cn(adminBtn.secondary, 'sm:flex-1')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={!rejectionReason.trim() || isProcessing}
            className={cn(adminBtn.danger, 'sm:flex-1')}
          >
            {isProcessing ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle aria-hidden weight="bold" className="h-4 w-4" />
            )}
            {isProcessing ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </ActionDialog>

      <ActionDialog
        open={showMessageModal}
        busy={isSendingMessage}
        onClose={closeMessage}
        title="Message Seller"
        description="Lands in their notifications instantly, linked to their application status."
      >
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="outreach-text" className="text-[13px] font-medium text-text-secondary">
              Message
            </label>
            <span className="text-[12px] tabular-nums text-text-tertiary">{outreachText.length}/500</span>
          </div>
          <textarea
            id="outreach-text"
            value={outreachText}
            onChange={(e) => setOutreachText(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Quick question about your payout details…"
            className={cn(accountInputCls, 'resize-none')}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={closeMessage} disabled={isSendingMessage} className={cn(adminBtn.secondary, 'sm:flex-1')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={isSendingMessage || !outreachText.trim()}
            className={cn(adminBtn.primary, 'sm:flex-1')}
          >
            {isSendingMessage ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneTilt aria-hidden weight="bold" className="h-4 w-4" />
            )}
            Send Message
          </button>
        </div>
      </ActionDialog>

      <ActionDialog
        open={showChangesModal}
        busy={isProcessing}
        onClose={closeChanges}
        title="Request Changes"
        description={
          <>
            The applicant gets your note by email and the application moves to{' '}
            <span className="font-semibold text-text-primary">Changes Requested</span> until they respond.
          </>
        }
      >
        <div>
          <label htmlFor="changes-message" className={FIELD_LABEL}>
            What Needs to Change
          </label>
          <textarea
            id="changes-message"
            value={changesMessage}
            onChange={(e) => setChangesMessage(e.target.value)}
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
            placeholder="e.g. Your proof of address is older than 3 months — please upload a recent utility bill…"
            required
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={closeChanges} disabled={isProcessing} className={cn(adminBtn.secondary, 'sm:flex-1')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRequestChanges}
            disabled={!changesMessage.trim() || isProcessing}
            className={cn(adminBtn.primary, 'sm:flex-1')}
          >
            {isProcessing ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <Warning aria-hidden weight="bold" className="h-4 w-4" />
            )}
            {isProcessing ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </ActionDialog>

      <ActionDialog
        open={showDiditModal && !!diditSessionId}
        onClose={closeDidit}
        title="Didit Verification Session"
      >
        {diditSessionId && <DiditSessionBody sessionId={diditSessionId} />}
      </ActionDialog>
    </>
  )
}
