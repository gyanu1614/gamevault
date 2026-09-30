'use client'

/**
 * /admin/sellers/[id] application detail (account-section design, 2026-09-30).
 *
 * Header led by the store identity (image tile + shop name + status/Didit
 * badges + quick actions), a verification panel (ring + the APPLICABLE
 * checks), then fill-only cards: Games & Categories, Identity & Documents
 * (Didit banner + doc previews), Experience & the signed Agreement, and the
 * Applicant / Timeline / Admin Notes / Seller Management rail.
 *
 * Action wiring is UNCHANGED: approve stays admin-seller-review's
 * approveApplication (profile promotion first; ACC-02 identity-gap
 * acknowledgement; founding grant), reject stays admin-sellers'
 * rejectApplication (tiered cooldown RPC), request changes is
 * admin-seller-review's requestMoreInfo, message is messageApplicant.
 */

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SellerApplication, KYCDocument } from '@/lib/actions/admin-sellers'
import { rejectApplication } from '@/lib/actions/admin-sellers'
// approve comes from the CANONICAL review module — it promotes the profile
// (role/shop_name/shop_slug/badges) FIRST, then flips the application status,
// sends the approval email + notification. The admin-sellers.ts copy only
// flipped the application row, leaving the seller without access.
import { approveApplication, requestMoreInfo, messageApplicant } from '@/lib/actions/admin-seller-review'
import type { IdentityAssessment } from '@/lib/utils/seller-verification'
import { getDocumentsSignedUrls } from '@/lib/actions/kyc-documents'
import {
  calculateVerificationStatus,
  findDiditEvidence,
  isDiditEvidence,
} from '@/lib/utils/seller-verification'
import {
  getDiditSessionDetails,
  type DiditSessionDetailsResult,
} from '@/lib/actions/admin-didit'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  VOLUME_LABELS,
  SELLER_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/seller-application/labels'
import { applicationStatusLabel } from '../_status'
import { toast } from 'sonner'
import {
  ArrowRight,
  ArrowSquareOut,
  CaretLeft,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  EnvelopeSimple,
  FileArrowDown,
  GameController,
  IdentificationCard,
  NotePencil,
  PaperPlaneTilt,
  ShieldCheck,
  Signature,
  User,
  Warning,
  XCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { accountInputCls } from '@/components/account/AccountSurface'
import { AdminPanel, IconChip, StatusBadge, adminBtn, type ChipTone } from '../../components/kit'
import { GameTile } from '../../components/GameTile'

interface ApplicationDetailProps {
  application: SellerApplication
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** 'top-up' / 'game_coins' → 'Top Up' / 'Game Coins' (Title Case). */
function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function isImageFile(name: string | null | undefined): boolean {
  return !!name && /\.(png|jpe?g|webp|gif|avif)$/i.test(name)
}

const STATUS_TONE: Record<string, ChipTone> = {
  pending: 'warning',
  under_review: 'warning',
  info_requested: 'info',
  approved: 'success',
  rejected: 'error',
  withdrawn: 'neutral',
}

// ─── Small primitives ────────────────────────────────────────────────────────

function Card({
  icon,
  title,
  sub,
  children,
  className,
}: {
  icon: PhosphorIcon
  title: string
  sub?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <AdminPanel className={className}>
      <div className="mb-4 flex items-start gap-3">
        <IconChip icon={icon} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-text-primary">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">{sub}</p>}
        </div>
      </div>
      {children}
    </AdminPanel>
  )
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-text-tertiary">{k}</div>
      <div className={cn('mt-0.5 break-words text-[13.5px] text-text-primary', mono && 'font-mono text-[12.5px]')}>{v || '—'}</div>
    </div>
  )
}

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

const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

// ─── Didit session details ───────────────────────────────────────────────────

/** Approved → success, Declined/rejected/failed → error, anything else → warning. */
function diditTone(status: string): ChipTone {
  const s = status.toLowerCase()
  if (s.includes('approved')) return 'success'
  if (s.includes('declined') || s.includes('rejected') || s.includes('failed')) return 'error'
  return 'warning'
}

