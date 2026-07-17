'use client'

/**
 * Forest Ledger — /admin/sellers/[id] application detail (approved mockup ①).
 *
 * Photo-scrim forest hero led by the store identity (image tile + shop
 * name + status/Didit chips + quick actions), a white verification meter
 * card bridging into the ledger body (only APPLICABLE checks count), then
 * ivory ledger cards on the forest canvas: Games & Categories with real
 * logos, Identity & Documents with the Didit banner + doc previews,
 * Payout, the Business branch, Experience & the signed Agreement, and the
 * Applicant / Timeline / Admin Notes right rail.
 *
 * Action wiring is UNCHANGED: approve stays admin-seller-review's
 * approveApplication (profile promotion first), reject stays
 * admin-sellers' rejectApplication (tiered cooldown RPC), request changes
 * is admin-seller-review's requestMoreInfo. Restrict/ban management for
 * approved sellers is preserved. Motion: CSS-only staggered fade-up.
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
import { approveApplication, requestMoreInfo } from '@/lib/actions/admin-seller-review'
import { getDocumentsSignedUrls } from '@/lib/actions/kyc-documents'
import {
  calculateVerificationStatus,
  findDiditEvidence,
  isDiditEvidence,
  diditSessionUrl,
} from '@/lib/utils/seller-verification'
import { restrictSeller, unrestrictSeller } from '@/lib/actions/admin-seller-restrictions'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  VOLUME_LABELS,
  PAYOUT_METHOD_LABELS,
  SELLER_TYPE_LABELS,
  BUSINESS_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  CRYPTO_TYPE_LABELS,
} from '@/lib/seller-application/labels'
import { PAYOUT_FEES } from '@/lib/fees'
import {
  FOREST_BG,
  FOREST_CLASSES,
  FOREST_DIDIT_CHIP,
  FOREST_MOTION,
  forestStagger,
  forestStatusChip,
  gameTileGradient,
} from '../../_theme/forest'
import { toast } from 'sonner'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Ban,
  ShieldAlert,
  ShieldCheck,
  History,
  MessageSquareWarning,
  X,
} from 'lucide-react'

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

/** "us64svbk00004821" → "US64 SV ••• 4821" style masked account/IBAN. */
function maskAccount(value: string): string {
  const clean = value.replace(/\s+/g, '')
  if (clean.length <= 8) return value
  return `${clean.slice(0, 6)} ••• ${clean.slice(-4)}`
}

