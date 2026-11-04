'use client'

import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import type { VerificationStatus } from '@/lib/utils/seller-verification'
import {
  CaretLeft,
  ChatCircleText,
  CheckCircle,
  EnvelopeSimple,
  ShieldCheck,
  Warning,
  XCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AdminPanel, StatusBadge, adminBtn } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
import { STATUS_TONE, fmtDate, fmtDateTime } from './application-format'

/** A header icon button with a tooltip (email / message). */
function IconAction({
  label,
  icon: Icon,
  href,
  onClick,
}: {
  label: string
  icon: PhosphorIcon
  href?: string
  onClick?: () => void
}) {
  const cls =
    'grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-primary transition-colors hover:bg-white/[0.10]'
  const glyph = <Icon aria-hidden weight="bold" className="h-[18px] w-[18px]" />
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {href ? (
          <a href={href} aria-label={label} className={cls}>
            {glyph}
          </a>
        ) : (
          <button type="button" onClick={onClick} aria-label={label} className={cls}>
            {glyph}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent className="border-0 bg-bg-overlay-2 text-[12px]">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Verification ring: verified / applicable checks. */
function Ring({ verified, total }: { verified: number; total: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = total > 0 ? verified / total : 0
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-white/[0.08]" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn('transition-[stroke-dashoffset] duration-500', pct === 1 ? 'stroke-success' : 'stroke-warning')}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[13px] font-bold tabular-nums text-text-primary">
        {verified}/{total}
      </span>
    </div>
  )
}

// ─── Header — store identity + actions ───────────────────────────────────────

export function ApplicationHeader({
  application,
  shopName,
  statusLabel,
  diditSessionId,
  sellerTypeLabel,
  submittedAt,
  volumeLabel,
  isActionable,
  isProcessing,
  onMessage,
  onReject,
  onRequestChanges,
  onApprove,
}: {
  application: SellerApplication
  shopName: string
  statusLabel: string
  diditSessionId: string | null
  sellerTypeLabel: string
  submittedAt: string
  volumeLabel: string
  isActionable: boolean
  isProcessing: boolean
  onMessage: () => void
  onReject: () => void
  onRequestChanges: () => void
  onApprove: () => void
}) {
  return (
    <div>
      <Link
        href="/admin/sellers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Seller Applications
      </Link>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <GameTile
            src={application.store_image_url}
            name={shopName}
            className="h-16 w-16 rounded-lg text-[24px] sm:h-[72px] sm:w-[72px]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
                {shopName}
              </h1>
              <StatusBadge status={statusLabel} tone={STATUS_TONE[application.status] ?? 'neutral'} />
              {diditSessionId && <StatusBadge status="Didit Video Verified" tone="success" />}
            </div>
            <p className="mt-1 break-words text-[13px] text-text-secondary">
              by <span className="font-semibold text-text-primary">{application.display_name}</span>
              {application.user.username && <> · {application.user.username}</>} · {application.user.email} ·{' '}
              {sellerTypeLabel} Seller
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-tertiary">
              <div>
                Applied <span className="font-medium text-text-secondary">{fmtDateTime(submittedAt)}</span>
              </div>
              <div>
                Country <span className="font-medium text-text-secondary">{application.country || '—'}</span>
              </div>
              <div>
                Expected Volume <span className="font-medium text-text-secondary">{volumeLabel}</span>
              </div>
              <div>
                Ref <span className="font-mono font-medium text-text-secondary">{application.id.split('-')[0]}</span>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {application.user?.email && (
            <IconAction
              label="Email Seller"
              icon={EnvelopeSimple}
              href={`mailto:${application.user.email}?subject=${encodeURIComponent('Your DropMarket Seller Application')}`}
            />
          )}
          <IconAction label="Message Seller" icon={ChatCircleText} onClick={onMessage} />
          {isActionable && (
            <>
              <button type="button" onClick={onReject} disabled={isProcessing} className={adminBtn.danger}>
                Reject
              </button>
              <button type="button" onClick={onRequestChanges} disabled={isProcessing} className={adminBtn.secondary}>
                Request Changes
              </button>
              <button type="button" onClick={onApprove} disabled={isProcessing} className={adminBtn.primary}>
                <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
                Approve Seller
              </button>
            </>
          )}
          {application.status === 'approved' && (
            <span className="inline-flex h-10 items-center gap-2 rounded-md bg-success-bg px-3.5 text-[13px] font-semibold text-success">
              <ShieldCheck aria-hidden weight="bold" className="h-4 w-4" />
              Approved {fmtDate(application.reviewed_at)}
            </span>
          )}
          {application.status === 'rejected' && (
            <button type="button" onClick={onApprove} disabled={isProcessing} className={adminBtn.primary}>
              <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
              Approve Seller
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Verification + status banners ───────────────────────────────────────────

export function VerificationPanel({
  application,
  verification,
}: {
  application: SellerApplication
  verification: VerificationStatus
}) {
  return (
    <>
      <AdminPanel className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <Ring verified={verification.verified} total={verification.total} />
          <div>
            <p className="text-[14px] font-semibold text-text-primary">
              Verification: {verification.verified} of {verification.total} applicable checks
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-tertiary">
              {application.seller_type === 'business'
                ? 'Business seller — identity, address and business checks all apply.'
                : 'Individual seller — the business check doesn’t apply and is not counted.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:ml-auto lg:justify-end">
          {verification.checks.map((check) => (
            <span
              key={check.key}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                !check.applicable
                  ? 'bg-white/[0.04] text-text-disabled'
                  : check.ok
                    ? 'bg-success-bg text-success'
                    : 'bg-white/[0.06] text-text-secondary',
              )}
            >
              {check.applicable && check.ok ? (
                <CheckCircle aria-hidden weight="fill" className="h-3.5 w-3.5" />
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              )}
              {check.label}
              {!check.applicable && ' (N/A)'}
              {check.applicable && check.ok && check.viaDidit && ' · Didit Video'}
            </span>
          ))}
        </div>
      </AdminPanel>

      {/* Status banners */}
      {application.status === 'rejected' && application.rejection_reason && (
        <div className="rounded-lg bg-error-bg px-5 py-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-error">
            <XCircle aria-hidden weight="bold" className="h-4 w-4" /> Rejection Reason
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{application.rejection_reason}</p>
        </div>
      )}
      {application.status === 'info_requested' && application.admin_notes && (
        <div className="rounded-lg bg-warning-bg px-5 py-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
            <Warning aria-hidden weight="bold" className="h-4 w-4" /> Changes Requested From the Applicant
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{application.admin_notes}</p>
        </div>
      )}
    </>
  )
}
