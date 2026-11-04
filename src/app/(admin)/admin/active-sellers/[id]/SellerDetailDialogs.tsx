'use client'

/**
 * The eight seller-detail dialogs (change tier, restrict / ban, remove
 * restriction, restriction history, in-app message, email, approve / reject
 * withdrawal). Loaded on first open by SellerDetailClient; the form state and
 * mutations stay there and arrive as props.
 */

import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple'
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { Prohibit } from '@phosphor-icons/react/dist/csr/Prohibit'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { cn } from '@/lib/utils'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import { TIERS } from '@/lib/seller/tiers'
import { money } from '@/lib/seller/format-amount'
import { accountInputCls } from '@/components/account/AccountSurface'
import { adminBtn } from '../../components/kit'
import { ActionDialog, DialogActions, Spinner, type DialogKind } from './SellerDetailDialogParts'
import { FIELD_LABEL, fmtDate, titleCase } from './seller-detail-format'

/** The slice of a react-query mutation the dialogs use. */
type DialogMutation<Variables = void> = {
  isPending: boolean
  mutate: (variables: Variables) => void
}

export default function SellerDetailDialogs({
  detail,
  dialog,
  setDialog,
  busy,
  shopName,
  tierChoice,
  setTierChoice,
  tierNotes,
  setTierNotes,
  tierMutation,
  restrictionReason,
  setRestrictionReason,
  restrictMutation,
  messageText,
  setMessageText,
  messageMutation,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  emailMutation,
  rejectReason,
  setRejectReason,
  withdrawalMutation,
}: {
  detail: SellerDetail
  dialog: DialogKind
  setDialog: (dialog: DialogKind) => void
  busy: boolean
  shopName: string
  tierChoice: string
  setTierChoice: (tier: string) => void
  tierNotes: string
  setTierNotes: (notes: string) => void
  tierMutation: DialogMutation
  restrictionReason: string
  setRestrictionReason: (reason: string) => void
  restrictMutation: DialogMutation<{ status: 'restricted' | 'banned' | 'active'; reason?: string }>
  messageText: string
  setMessageText: (text: string) => void
  messageMutation: DialogMutation
  emailSubject: string
  setEmailSubject: (subject: string) => void
  emailBody: string
  setEmailBody: (body: string) => void
  emailMutation: DialogMutation
  rejectReason: string
  setRejectReason: (reason: string) => void
  withdrawalMutation: DialogMutation<{ requestId: string; decision: 'approve' | 'reject'; reason?: string }>
}) {
  const { profile } = detail

  return (
    <>
      <ActionDialog
        open={dialog?.kind === 'tier'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Change Seller Tier"
        description="Updates commission, listing limits and the moderation threshold immediately. The seller is notified."
      >
        <div>
          <label htmlFor="tier-choice" className={FIELD_LABEL}>
            New Tier
          </label>
          <select id="tier-choice" value={tierChoice} onChange={(e) => setTierChoice(e.target.value)} className={accountInputCls}>
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
                {t.key === profile.seller_tier ? ' (Current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tier-notes" className={FIELD_LABEL}>
            Note (Optional)
          </label>
          <textarea
            id="tier-notes"
            value={tierNotes}
            onChange={(e) => setTierNotes(e.target.value)}
            rows={3}
            placeholder="Why this change? Kept in the tier history…"
            className={cn(accountInputCls, 'resize-none')}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => tierMutation.mutate()}
            disabled={busy || tierChoice === profile.seller_tier}
            className={adminBtn.primary}
          >
            {tierMutation.isPending ? <Spinner /> : <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />}
            {titleCase(profile.seller_tier)} → {titleCase(tierChoice)}
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'restrict'}
        busy={busy}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'restrict' && dialog.type === 'banned' ? 'Ban Seller' : 'Restrict Seller'}
        description={
          dialog?.kind === 'restrict' && dialog.type === 'banned'
            ? 'Bans the seller from all seller features and pauses their active listings.'
            : 'Blocks new listings and pauses their active listings.'
        }
      >
        <div>
          <label htmlFor="restriction-reason" className={FIELD_LABEL}>
            Reason
          </label>
          <textarea
            id="restriction-reason"
            value={restrictionReason}
            onChange={(e) => setRestrictionReason(e.target.value)}
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
            placeholder="Enter a detailed reason — the seller sees it…"
            required
          />
        </div>
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              dialog?.kind === 'restrict' && restrictMutation.mutate({ status: dialog.type, reason: restrictionReason })
            }
            disabled={!restrictionReason.trim() || busy}
            className={adminBtn.danger}
          >
            {restrictMutation.isPending ? (
              <Spinner />
            ) : dialog?.kind === 'restrict' && dialog.type === 'banned' ? (
              <Prohibit aria-hidden weight="bold" className="h-4 w-4" />
            ) : (
              <ShieldWarning aria-hidden weight="bold" className="h-4 w-4" />
            )}
            Confirm
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'unrestrict'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Remove Restriction?"
        description={
          <>
            <span className="font-semibold text-text-primary">{shopName}</span> can create and publish listings again.
            Paused listings stay paused — the seller republishes them.
          </>
        }
      >
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={() => restrictMutation.mutate({ status: 'active' })} disabled={busy} className={adminBtn.primary}>
            {restrictMutation.isPending ? <Spinner /> : <ShieldCheck aria-hidden weight="bold" className="h-4 w-4" />}
            Remove Restriction
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog open={dialog?.kind === 'history'} onClose={() => setDialog(null)} title="Restriction History">
        {detail.restrictions.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-text-tertiary">No restriction history.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {detail.restrictions.map((r) => (
              <div key={r.id} className="rounded-md bg-bg-overlay p-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-text-primary">
                    {r.restriction_type === 'restricted' && <ShieldWarning aria-hidden weight="bold" className="h-4 w-4 text-warning" />}
                    {r.restriction_type === 'banned' && <Prohibit aria-hidden weight="bold" className="h-4 w-4 text-error" />}
                    {r.restriction_type === 'unrestricted' && <CheckCircle aria-hidden weight="bold" className="h-4 w-4 text-success" />}
                    {titleCase(r.restriction_type)}
                  </span>
                  <span className="text-[12px] text-text-tertiary">{fmtDate(r.created_at)}</span>
                </div>
                {r.reason && <p className="text-[12.5px] text-text-secondary">{r.reason}</p>}
                {r.admin && <p className="mt-1 text-[12px] text-text-tertiary">By {r.admin.username || r.admin.email}</p>}
              </div>
            ))}
          </div>
        )}
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'message'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Send In-App Message"
        description="Lands in their notifications instantly, linked to their seller status page."
      >
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="seller-message" className="text-[13px] font-medium text-text-secondary">
              Message
            </label>
            <span className="text-[12px] tabular-nums text-text-tertiary">{messageText.length}/500</span>
          </div>
          <textarea
            id="seller-message"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Quick question about your recent listings…"
            className={cn(accountInputCls, 'resize-none')}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={() => messageMutation.mutate()} disabled={busy || !messageText.trim()} className={adminBtn.primary}>
            {messageMutation.isPending ? <Spinner /> : <PaperPlaneTilt aria-hidden weight="bold" className="h-4 w-4" />}
            Send Message
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'email'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Send Email"
        description={`Branded DropMarket email to ${profile.email}. Replies reach the support inbox.`}
      >
        <div>
          <label htmlFor="email-subject" className={FIELD_LABEL}>
            Subject
          </label>
          <input
            id="email-subject"
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            maxLength={150}
            placeholder="e.g. About your DropMarket shop…"
            className={accountInputCls}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="email-body" className="text-[13px] font-medium text-text-secondary">
              Body
            </label>
            <span className="text-[12px] tabular-nums text-text-tertiary">{emailBody.length}/3000</span>
          </div>
          <textarea
            id="email-body"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={6}
            maxLength={3000}
            placeholder="Write the email body…"
            className={cn(accountInputCls, 'resize-none')}
          />
        </div>
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => emailMutation.mutate()}
            disabled={busy || !emailSubject.trim() || !emailBody.trim()}
            className={adminBtn.primary}
          >
            {emailMutation.isPending ? <Spinner /> : <EnvelopeSimple aria-hidden weight="bold" className="h-4 w-4" />}
            Send Email
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'withdrawal-approve'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Approve Withdrawal?"
        description={
          dialog?.kind === 'withdrawal-approve' ? (
            <>
              Approves the <span className="font-semibold tabular-nums text-text-primary">{money(dialog.amount)}</span> payout
              request — the seller is notified and ops sends the money.
            </>
          ) : null
        }
      >
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              dialog?.kind === 'withdrawal-approve' &&
              withdrawalMutation.mutate({ requestId: dialog.requestId, decision: 'approve' })
            }
            disabled={busy}
            className={adminBtn.primary}
          >
            {withdrawalMutation.isPending ? <Spinner /> : <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />}
            Approve Withdrawal
          </button>
        </DialogActions>
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'withdrawal-reject'}
        busy={busy}
        onClose={() => setDialog(null)}
        title="Reject Withdrawal"
        description={
          dialog?.kind === 'withdrawal-reject' ? (
            <>
              Declines the <span className="font-semibold tabular-nums text-text-primary">{money(dialog.amount)}</span> request
              and releases the hold — funds return to the seller&apos;s balance.
            </>
          ) : null
        }
      >
        <div>
          <label htmlFor="withdrawal-reject-reason" className={FIELD_LABEL}>
            Rejection Reason
          </label>
          <textarea
            id="withdrawal-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className={cn(accountInputCls, 'resize-none')}
            rows={3}
            placeholder="The seller sees this reason…"
            required
          />
        </div>
        <DialogActions>
          <button type="button" onClick={() => setDialog(null)} disabled={busy} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              dialog?.kind === 'withdrawal-reject' &&
              withdrawalMutation.mutate({ requestId: dialog.requestId, decision: 'reject', reason: rejectReason })
            }
            disabled={busy || !rejectReason.trim()}
            className={adminBtn.danger}
          >
            {withdrawalMutation.isPending ? <Spinner /> : <X aria-hidden weight="bold" className="h-4 w-4" />}
            Reject Withdrawal
          </button>
        </DialogActions>
      </ActionDialog>
    </>
  )
}
