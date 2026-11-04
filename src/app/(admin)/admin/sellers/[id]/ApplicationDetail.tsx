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
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
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
import { VOLUME_LABELS, SELLER_TYPE_LABELS } from '@/lib/seller-application/labels'
import { applicationStatusLabel } from '../_status'
import { toast } from 'sonner'
import { ApplicationHeader, VerificationPanel } from './ApplicationHeader'
import {
  AdminNotesCard,
  AgreementCard,
  ApplicantCard,
  DocumentsCard,
  GamesCard,
  SellerManagementCard,
  TimelineCard,
  type TimelineItem,
} from './ApplicationCards'
import { fmtDateTime, titleFromSlug } from './application-format'

// ssr:false — the dialogs are never part of the first paint. They load on the
// first open (see dialogsOpened below).
const ApplicationDialogs = dynamic(() => import('./ApplicationDialogs'), { ssr: false })

interface ApplicationDetailProps {
  application: SellerApplication
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

  // Mount the lazy dialogs only after one has been opened at least once.
  // Rendering them earlier would make next/dynamic fetch the chunk on page
  // load. Once mounted they stay mounted, so a dialog still closes with its
  // exit animation.
  const [dialogsOpened, setDialogsOpened] = useState(false)
  const anyDialogOpen =
    showApproveModal || showRejectModal || showMessageModal || showChangesModal || showDiditModal
  useEffect(() => {
    if (anyDialogOpen) setDialogsOpened(true)
  }, [anyDialogOpen])

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
    const items: TimelineItem[] = []
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
  const closeApprove = () => {
    setShowApproveModal(false)
    setKycGap(null)
  }
  // The list and its tab counts stay cached for 60 s; a decision here changes both.
  const queryClient = useQueryClient()
  const markListsStale = () => {
    queryClient.invalidateQueries({ queryKey: ['application-counts'] })
    queryClient.invalidateQueries({ queryKey: ['seller-applications'] })
  }
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
      markListsStale()
      router.push('/admin/sellers?status=approved')
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
      markListsStale()
      router.push('/admin/sellers?status=rejected')
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
      markListsStale()
      setIsProcessing(false)
    } else {
      toast.error(result.error || 'Failed to request changes')
      setIsProcessing(false)
    }
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
      <ApplicationHeader
        application={application}
        shopName={shopName}
        statusLabel={statusLabel}
        diditSessionId={diditSessionId}
        sellerTypeLabel={sellerTypeLabel}
        submittedAt={submittedAt}
        volumeLabel={volumeLabel}
        isActionable={isActionable}
        isProcessing={isProcessing}
        onMessage={() => setShowMessageModal(true)}
        onReject={() => setShowRejectModal(true)}
        onRequestChanges={() => setShowChangesModal(true)}
        onApprove={() => setShowApproveModal(true)}
      />

      {/* ══ Verification ══ */}
      <VerificationPanel application={application} verification={verification} />

      {/* ══ Body ══ */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <GamesCard application={application} gameRows={gameRows} />

          <DocumentsCard
            diditSessionId={diditSessionId}
            diditDoc={diditDoc}
            uploadedDocs={uploadedDocs}
            documentUrls={documentUrls}
            loadingUrls={loadingUrls}
            onViewSession={() => setShowDiditModal(true)}
          />

          {/* NOTE: Payout and the detailed Business-entity fields were removed
              from the seller APPLICATION (now a 3-step flow: Account & Games →
              Identity → Review & Sign). Payout is set up later in Wallet; profile
              details live in Settings. Business sellers still upload their
              business documents, which appear in Identity & Documents above. */}

          <AgreementCard application={application} />
        </div>

        {/* Rail */}
        <div className="flex min-w-0 flex-col gap-5">
          <ApplicantCard application={application} />
          <TimelineCard timeline={timeline} />
          <AdminNotesCard adminNotes={adminNotes} setAdminNotes={setAdminNotes} />
          {application.status === 'approved' && <SellerManagementCard application={application} />}
        </div>
      </div>

      {/* ══ Dialogs ══ */}
      {dialogsOpened && (
        <ApplicationDialogs
          shopName={shopName}
          diditSessionId={diditSessionId}
          isProcessing={isProcessing}
          isSendingMessage={isSendingMessage}
          showApproveModal={showApproveModal}
          approveGap={approveGap}
          kycGap={kycGap}
          pendingFounding={pendingFounding}
          closeApprove={closeApprove}
          handleApprove={handleApprove}
          showRejectModal={showRejectModal}
          rejectionCategory={rejectionCategory}
          setRejectionCategory={setRejectionCategory}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          closeReject={() => setShowRejectModal(false)}
          handleReject={handleReject}
          showMessageModal={showMessageModal}
          outreachText={outreachText}
          setOutreachText={setOutreachText}
          closeMessage={() => setShowMessageModal(false)}
          handleSendMessage={handleSendMessage}
          showChangesModal={showChangesModal}
          changesMessage={changesMessage}
          setChangesMessage={setChangesMessage}
          closeChanges={() => setShowChangesModal(false)}
          handleRequestChanges={handleRequestChanges}
          showDiditModal={showDiditModal}
          closeDidit={() => setShowDiditModal(false)}
        />
      )}
    </div>
  )
}
