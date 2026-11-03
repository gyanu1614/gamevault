'use client'

/**
 * Seller detail, right column actions: Seller Management (restrict / ban) and
 * Contact Seller (in-app message + email, recent reviews). The buttons only
 * open dialogs; the dialogs and their mutations live with SellerDetailClient.
 */

import { ChatCircleText } from '@phosphor-icons/react/dist/csr/ChatCircleText'
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple'
import { Prohibit } from '@phosphor-icons/react/dist/csr/Prohibit'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning'
import { Star } from '@phosphor-icons/react/dist/csr/Star'
import { cn } from '@/lib/utils'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import { adminBtn } from '../../components/kit'
import { Section } from './SellerDetailParts'
import type { DialogKind } from './SellerDetailDialogParts'
import { INNER_LABEL, ROWS, fmtDate } from './seller-detail-format'

export function SellerManagementSection({
  detail,
  busy,
  onRestrict,
  setDialog,
}: {
  detail: SellerDetail
  busy: boolean
  /** Clears the reason field and opens the Restrict / Ban dialog. */
  onRestrict: (type: 'restricted' | 'banned') => void
  setDialog: (dialog: DialogKind) => void
}) {
  const { profile } = detail
  const restrictedish = profile.seller_status === 'restricted' || profile.seller_status === 'banned'

  return (
    <Section title="Seller Management" sub="Restrict or ban this seller’s account.">
      {restrictedish && (
        <div
          className={cn(
            'mb-3 rounded-md px-3.5 py-3',
            profile.seller_status === 'banned' ? 'bg-error-bg' : 'bg-warning-bg',
          )}
        >
          <p
            className={cn(
              'flex items-center gap-2 text-[13px] font-semibold',
              profile.seller_status === 'banned' ? 'text-error' : 'text-warning',
            )}
          >
            {profile.seller_status === 'banned' ? (
              <Prohibit aria-hidden weight="bold" className="h-4 w-4" />
            ) : (
              <ShieldWarning aria-hidden weight="bold" className="h-4 w-4" />
            )}
            Currently {profile.seller_status === 'banned' ? 'Banned' : 'Restricted'}
          </p>
          {profile.seller_restriction_reason && (
            <p className="mt-1.5 text-[12.5px] text-text-secondary">Reason: {profile.seller_restriction_reason}</p>
          )}
          {profile.seller_restricted_at && (
            <p className="mt-1 text-[12px] text-text-tertiary">Since {fmtDate(profile.seller_restricted_at)}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {restrictedish ? (
          <button type="button" onClick={() => setDialog({ kind: 'unrestrict' })} disabled={busy} className={adminBtn.primary}>
            <ShieldCheck aria-hidden weight="bold" className="h-4 w-4" />
            Remove Restriction
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onRestrict('restricted')}
              disabled={busy}
              className={cn(adminBtn.secondary, 'text-warning')}
            >
              <ShieldWarning aria-hidden weight="bold" className="h-4 w-4" />
              Restrict
            </button>
            <button
              type="button"
              onClick={() => onRestrict('banned')}
              disabled={busy}
              className={adminBtn.danger}
            >
              <Prohibit aria-hidden weight="bold" className="h-4 w-4" />
              Ban
            </button>
          </>
        )}
        <button type="button" onClick={() => setDialog({ kind: 'history' })} className={adminBtn.secondary}>
          <ClockCounterClockwise aria-hidden weight="bold" className="h-4 w-4" />
          Restriction History
        </button>
      </div>

      <p className="mt-3 rounded-md bg-bg-overlay px-3.5 py-2.5 text-[12px] leading-relaxed text-text-tertiary">
        <span className="font-semibold text-text-secondary">Restrict / Ban:</span> pauses all active listings ·{' '}
        <span className="font-semibold text-text-secondary">Remove Restriction:</span> does NOT unpause them — the
        seller republishes from their dashboard.
      </p>
    </Section>
  )
}

export function SellerContactSection({
  detail,
  onMessage,
  onEmail,
}: {
  detail: SellerDetail
  /** Clears the message field and opens the in-app message dialog. */
  onMessage: () => void
  /** Clears the subject + body and opens the email dialog. */
  onEmail: () => void
}) {
  const { profile } = detail

  return (
    <Section title="Contact Seller" sub="In-app message or branded email — both are logged.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onMessage} className={adminBtn.secondary}>
          <ChatCircleText aria-hidden weight="bold" className="h-4 w-4" />
          Send In-App Message
        </button>
        <button type="button" onClick={onEmail} disabled={!profile.email} className={adminBtn.secondary}>
          <EnvelopeSimple aria-hidden weight="bold" className="h-4 w-4" />
          Send Email
        </button>
      </div>

      {detail.reviews.length > 0 && (
        <div className="mt-4">
          <p className={INNER_LABEL}>Recent Reviews</p>
          <div className={ROWS}>
            {detail.reviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0">
                {r.rating != null && (
                  <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-warning">
                    <Star aria-hidden weight="fill" className="h-3.5 w-3.5" />
                    {r.rating}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary">{r.title || r.comment || '—'}</span>
                <span className="text-[12px] text-text-tertiary">{fmtDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}