function DiditSessionBody({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<Extract<
    DiditSessionDetailsResult,
    { success: true }
  > | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDiditSessionDetails(sessionId)
      .then((res) => {
        if (cancelled) return
        if (res.success) setDetails(res)
        else setError(res.error)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the session details.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId)
      toast.success('Session ID copied')
    } catch {
      toast.error('Could not copy the session ID')
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <CircleNotch aria-hidden weight="bold" className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : error ? (
        <p role="alert" className="rounded-md bg-error-bg px-3.5 py-3 text-[13px] leading-relaxed text-error">
          {error}
        </p>
      ) : details ? (
        <>
          <div className="flex flex-col items-center gap-1.5 py-1">
            <StatusBadge status={details.status} tone={diditTone(details.status)} className="px-3 py-1 text-[13px]" />
            {details.sessionNumber != null && (
              <span className="text-[12px] text-text-tertiary">Session #{details.sessionNumber}</span>
            )}
          </div>

          <button
            type="button"
            onClick={copySessionId}
            aria-label="Copy session ID"
            className="flex w-full items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5 text-left transition-colors hover:bg-bg-overlay-2"
          >
            <code className="min-w-0 truncate font-mono text-[12px] text-text-secondary">{sessionId}</code>
            <Copy aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>

          {details.features.length > 0 && (
            <div>
              <p className={FIELD_LABEL}>Verification Checks</p>
              <div className="divide-y divide-white/[0.06] rounded-md bg-bg-overlay px-3.5">
                {details.features.map((feature, i) => (
                  <div key={`${feature.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-text-primary">{feature.name}</span>
                    <StatusBadge status={feature.status} tone={diditTone(feature.status)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <div className="flex justify-end">
        <a
          href="https://business.didit.me"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
        >
          Open Didit Console
          <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail({ application }: ApplicationDetailProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [outreachText, setOutreachText] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionCategory, setRejectionCategory] = useState('other')
  const [changesMessage, setChangesMessage] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [showDiditModal, setShowDiditModal] = useState(false)

  // Real uploads only — the synthetic 'didit:<id>' evidence row is not a
  // storage object, so it never goes through the signed-URL action.
  const uploadedDocs = useMemo(
    () => (application.documents || []).filter((d) => !isDiditEvidence(d)),
    [application.documents]
  )

  useEffect(() => {
    const fetchDocumentUrls = async () => {
      if (uploadedDocs.length > 0) {
        const { urls } = await getDocumentsSignedUrls(uploadedDocs.map((d) => d.file_path))
        setDocumentUrls(urls)
      }
      setLoadingUrls(false)
    }
    fetchDocumentUrls()
  }, [uploadedDocs])

  // ── Derived review data ──
  const verification = useMemo(
    () => calculateVerificationStatus(application.documents, application),
    [application]
  )
  const diditDoc = findDiditEvidence(application.documents)
  const diditSessionId = application.didit_session_id ?? null
  const shopName = application.shop_name || application.display_name
  const submittedAt = application.submitted_at || application.created_at
  const statusLabel = applicationStatusLabel(application.status)
  const isActionable = ['pending', 'under_review', 'info_requested'].includes(
    application.status
  )

  // Games rows: games_categories through the real-games lookup; legacy rows
  // fall back to primary_games (+ resolved names).
  const gameRows = useMemo(() => {
    const lookup = application.games_lookup || {}
    if (application.games_categories && application.games_categories.length > 0) {
      return application.games_categories.map((gc) => {
        const game = lookup[gc.gameId] ?? lookup[gc.gameSlug]
        return {
          key: gc.gameId || gc.gameSlug,
          name: game?.name ?? titleFromSlug(gc.gameSlug),
          image: game?.image_url ?? null,
          cats: gc.categorySlugs,
        }
      })
    }
    return (application.primary_games || []).map((ref, index) => {
      const game = lookup[String(ref)]
      return {
        key: String(ref),
        name: game?.name ?? application.game_names?.[index] ?? String(ref),
        image: game?.image_url ?? null,
        cats: [] as string[],
      }
    })
  }, [application])

  const timeline = useMemo(() => {
    const items: { title: string; when: string; open?: boolean }[] = []
    if (diditDoc?.uploaded_at) {
      items.push({
        title: 'Didit Verification Approved',
        when: fmtDateTime(diditDoc.uploaded_at),
      })
    }
    items.push({ title: 'Application Submitted', when: fmtDateTime(submittedAt) })
    items.push({ title: 'Confirmation Email Sent', when: fmtDateTime(submittedAt) })
    if (application.status === 'approved') {
      items.push({ title: 'Application Approved', when: fmtDateTime(application.reviewed_at) })
    } else if (application.status === 'rejected') {
      items.push({ title: 'Application Rejected', when: fmtDateTime(application.reviewed_at) })
    } else if (application.status === 'info_requested') {
      items.push({ title: 'Changes Requested', when: fmtDateTime(application.updated_at) })
      items.push({ title: 'Awaiting Applicant Response', when: 'Now', open: true })
    } else {
      items.push({ title: 'Awaiting Review', when: 'Now', open: true })
    }
    return items
  }, [application, diditDoc, submittedAt])

  const consents = [
    { label: 'Terms', ok: !!application.accepted_seller_agreement },
    { label: 'Privacy', ok: !!application.accepted_privacy_policy },
    { label: 'Fee Schedule', ok: !!application.accepted_commission_structure },
    { label: 'Anti-Fraud', ok: !!application.accepted_anti_fraud_policy },
    { label: 'Data Processing', ok: !!application.accepted_data_processing },
    { label: 'Accuracy', ok: !!application.information_accurate_confirmed },
  ]

  const volumeLabel = application.expected_monthly_volume
    ? `${VOLUME_LABELS[application.expected_monthly_volume] ?? application.expected_monthly_volume}/mo`
    : '—'

  const sellerTypeLabel =
    SELLER_TYPE_LABELS[application.seller_type ?? ''] ?? application.seller_type ?? 'Seller'

  // ── Actions (wiring unchanged) ──
  // `asFounding` grants founding-seller status (2% fee discount + badge) on
  // approval. Even without it, approveApplication auto-grants founding to any
  // applicant already flagged is_founding_applicant (waitlist founder), so a
  // courted lead never loses the promised perk.
  // ACC-02 — the server computes the identity check before granting the role;
  // a gap comes back as requiresAcknowledgement and the modal shows it. The
  // admin can still approve (acknowledge = true) — informed, not blocked.
  const [kycGap, setKycGap] = useState<IdentityAssessment | null>(null)
  const [pendingFounding, setPendingFounding] = useState(false)
  const handleApprove = async (asFounding = false, acknowledgeKycGap = false) => {
    setIsProcessing(true)
    setPendingFounding(asFounding)
    const result = await approveApplication(application.id, adminNotes, asFounding, { acknowledgeKycGap })

    if (result.requiresAcknowledgement && result.kycGap) {
      setKycGap(result.kycGap)
      setIsProcessing(false)
      return
    }

    if (result.success) {
      setShowApproveModal(false)
      toast.success(
        (result as any).founding
          ? 'Approved as a founding seller'
          : 'Application approved successfully',
      )
      setTimeout(() => {
        router.push('/admin/sellers?status=approved')
        router.refresh()
      }, 500)
    } else {
      toast.error(result.error || 'Failed to approve application')
      setIsProcessing(false)
      setShowApproveModal(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    if (!rejectionCategory.trim()) {
      toast.error('Please select a rejection category')
      return
    }

    setIsProcessing(true)
    const result = await rejectApplication(
      application.id,
      rejectionReason,
      rejectionCategory,
      adminNotes
    )

    if (result.success) {
      setShowRejectModal(false)
      toast.success('Application rejected successfully')
      setTimeout(() => {
        router.push('/admin/sellers?status=rejected')
        router.refresh()
      }, 500)
    } else {
      toast.error(result.error || 'Failed to reject application')
      setIsProcessing(false)
      setShowRejectModal(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!changesMessage.trim()) {
      toast.error('Please describe the changes you need')
      return
    }

    setIsProcessing(true)
    const result = await requestMoreInfo(application.id, changesMessage)

    if (result.success) {
      setShowChangesModal(false)
      toast.success('Change request sent to the applicant')
      setTimeout(() => {
        router.refresh()
        setIsProcessing(false)
      }, 500)
    } else {
      toast.error(result.error || 'Failed to request changes')
      setIsProcessing(false)
    }
  }

  // ── Doc tile presentation ──
  const docCaption = (doc: KYCDocument): { title: string; sub: string } => {
    const title =
      DOCUMENT_TYPE_LABELS[doc.document_type] ?? titleFromSlug(doc.document_type)
    if (
      diditSessionId &&
      ['id_front', 'id_back', 'selfie_with_id'].includes(doc.document_type)
    ) {
      return { title, sub: 'covered by Didit · optional' }
    }
    return { title, sub: `uploaded ${fmtDate(doc.uploaded_at)}` }
  }

  const handleSendMessage = async () => {
    setIsSendingMessage(true)
    const result = await messageApplicant(application.id, outreachText)
    setIsSendingMessage(false)
    if (result.success) {
      toast.success('Message sent to the seller')
      setShowMessageModal(false)
      setOutreachText('')
    } else {
      toast.error(result.error || 'Could not send the message')
    }
  }

  const identityOk = !!verification.checks.find((c) => c.key === 'identity')?.ok
  // Show the identity warning when the server returned a gap, or when the
  // client-side check already knows identity isn't verified.
  const approveGap = kycGap !== null || !identityOk

  return (
    <div className="space-y-5">
      {/* ══ Header — store identity + actions ══ */}
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
            <IconAction label="Message Seller" icon={ChatCircleText} onClick={() => setShowMessageModal(true)} />
            {isActionable && (
              <>
                <button type="button" onClick={() => setShowRejectModal(true)} disabled={isProcessing} className={adminBtn.danger}>
                  Reject
                </button>
                <button type="button" onClick={() => setShowChangesModal(true)} disabled={isProcessing} className={adminBtn.secondary}>
                  Request Changes
                </button>
                <button type="button" onClick={() => setShowApproveModal(true)} disabled={isProcessing} className={adminBtn.primary}>
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
              <button type="button" onClick={() => setShowApproveModal(true)} disabled={isProcessing} className={adminBtn.primary}>
                <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
                Approve Seller
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ Verification ══ */}
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

      {/* ══ Body ══ */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card icon={GameController} title="Games & Categories" sub="What they applied to sell, per game, from the live category map.">
            {gameRows.length === 0 && !application.other_games ? (
              <p className="text-[13px] text-text-tertiary">No games selected.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {gameRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <GameTile src={row.image} name={row.name} className="h-10 w-10 text-[14px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-text-primary">{row.name}</p>
                      {row.cats.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.cats.map((cat) => (
                            <span key={cat} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                              {titleFromSlug(cat)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {row.cats.length > 0 && (
                      <span className="shrink-0 text-[12px] text-text-tertiary">
                        {row.cats.length} {row.cats.length === 1 ? 'Category' : 'Categories'}
                      </span>
                    )}
                  </div>
                ))}
                {application.other_games && (
                  <div className="flex items-center gap-3 py-3 last:pb-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-bg text-[15px] font-bold text-warning">+</span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary">Other Games</p>
                      <p className="mt-0.5 text-[12.5px] italic text-text-tertiary">“{application.other_games}”</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card icon={IdentificationCard} title="Identity & Documents" sub="Didit decision and uploaded evidence (signed links, click to open).">
            {diditSessionId && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-success-bg px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-success">Didit Video Verification — Approved</p>
                  <p className="mt-0.5 text-[12.5px] text-text-secondary">
                    Govt ID + liveness + face match passed · Session{' '}
                    <span className="font-mono">{diditSessionId.slice(0, 8)}…</span>
                    {diditDoc?.uploaded_at && <> · {fmtDateTime(diditDoc.uploaded_at)}</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiditModal(true)}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-primary underline-offset-4 hover:underline"
                >
                  View Session
                  <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {uploadedDocs.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {uploadedDocs.map((doc) => {
                  const url = documentUrls[doc.file_path]
                  const caption = docCaption(doc)
                  const thumb = loadingUrls ? (
                    <div className="skeleton h-[84px]" />
                  ) : url && isImageFile(doc.file_name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={caption.title} className="h-[84px] w-full object-cover" />
                  ) : (
                    <div className="grid h-[84px] place-items-center bg-white/[0.04] text-[12px] font-semibold text-text-tertiary">
                      {url ? (/\.pdf$/i.test(doc.file_name || '') ? 'PDF' : 'File') : 'Unavailable'}
                    </div>
                  )
                  const body = (
                    <>
                      <div className="overflow-hidden">{thumb}</div>
                      <div className="px-3 py-2">
                        <p className="truncate text-[12.5px] font-semibold text-text-primary">{caption.title}</p>
                        <p className="truncate text-[11.5px] text-text-tertiary">{caption.sub}</p>
                      </div>
                    </>
                  )
                  return url ? (
                    <a
                      key={doc.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-md bg-bg-overlay transition-colors hover:bg-bg-overlay-2"
                    >
                      {body}
                    </a>
                  ) : (
                    <div key={doc.id} className="overflow-hidden rounded-md bg-bg-overlay">
                      {body}
                    </div>
                  )
                })}
              </div>
            ) : (
              !diditSessionId && <p className="text-[13px] text-text-tertiary">No documents uploaded yet.</p>
            )}
          </Card>

          {/* NOTE: Payout and the detailed Business-entity fields were removed
              from the seller APPLICATION (now a 3-step flow: Account & Games →
              Identity → Review & Sign). Payout is set up later in Wallet; profile
              details live in Settings. Business sellers still upload their
              business documents, which appear in Identity & Documents above. */}

          <Card icon={Signature} title="Experience & Agreement" sub="Track record and the signed Seller Agency Agreement.">
            {application.selling_experience ? (
              <blockquote className="rounded-md bg-bg-overlay px-4 py-3 text-[13.5px] italic leading-relaxed text-text-secondary">
                “{application.selling_experience}”
              </blockquote>
            ) : (
              <p className="text-[13px] text-text-tertiary">No selling experience provided.</p>
            )}

            {application.seller_signature && (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md bg-bg-overlay px-4 py-3">
                {application.seller_signature_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={application.seller_signature_image}
                    alt="Drawn signature"
                    className="h-14 max-w-[180px] shrink-0 rounded-md bg-white object-contain px-2 py-1"
                  />
                )}
                <div className="min-w-0">
                  <p
                    className="text-[22px] leading-tight text-text-primary"
                    style={{ fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" }}
                  >
                    {application.seller_signature}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-tertiary">
                    Signed {fmtDateTime(application.seller_signed_at)} · Seller Agency Agreement
                  </p>
                </div>
              </div>
            )}

            <a href={`/api/admin/seller-agreement/${application.id}`} className={cn(adminBtn.secondary, 'mt-3')}>
              <FileArrowDown aria-hidden weight="bold" className="h-4 w-4" />
              Download Signed Agreement (PDF)
            </a>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {consents.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                    c.ok ? 'bg-success-bg text-success' : 'bg-white/[0.05] text-text-disabled',
                  )}
                >
                  {c.ok && <CheckCircle aria-hidden weight="fill" className="h-3.5 w-3.5" />}
                  {c.label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* Rail */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card icon={User} title="Applicant" sub="The account behind the store.">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(application.user.avatar_url, application.user.username || application.user.email)}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-text-primary">
                  {application.user.username || application.user.full_name || 'Unknown User'}
                </p>
                <p className="truncate text-[12.5px] text-text-tertiary">{application.user.email}</p>
                {application.user.created_at && (
                  <p className="text-[12.5px] text-text-tertiary">
                    Member since{' '}
                    {new Date(application.user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            {/* Phone / city are no longer part of the slimmed application
                (KYC captures identity; profile details live in Settings). */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
              <KV k="Legal Name" v={application.full_legal_name || '—'} />
              <KV k="Country" v={application.country || '—'} />
              <KV k="Languages" v={application.languages_spoken?.length ? application.languages_spoken.join(', ') : '—'} />
            </div>
          </Card>

          <Card icon={ClockCounterClockwise} title="Timeline">
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/[0.08]">
              {timeline.map((item, i) => (
                <li key={`${item.title}-${i}`} className="relative pl-6">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-bg-raised',
                      item.open ? 'bg-warning' : 'bg-white/[0.3]',
                    )}
                  />
                  <p className="text-[13.5px] font-medium text-text-primary">{item.title}</p>
                  <p className="text-[12.5px] text-text-tertiary">{item.when}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card icon={NotePencil} title="Admin Notes" sub="Internal, attached to the decision when you approve or reject.">
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              aria-label="Admin notes"
              placeholder="e.g. Selfie is blurry — ask for a re-upload…"
              rows={3}
              className={cn(accountInputCls, 'resize-none')}
            />
          </Card>

          {application.status === 'approved' && (
            <Card icon={ShieldCheck} title="Seller Management" sub="Tier, wallet, payouts and restrictions live in the seller hub.">
              <Link href={`/admin/active-sellers/${application.user_id}`} className={cn(adminBtn.primary, 'w-full')}>
                Open Seller Management
                <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />
              </Link>
            </Card>
          )}
        </div>
      </div>

      {/* ══ Dialogs ══ */}

      <ActionDialog
        open={showApproveModal}
        busy={isProcessing}
        onClose={() => {
          setShowApproveModal(false)
          setKycGap(null)
        }}
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
            onClick={() => {
              setShowApproveModal(false)
              setKycGap(null)
            }}
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
        onClose={() => setShowRejectModal(false)}
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
          <button type="button" onClick={() => setShowRejectModal(false)} disabled={isProcessing} className={cn(adminBtn.secondary, 'sm:flex-1')}>
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
        onClose={() => setShowMessageModal(false)}
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
          <button type="button" onClick={() => setShowMessageModal(false)} disabled={isSendingMessage} className={cn(adminBtn.secondary, 'sm:flex-1')}>
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
        onClose={() => setShowChangesModal(false)}
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
          <button type="button" onClick={() => setShowChangesModal(false)} disabled={isProcessing} className={cn(adminBtn.secondary, 'sm:flex-1')}>
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
        onClose={() => setShowDiditModal(false)}
        title="Didit Verification Session"
      >
        {diditSessionId && <DiditSessionBody sessionId={diditSessionId} />}
      </ActionDialog>
    </div>
  )
}