/** Long crypto wallets → head…tail. */
function maskWallet(value: string): string {
  const clean = value.trim()
  if (clean.length <= 16) return clean
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`
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

// ─── Small ledger primitives ─────────────────────────────────────────────────

function Card({
  icon,
  title,
  sub,
  index,
  children,
  className,
}: {
  icon: string
  title: string
  sub?: string
  index: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(FOREST_CLASSES.card, FOREST_MOTION.fadeUp, className)}
      style={forestStagger(index)}
    >
      <h3 className={FOREST_CLASSES.cardTitle}>
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-[#14432A]/[0.09] text-[11px]">
          {icon}
        </span>
        {title}
      </h3>
      {sub && <p className={cn(FOREST_CLASSES.cardSub, 'mb-3.5 mt-0.5')}>{sub}</p>}
      {children}
    </section>
  )
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className={FOREST_CLASSES.kvKey}>{k}</div>
      <div className={cn(FOREST_CLASSES.kvValue, mono && FOREST_CLASSES.mono)}>
        {v || '—'}
      </div>
    </div>
  )
}

function GameLogo({
  name,
  imageUrl,
  size = 40,
}: {
  name: string
  imageUrl: string | null
  size?: number
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-[10px] object-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
      style={{ width: size, height: size, background: gameTileGradient(name) }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/** CSS-only modal shell on the forest canvas — white paper panel. */
function ModalShell({
  onClose,
  children,
  wide,
}: {
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className={cn('absolute inset-0 bg-[#08110C]/70', FOREST_MOTION.fadeIn)}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full rounded-2xl bg-white p-6 text-[#1A1D19] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]',
          wide ? 'max-w-lg' : 'max-w-md',
          'max-h-[90vh] overflow-y-auto',
          FOREST_MOTION.fadeUp
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const MODAL_LABEL =
  'mb-2 block text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8A9083]'
const MODAL_INPUT =
  'w-full rounded-[10px] border border-[#E4E5DE] bg-[#FAFAF7] px-3 py-2.5 text-[13px] text-[#1A1D19] placeholder:text-[#8A9083] focus:border-[#65A30D] focus:outline-none'
const MODAL_CANCEL =
  'flex-1 rounded-[10px] border border-[#E4E5DE] px-3 py-2.5 text-[13px] font-semibold text-[#5B6157] transition-colors hover:bg-[#FAFAF7] disabled:opacity-50'
const MODAL_CONFIRM_LIME =
  'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#A3E635] px-3 py-2.5 text-[13px] font-bold text-[#0F3320] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
const MODAL_CONFIRM_RED =
  'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#B42318] px-3 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

// ─── The page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail({ application }: ApplicationDetailProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [showRestrictModal, setShowRestrictModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionCategory, setRejectionCategory] = useState('other')
  const [changesMessage, setChangesMessage] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [restrictionReason, setRestrictionReason] = useState('')
  const [restrictionType, setRestrictionType] = useState<'restricted' | 'banned'>('restricted')
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [restrictionHistory, setRestrictionHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

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
  const statusChip = forestStatusChip(application.status)
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

  const payoutIsCrypto =
    application.payout_method === 'crypto' || application.payout_method === 'cryptocurrency'
  const payoutMethodLine = (() => {
    if (!application.payout_method) return 'Not Specified'
    const base =
      PAYOUT_METHOD_LABELS[application.payout_method] ??
      titleFromSlug(application.payout_method)
    const { pct, fixed } = PAYOUT_FEES[payoutIsCrypto ? 'crypto' : 'fiat']
    return `${base} · ${pct}% + $${fixed}`
  })()

  const volumeLabel = application.expected_monthly_volume
    ? `${VOLUME_LABELS[application.expected_monthly_volume] ?? application.expected_monthly_volume}/mo`
    : '—'

  const sellerTypeLabel =
    SELLER_TYPE_LABELS[application.seller_type ?? ''] ?? application.seller_type ?? 'Seller'

  const location = [application.city, application.state_province, application.country]
    .filter(Boolean)
    .join(', ')

  // ── Actions (wiring unchanged) ──
  const handleApprove = async () => {
    setIsProcessing(true)
    const result = await approveApplication(application.id, adminNotes)

    if (result.success) {
      setShowApproveModal(false)
      toast.success('Application approved successfully')
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

  const handleRestrictSeller = async () => {
    if (!restrictionReason.trim()) {
      toast.error('Please provide a reason for restriction')
      return
    }

    setIsProcessing(true)
    const result = await restrictSeller({
      userId: application.user_id,
      status: restrictionType,
      reason: restrictionReason,
    })

    if (result.success) {
      setShowRestrictModal(false)
      setRestrictionReason('')
      toast.success(
        `Seller has been ${restrictionType === 'banned' ? 'banned' : 'restricted'} successfully`
      )
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to restrict seller')
    }
    setIsProcessing(false)
  }

  const handleUnrestrictSeller = async () => {
    setIsProcessing(true)
    const result = await unrestrictSeller(application.user_id)

    if (result.success) {
      toast.success('Seller restriction has been removed')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to remove restriction')
    }
    setIsProcessing(false)
  }

  const handleViewHistory = async () => {
    setLoadingHistory(true)
    setShowHistoryModal(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase
        .from('seller_restrictions')
        .select('*, admin:restricted_by(username, email)')
        .eq('seller_id', application.user_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRestrictionHistory(data || [])
    } catch (error) {
      console.error('Error fetching restriction history:', error)
      toast.error('Failed to load restriction history')
    } finally {
      setLoadingHistory(false)
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

  let cardIndex = 0

  return (
    <>
      {/* ══ HERO — forest scrim band, store identity leads ══ */}
      <section
        className={cn('relative overflow-hidden rounded-2xl px-6 pb-16 pt-6 sm:px-7', FOREST_MOTION.fadeIn)}
        style={{ background: FOREST_BG.hero }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: FOREST_BG.heroNoise }}
        />

        <div className="relative z-[1] mb-4 text-[12px] text-white/40">
          <Link href="/admin/sellers" className="transition-colors hover:text-white/70">
            Sellers
          </Link>
          {' / '}
          <Link href="/admin/sellers" className="transition-colors hover:text-white/70">
            Applications
          </Link>
          {' / '}
          <b className="font-medium text-white/60">{shopName}</b>
        </div>

        <div className="relative z-[1] flex flex-wrap items-start gap-[18px]">
          {/* Store image tile */}
          {application.store_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={application.store_image_url}
              alt={shopName || 'Store'}
              className="h-[76px] w-[76px] shrink-0 rounded-2xl object-cover shadow-[0_0_0_3px_rgba(255,255,255,0.14),0_14px_30px_-14px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <div
              className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl text-[28px] font-black text-[#A3E635] shadow-[0_0_0_3px_rgba(255,255,255,0.14),0_14px_30px_-14px_rgba(0,0,0,0.7)]"
              style={{ background: FOREST_BG.storeTile }}
            >
              {(shopName || '?').charAt(0).toUpperCase()}
            </div>
          )}

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[11px]">
              <h1 className="text-[26px] font-extrabold tracking-[-0.01em] text-white">
                {shopName}
              </h1>
              <span className={statusChip.onDark}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusChip.label}
              </span>
              {diditSessionId && (
                <span className={FOREST_DIDIT_CHIP}>✓ Didit Video Verified</span>
              )}
            </div>
            <div className="mt-1.5 text-[13px] text-white/60">
              by <b className="font-semibold text-white/[0.92]">{application.display_name}</b>
              {application.user.username && <> · {application.user.username}</>}
              {' · '}
              {application.user.email}
              {' · '}
              {sellerTypeLabel} Seller
            </div>
            <div className="mt-2.5 flex flex-wrap gap-4 text-[12px] text-white/40">
              <span>
                Applied <b className="font-semibold text-white/60">{fmtDateTime(submittedAt)}</b>
              </span>
              <span>
                Country <b className="font-semibold text-white/60">{application.country || '—'}</b>
              </span>
              <span>
                Expected Volume <b className="font-semibold text-white/60">{volumeLabel}</b>
              </span>
              <span>
                Ref{' '}
                <b className={cn('font-semibold text-white/60', FOREST_CLASSES.mono)}>
                  {application.id.split('-')[0]}
                </b>
              </span>
            </div>
          </div>

          {/* Contextual actions */}
          <div className="flex flex-wrap items-center gap-[9px] lg:ml-auto">
            {isActionable && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className={cn(FOREST_CLASSES.btnReject, 'disabled:opacity-50')}
                >
                  Reject
                </button>
                <button
                  onClick={() => setShowChangesModal(true)}
                  disabled={isProcessing}
                  className={cn(FOREST_CLASSES.btnChanges, 'disabled:opacity-50')}
                >
                  Request Changes
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={isProcessing}
                  className={cn(FOREST_CLASSES.btnApprove, 'disabled:opacity-50')}
                >
                  ✓ Approve Seller
                </button>
              </>
            )}
            {application.status === 'approved' && (
              <div className="flex items-center gap-2 rounded-[10px] bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white/85">
                <ShieldCheck className="h-4 w-4 text-[#A3E635]" />
                Approved On {fmtDate(application.reviewed_at)}
              </div>
            )}
            {application.status === 'rejected' && (
              <button
                onClick={() => setShowApproveModal(true)}
                disabled={isProcessing}
                className={cn(FOREST_CLASSES.btnApprove, 'disabled:opacity-50')}
              >
                ✓ Approve Seller
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ══ VERIFICATION METER — white card bridging out of the hero ══ */}
      <div
        className={cn(
          'relative z-[2] mx-3 -mt-10 flex flex-wrap items-center gap-x-[22px] gap-y-3 rounded-[14px] bg-white px-5 py-4 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.55)] sm:mx-6',
          FOREST_MOTION.fadeUp
        )}
        style={forestStagger(cardIndex++)}
      >
        <div
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#65A30D 0 ${verification.percentage}%, #E7E8E1 ${verification.percentage}% 100%)`,
          }}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[12px] font-extrabold text-[#14432A]">
            {verification.verified}/{verification.total}
          </span>
        </div>
        <div>
          <div className="text-[13px] font-bold text-[#1A1D19]">
            Verification {verification.verified} of {verification.total} applicable checks
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#5B6157]">
            {application.seller_type === 'business'
              ? 'Business seller — identity, address and business checks all apply.'
              : 'Individual seller — the business check doesn’t apply and is not counted.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {verification.checks.map((check) => {
            if (!check.applicable) {
              return (
                <span key={check.key} className={FOREST_CLASSES.checkNa}>
                  — {check.label} (N/A)
                </span>
              )
            }
            if (check.ok) {
              return (
                <span key={check.key} className={FOREST_CLASSES.checkOk}>
                  <span className="font-black text-[#65A30D]">✓</span>
                  {check.label}
                  {check.viaDidit && ' · Didit Video'}
                </span>
              )
            }
            return (
              <span key={check.key} className={FOREST_CLASSES.checkOpen}>
                ○ {check.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Status banners (rejected / changes requested) */}
      {application.status === 'rejected' && application.rejection_reason && (
        <div
          className={cn(
            'mt-5 rounded-[14px] bg-[#FEF2F1] px-5 py-4',
            FOREST_MOTION.fadeUp
          )}
          style={forestStagger(cardIndex++)}
        >
          <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.07em] text-[#B42318]">
            <XCircle className="h-4 w-4" /> Rejection Reason
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#5B6157]">
            {application.rejection_reason}
          </p>
        </div>
      )}
      {application.status === 'info_requested' && application.admin_notes && (
        <div
          className={cn(
            'mt-5 rounded-[14px] bg-[#FEF3C7] px-5 py-4',
            FOREST_MOTION.fadeUp
          )}
          style={forestStagger(cardIndex++)}
        >
          <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.07em] text-[#92400E]">
            <MessageSquareWarning className="h-4 w-4" /> Changes Requested From The Applicant
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#5B6157]">
            {application.admin_notes}
          </p>
        </div>
      )}

      {/* ══ BODY — ledger cards on the forest canvas ══ */}
      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_322px]">
        {/* ── LEFT column ── */}
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* Games & Categories */}
          <Card
            icon="🎮"
            title="Games & Categories"
            sub="What they applied to sell — per game, from the live category map"
            index={cardIndex++}
          >
            {gameRows.length === 0 && !application.other_games ? (
              <p className="py-3 text-[12.5px] text-[#8A9083]">No games selected.</p>
            ) : (
              <div>
                {gameRows.map((row, i) => (
                  <div
                    key={row.key}
                    className={cn(
                      'flex items-center gap-3 py-[11px]',
                      i > 0 && 'border-t border-[#F0F1EA]'
                    )}
                  >
                    <GameLogo name={row.name} imageUrl={row.image} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-[#1A1D19]">{row.name}</div>
                      {row.cats.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {row.cats.map((cat) => (
                            <span key={cat} className={FOREST_CLASSES.gameCat}>
                              {titleFromSlug(cat)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {row.cats.length > 0 && (
                      <div className="ml-auto text-right text-[11px] text-[#8A9083]">
                        {row.cats.length} {row.cats.length === 1 ? 'Category' : 'Categories'}
                      </div>
                    )}
                  </div>
                ))}

                {application.other_games && (
                  <div
                    className={cn(
                      'flex items-center gap-3 py-[11px]',
                      gameRows.length > 0 && 'border-t border-[#F0F1EA]'
                    )}
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-white"
                      style={{ background: 'linear-gradient(140deg, #F59E0B, #B45309)' }}
                    >
                      +
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-[#1A1D19]">Other Games</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={FOREST_CLASSES.gameCatOther}>
                          “{application.other_games}”
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Identity & Documents */}
          <Card
            icon="🪪"
            title="Identity & Documents"
            sub="Didit decision + uploaded evidence (signed URLs, click to open)"
            index={cardIndex++}
          >
            {diditSessionId && (
              <div className="mb-3.5 flex flex-wrap items-start gap-3 rounded-[11px] bg-[#A3E635]/[0.16] px-3.5 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-[#14432A]">
                    Didit Video Verification — Approved
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#5B6157]">
                    Govt ID + liveness + face match passed · Session{' '}
                    <span className={FOREST_CLASSES.mono}>{diditSessionId.slice(0, 8)}…</span>
                    {diditDoc?.uploaded_at && <> · {fmtDateTime(diditDoc.uploaded_at)}</>}
                  </div>
                </div>
                <a
                  href={diditSessionUrl(diditSessionId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#65A30D] transition hover:brightness-90"
                >
                  View Session ↗
                </a>
              </div>
            )}

            {uploadedDocs.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {uploadedDocs.map((doc) => {
                  const url = documentUrls[doc.file_path]
                  const caption = docCaption(doc)
                  const thumb = loadingUrls ? (
                    <div
                      className="grid h-[74px] animate-pulse place-items-center text-[11px] font-semibold text-[#8A9083]"
                      style={{ background: FOREST_BG.docThumb }}
                    />
                  ) : url && isImageFile(doc.file_name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={caption.title}
                      className="h-[74px] w-full object-cover"
                    />
                  ) : (
                    <div
                      className="grid h-[74px] place-items-center text-[11px] font-semibold text-[#8A9083]"
                      style={{ background: FOREST_BG.docThumb }}
                    >
                      {url
                        ? /\.pdf$/i.test(doc.file_name || '')
                          ? 'PDF'
                          : 'File'
                        : 'Unavailable'}
                    </div>
                  )

                  const body = (
                    <>
                      <div className="overflow-hidden">{thumb}</div>
                      <div className="px-2.5 py-2 text-[11px] font-bold text-[#1A1D19]">
                        {caption.title}
                        <span className="mt-[1px] block text-[10px] font-medium text-[#8A9083]">
                          {caption.sub}
                        </span>
                      </div>
                    </>
                  )

                  return url ? (
                    <a
                      key={doc.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-[11px] border border-[#E4E5DE] transition hover:border-[#65A30D]/50 hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.35)]"
                    >
                      {body}
                    </a>
                  ) : (
                    <div
                      key={doc.id}
                      className="overflow-hidden rounded-[11px] border border-[#E4E5DE]"
                    >
                      {body}
                    </div>
                  )
                })}
              </div>
            ) : (
              !diditSessionId && (
                <p className="py-3 text-[12.5px] text-[#8A9083]">No documents uploaded yet.</p>
              )
            )}
          </Card>

          {/* Payout */}
          <Card
            icon="🏦"
            title="Payout"
            sub="Where their earnings go once orders complete"
            index={cardIndex++}
          >
            <div className="grid grid-cols-1 gap-x-[18px] gap-y-2.5 sm:grid-cols-2">
              <KV k="Method" v={payoutMethodLine} />
              <KV k="Preferred Currency" v={application.payout_currency || '—'} />
              {payoutIsCrypto ? (
                <>
                  <KV
                    k="Coin"
                    v={
                      application.crypto_type
                        ? CRYPTO_TYPE_LABELS[application.crypto_type] ?? application.crypto_type
                        : '—'
                    }
                  />
                  <KV
                    k="Wallet"
                    mono
                    v={
                      application.crypto_wallet_address
                        ? maskWallet(application.crypto_wallet_address)
                        : '—'
                    }
                  />
                </>
              ) : (
                <>
                  <KV k="Account Holder" v={application.bank_account_holder_name || '—'} />
                  <KV k="Bank" v={application.bank_name || '—'} />
                  <KV
                    k="IBAN / Account"
                    mono
                    v={application.bank_iban ? maskAccount(application.bank_iban) : '—'}
                  />
                </>
              )}
              <KV k="Tax Residency" v={application.tax_residency_country || '—'} />
            </div>
          </Card>

          {/* Business branch */}
          {application.seller_type === 'business' && (
            <Card
              icon="🏢"
              title="Business"
              sub="Registered company behind the application"
              index={cardIndex++}
            >
              <div className="grid grid-cols-1 gap-x-[18px] gap-y-2.5 sm:grid-cols-2">
                <KV k="Company Legal Name" v={application.company_legal_name || '—'} />
                <KV
                  k="Registration Number"
                  mono
                  v={application.business_registration_number || '—'}
                />
                <KV k="Tax ID / VAT" mono v={application.tax_id_vat || '—'} />
                <KV
                  k="Business Type"
                  v={
                    application.business_type
                      ? BUSINESS_TYPE_LABELS[application.business_type] ??
                        titleFromSlug(application.business_type)
                      : '—'
                  }
                />
                <KV k="Year Established" v={application.year_established?.toString() || '—'} />
                <KV k="Business Email" v={application.business_email || '—'} />
                <KV k="Business Phone" mono v={application.business_phone || '—'} />
                <KV k="Company Address" v={application.company_address || '—'} />
              </div>
            </Card>
          )}

          {/* Experience & Agreement */}
          <Card
            icon="✍️"
            title="Experience & Agreement"
            sub="Track record + the signed Seller Agency Agreement"
            index={cardIndex++}
          >
            {application.selling_experience ? (
              <blockquote className="rounded-r-[10px] border-l-[3px] border-[#A3E635] bg-[#FAFAF7] px-3.5 py-[11px] text-[12.5px] italic leading-relaxed text-[#5B6157]">
                “{application.selling_experience}”
              </blockquote>
            ) : (
              <p className="text-[12.5px] text-[#8A9083]">No selling experience provided.</p>
            )}

            {application.seller_signature && (
              <div className="mt-3 flex items-center gap-3.5 rounded-[11px] border border-dashed border-[#D6D9CB] bg-[#FAFAF7] px-4 py-3">
                <div>
                  <div
                    className="text-[22px] leading-tight text-[#14432A]"
                    style={{
                      fontFamily:
                        "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive",
                    }}
                  >
                    {application.seller_signature}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8A9083]">
                    Signed {fmtDateTime(application.seller_signed_at)} · Seller Agency Agreement
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-[7px]">
              {consents.map((c) => (
                <span
                  key={c.label}
                  className={
                    c.ok
                      ? FOREST_CLASSES.consent
                      : 'rounded-md border border-[#E4E5DE] px-2.5 py-[3px] text-[10.5px] font-bold text-[#8A9083] opacity-60'
                  }
                >
                  {c.ok ? '✓ ' : '○ '}
                  {c.label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* ── RIGHT rail ── */}
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* Applicant */}
          <Card icon="👤" title="Applicant" sub="Account behind the store" index={cardIndex++}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(
                  application.user.avatar_url,
                  application.user.username || application.user.email
                )}
                alt={application.user.username || 'Applicant'}
                className="h-11 w-11 shrink-0 rounded-full border border-[#E4E5DE] object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-extrabold text-[#1A1D19]">
                  {application.user.username || application.user.full_name || 'Unknown User'}
                </div>
                <div className="truncate text-[11.5px] text-[#5B6157]">
                  {application.user.email}
                </div>
                {application.user.created_at && (
                  <div className="text-[11.5px] text-[#5B6157]">
                    Member Since{' '}
                    {new Date(application.user.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-x-[18px] gap-y-2.5">
              <KV k="Legal Name" v={application.full_legal_name || '—'} />
              <KV k="Phone" mono v={application.phone_number || '—'} />
              <KV k="Location" v={location || '—'} />
              <KV
                k="Languages"
                v={
                  application.languages_spoken?.length
                    ? application.languages_spoken.join(', ')
                    : '—'
                }
              />
            </div>
          </Card>

          {/* Timeline */}
          <Card icon="🕘" title="Timeline" sub="Application activity" index={cardIndex++}>
            <ul>
              {timeline.map((item, i) => (
                <li
                  key={`${item.title}-${i}`}
                  className={cn(
                    'relative pl-[22px] text-[12px] text-[#5B6157]',
                    i < timeline.length - 1 && 'pb-4'
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-[5px] top-[4px] h-2 w-2 rounded-full',
                      item.open ? 'bg-[#F59E0B]' : 'bg-[#65A30D]'
                    )}
                  />
                  {i < timeline.length - 1 && (
                    <span className="absolute bottom-0 left-[8.5px] top-[14px] w-px bg-[#E4E5DE]" />
                  )}
                  <b className="block text-[12.5px] font-bold text-[#1A1D19]">{item.title}</b>
                  {item.when}
                </li>
              ))}
            </ul>
          </Card>

          {/* Admin Notes */}
          <Card
            icon="📝"
            title="Admin Notes"
            sub="Internal — attached to the decision when you approve or reject"
            index={cardIndex++}
          >
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Selfie is blurry — ask for a re-upload…"
              className="min-h-[64px] w-full resize-none rounded-[10px] border border-[#E4E5DE] bg-[#FAFAF7] px-[11px] py-[9px] font-[inherit] text-[12.5px] text-[#1A1D19] placeholder:text-[#8A9083] focus:border-[#65A30D] focus:outline-none"
            />
          </Card>

          {/* Seller Management (approved sellers) */}
          {application.status === 'approved' && (
            <Card
              icon="🛡️"
              title="Seller Management"
              sub="Restrict or ban this seller's account"
              index={cardIndex++}
            >
              {application.user.seller_status && application.user.seller_status !== 'active' && (
                <div
                  className={cn(
                    'mb-3 rounded-[11px] px-3.5 py-3',
                    application.user.seller_status === 'banned' ? 'bg-[#FEF2F1]' : 'bg-[#FEF3C7]'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 text-[12.5px] font-bold',
                      application.user.seller_status === 'banned'
                        ? 'text-[#B42318]'
                        : 'text-[#92400E]'
                    )}
                  >
                    {application.user.seller_status === 'banned' ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <ShieldAlert className="h-4 w-4" />
                    )}
                    Currently {application.user.seller_status === 'banned' ? 'Banned' : 'Restricted'}
                  </div>
                  {application.user.seller_restriction_reason && (
                    <p className="mt-1.5 text-[11.5px] text-[#5B6157]">
                      Reason: {application.user.seller_restriction_reason}
                    </p>
                  )}
                  {application.user.seller_restricted_at && (
                    <p className="mt-1 text-[11px] text-[#8A9083]">
                      Since {fmtDate(application.user.seller_restricted_at)}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {application.user.seller_status && application.user.seller_status !== 'active' ? (
                  <button
                    onClick={handleUnrestrictSeller}
                    disabled={isProcessing}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#A3E635] px-3 py-2 text-[13px] font-bold text-[#0F3320] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Remove Restriction
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setRestrictionType('restricted')
                        setShowRestrictModal(true)
                      }}
                      disabled={isProcessing}
                      className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#FEF3C7] px-3 py-2 text-[13px] font-bold text-[#92400E] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Restrict
                    </button>
                    <button
                      onClick={() => {
                        setRestrictionType('banned')
                        setShowRestrictModal(true)
                      }}
                      disabled={isProcessing}
                      className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#FEF2F1] px-3 py-2 text-[13px] font-bold text-[#B42318] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Ban
                    </button>
                  </>
                )}

                <button
                  onClick={handleViewHistory}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#E4E5DE] px-3 py-2 text-[13px] font-semibold text-[#5B6157] transition-colors hover:bg-[#FAFAF7]"
                >
                  <History className="h-3.5 w-3.5" />
                  View Restriction History
                </button>
              </div>

              <p className="mt-3 rounded-[10px] bg-[#FAFAF7] px-3 py-2 text-[11px] leading-relaxed text-[#8A9083]">
                <b className="text-[#5B6157]">Restrict:</b> prevents new listings ·{' '}
                <b className="text-[#5B6157]">Ban:</b> full restriction
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ══ MODALS (CSS-only motion) ══ */}

      {/* Approve */}
      {showApproveModal && (
        <ModalShell onClose={() => !isProcessing && setShowApproveModal(false)}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#A3E635]/[0.18]">
              <CheckCircle className="h-7 w-7 text-[#65A30D]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-[#14432A]">Approve Seller?</h3>
            <p className="text-sm leading-relaxed text-[#5B6157]">
              This will grant <b className="font-semibold text-[#1A1D19]">{shopName}</b> access
              to the seller dashboard and allow them to start listing products.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowApproveModal(false)}
              disabled={isProcessing}
              className={MODAL_CANCEL}
            >
              Cancel
            </button>
            <button onClick={handleApprove} disabled={isProcessing} className={MODAL_CONFIRM_LIME}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Approving…
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </>
              )}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Reject */}
      {showRejectModal && (
        <ModalShell onClose={() => !isProcessing && setShowRejectModal(false)}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FEF2F1]">
              <XCircle className="h-7 w-7 text-[#B42318]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-[#14432A]">Reject Application</h3>
            <p className="text-sm text-[#5B6157]">
              Please provide a clear reason for rejecting this application.
            </p>
          </div>

          <div className="mb-4">
            <label className={MODAL_LABEL}>Rejection Category *</label>
            <select
              value={rejectionCategory}
              onChange={(e) => setRejectionCategory(e.target.value)}
              className={MODAL_INPUT}
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

          <div className="mb-6">
            <label className={MODAL_LABEL}>Rejection Reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className={cn(MODAL_INPUT, 'resize-none')}
              rows={4}
              placeholder="Enter detailed reason for rejection…"
              required
            />
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setShowRejectModal(false)}
              disabled={isProcessing}
              className={MODAL_CANCEL}
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isProcessing}
              className={MODAL_CONFIRM_RED}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {isProcessing ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Request Changes */}
      {showChangesModal && (
        <ModalShell onClose={() => !isProcessing && setShowChangesModal(false)}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FEF3C7]">
              <MessageSquareWarning className="h-7 w-7 text-[#92400E]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-[#14432A]">Request Changes</h3>
            <p className="text-sm leading-relaxed text-[#5B6157]">
              The applicant gets your note by email and the application moves to{' '}
              <b className="font-semibold text-[#1A1D19]">Changes Requested</b> until they respond.
            </p>
          </div>

          <div className="mb-6">
            <label className={MODAL_LABEL}>What Needs To Change *</label>
            <textarea
              value={changesMessage}
              onChange={(e) => setChangesMessage(e.target.value)}
              className={cn(MODAL_INPUT, 'resize-none')}
              rows={4}
              placeholder="e.g. Your proof of address is older than 3 months — please upload a recent utility bill…"
              required
            />
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setShowChangesModal(false)}
              disabled={isProcessing}
              className={MODAL_CANCEL}
            >
              Cancel
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={!changesMessage.trim() || isProcessing}
              className={MODAL_CONFIRM_LIME}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Restrict / Ban */}
      {showRestrictModal && (
        <ModalShell
          onClose={() => {
            setShowRestrictModal(false)
            setRestrictionReason('')
          }}
        >
          <div className="mb-6 text-center">
            <div
              className={cn(
                'mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl',
                restrictionType === 'banned' ? 'bg-[#FEF2F1]' : 'bg-[#FEF3C7]'
              )}
            >
              {restrictionType === 'banned' ? (
                <Ban className="h-7 w-7 text-[#B42318]" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-[#92400E]" />
              )}
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-[#14432A]">
              {restrictionType === 'banned' ? 'Ban Seller' : 'Restrict Seller'}
            </h3>
            <p className="text-sm text-[#5B6157]">
              {restrictionType === 'banned'
                ? 'This will completely ban the seller from accessing seller features.'
                : 'This will prevent the seller from creating new listings or making existing listings live.'}
            </p>
          </div>

          <div className="mb-4 rounded-[11px] bg-[#FEF3C7] px-3.5 py-3">
            <p className="text-xs text-[#92400E]">
              When {restrictionType === 'banned' ? 'banned' : 'restricted'}, the seller will see
              an error message when attempting to upload or publish listings:
            </p>
            <p
              className={cn(
                'mt-2 rounded-lg bg-white/70 p-2 text-xs text-[#1A1D19]',
                FOREST_CLASSES.mono
              )}
            >
              &quot;Your seller account is{' '}
              {restrictionType === 'banned' ? 'banned' : 'under review'}. Please contact support
              at test@gmail.com&quot;
            </p>
          </div>

          <div className="mb-6">
            <label className={MODAL_LABEL}>Restriction Reason *</label>
            <textarea
              value={restrictionReason}
              onChange={(e) => setRestrictionReason(e.target.value)}
              className={cn(MODAL_INPUT, 'resize-none')}
              rows={4}
              placeholder="Enter detailed reason for restriction…"
              required
            />
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                setShowRestrictModal(false)
                setRestrictionReason('')
              }}
              disabled={isProcessing}
              className={MODAL_CANCEL}
            >
              Cancel
            </button>
            <button
              onClick={handleRestrictSeller}
              disabled={!restrictionReason.trim() || isProcessing}
              className={MODAL_CONFIRM_RED}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  {restrictionType === 'banned' ? (
                    <Ban className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  Confirm
                </>
              )}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Restriction History */}
      {showHistoryModal && (
        <ModalShell onClose={() => setShowHistoryModal(false)} wide>
          <div className="mb-4 flex items-center justify-between border-b border-[#F0F1EA] pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#65A30D]" />
              <h3 className="text-base font-extrabold text-[#14432A]">Restriction History</h3>
            </div>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[#FAFAF7]"
            >
              <X className="h-4 w-4 text-[#5B6157]" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#65A30D]" />
            </div>
          ) : restrictionHistory.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#5B6157]">No restriction history found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {restrictionHistory.map((restriction: any) => (
                <div
                  key={restriction.id}
                  className="rounded-[11px] border border-[#E4E5DE] bg-[#FAFAF7] p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {restriction.restriction_type === 'restricted' && (
                        <ShieldAlert className="h-3.5 w-3.5 text-[#92400E]" />
                      )}
                      {restriction.restriction_type === 'banned' && (
                        <Ban className="h-3.5 w-3.5 text-[#B42318]" />
                      )}
                      {restriction.restriction_type === 'unrestricted' && (
                        <CheckCircle className="h-3.5 w-3.5 text-[#65A30D]" />
                      )}
                      <span className="text-sm font-bold capitalize text-[#1A1D19]">
                        {restriction.restriction_type}
                      </span>
                    </div>
                    <span className="text-xs text-[#8A9083]">
                      {fmtDateTime(restriction.created_at)}
                    </span>
                  </div>
                  {restriction.reason && (
                    <p className="mb-2 text-xs text-[#5B6157]">{restriction.reason}</p>
                  )}
                  {restriction.admin && (
                    <p className="text-xs text-[#8A9083]">
                      By: {restriction.admin.username || restriction.admin.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}
    </>
  )
}
