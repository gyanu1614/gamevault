'use client'

/**
 * /admin/active-sellers/[id] seller-management detail (account-section
 * design, 2026-09-30).
 *
 * Header (identity + tier/status badges + View Shop / View Application), the
 * seller's numbers as a StatStrip, then titled sections — heading ABOVE a
 * data-only card (owner: "title floating outside, card has data only"): tier
 * management (change control + history), listings, sales, wallet & payouts
 * (withdrawal approve/reject wired to the existing withdrawals actions),
 * seller management (restrict/ban) and comms (in-app message + email).
 *
 * Data via react-query seeded with the server wrapper's getSellerDetail;
 * every mutation invalidates the detail key + the active-sellers list.
 * Relative times gate on useNow() — never Date.now() in render.
 *
 * This file keeps the state and the mutations. The header and sections are
 * the SellerDetail*.tsx files beside it; the dialogs are one lazy chunk
 * (SellerDetailDialogs) that loads the first time a dialog opens.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Star } from '@phosphor-icons/react/dist/csr/Star'
import { useNow } from '@/hooks/use-now'
import {
  getSellerDetail,
  changeSellerTier,
  messageSeller,
  emailSeller,
  type SellerDetail,
} from '@/lib/actions/admin-seller-detail'
import { restrictSeller, unrestrictSeller } from '@/lib/actions/admin-seller-restrictions'
import {
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
} from '@/lib/actions/withdrawals'
import { decimal, money } from '@/lib/seller/format-amount'
import { StatStrip } from '@/components/account/AccountSurface'
import { ModerationPanel } from './ModerationPanel'
import { SellerDetailHeader } from './SellerDetailHeader'
import { SellerListingsSection, SellerSalesSection, SellerTierSection } from './SellerDetailSections'
import { SellerAgreementSection, SellerSignupSection, SellerWalletSection } from './SellerDetailRecords'
import { SellerContactSection, SellerManagementSection } from './SellerDetailActions'
import type { DialogKind } from './SellerDetailDialogParts'
import { balanceLabel, titleCase } from './seller-detail-format'

// Nothing in here shows until an admin opens a dialog, so it stays out of the
// page's first JS.
const SellerDetailDialogs = dynamic(() => import('./SellerDetailDialogs'), { ssr: false })

// ─── The page ────────────────────────────────────────────────────────────────

export default function SellerDetailClient({
  userId,
  initialDetail,
}: {
  userId: string
  /** Absent on a server action's refresh: the mounted client already has the data. */
  initialDetail?: SellerDetail
}) {
  const detailQuery = useQuery({
    queryKey: ['seller-detail', userId],
    queryFn: async () => {
      const result = await getSellerDetail(userId)
      if (!result.success || !result.detail) {
        throw new Error(result.error || 'Failed to load the seller')
      }
      return result.detail
    },
    initialData: initialDetail,
    staleTime: 30_000,
  })

  if (!detailQuery.data) return null
  return <SellerDetailView userId={userId} detail={detailQuery.data} />
}

function SellerDetailView({ userId, detail }: { userId: string; detail: SellerDetail }) {
  const queryClient = useQueryClient()
  const now = useNow()
  const { profile, presence } = detail

  const [dialog, setDialog] = useState<DialogKind>(null)
  // The dialogs chunk loads on the first open and then stays mounted, so
  // closing still plays the exit animation.
  const [dialogsLoaded, setDialogsLoaded] = useState(false)
  if (dialog && !dialogsLoaded) setDialogsLoaded(true)
  const [tierChoice, setTierChoice] = useState(profile.seller_tier)
  const [tierNotes, setTierNotes] = useState('')
  const [restrictionReason, setRestrictionReason] = useState('')
  const [messageText, setMessageText] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showAllListings, setShowAllListings] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-detail', userId] })
    queryClient.invalidateQueries({ queryKey: ['active-sellers'] })
    queryClient.invalidateQueries({ queryKey: ['seller-stats'] })
  }

  const shopName = profile.shop_name || profile.username || 'Seller'

  // ── Mutations ──────────────────────────────────────────────────────────────

  const tierMutation = useMutation({
    mutationFn: async () => {
      const result = await changeSellerTier({
        userId,
        newTier: tierChoice,
        notes: tierNotes || undefined,
      })
      if (!result.success) throw new Error(result.error || 'Failed to change the tier')
      return result
    },
    onSuccess: (result) => {
      // Optimistic patch so the hero + tier card reflect the write instantly.
      queryClient.setQueryData<SellerDetail>(['seller-detail', userId], (old) =>
        old
          ? { ...old, profile: { ...old.profile, seller_tier: result.newTier ?? tierChoice } }
          : old,
      )
      toast.success(
        result.previousTier === result.newTier
          ? 'Tier unchanged'
          : `Tier changed to ${titleCase(result.newTier ?? tierChoice)}`,
      )
      setDialog(null)
      setTierNotes('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: invalidate,
  })

  const restrictMutation = useMutation({
    mutationFn: async (params: { status: 'restricted' | 'banned' | 'active'; reason?: string }) => {
      const result =
        params.status === 'active'
          ? await unrestrictSeller(userId)
          : await restrictSeller({ userId, status: params.status, reason: params.reason })
      if (!result.success) throw new Error(result.error || 'Failed to update the seller')
      return params
    },
    onSuccess: (params) => {
      toast.success(
        params.status === 'active'
          ? 'Restriction removed'
          : params.status === 'banned'
            ? 'Seller banned'
            : 'Seller restricted',
      )
      setDialog(null)
      setRestrictionReason('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: invalidate,
  })

  const messageMutation = useMutation({
    mutationFn: async () => {
      const result = await messageSeller({ userId, message: messageText })
      if (!result.success) throw new Error(result.error || 'Could not send the message')
    },
    onSuccess: () => {
      toast.success('Message sent to the seller')
      setDialog(null)
      setMessageText('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const emailMutation = useMutation({
    mutationFn: async () => {
      const result = await emailSeller({ userId, subject: emailSubject, body: emailBody })
      if (!result.success) throw new Error(result.error || 'Could not send the email')
    },
    onSuccess: () => {
      toast.success('Email sent to the seller')
      setDialog(null)
      setEmailSubject('')
      setEmailBody('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const withdrawalMutation = useMutation({
    mutationFn: async (params: { requestId: string; decision: 'approve' | 'reject'; reason?: string }) => {
      const result =
        params.decision === 'approve'
          ? await approveWithdrawalRequest({ requestId: params.requestId })
          : await rejectWithdrawalRequest({ requestId: params.requestId, reason: params.reason || '' })
      if (!result.success) throw new Error(result.error || 'Failed to process the withdrawal')
      return params
    },
    onSuccess: (params) => {
      toast.success(params.decision === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected')
      setDialog(null)
      setRejectReason('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: invalidate,
  })

  const busy =
    tierMutation.isPending ||
    restrictMutation.isPending ||
    messageMutation.isPending ||
    emailMutation.isPending ||
    withdrawalMutation.isPending

  // ── Openers: reset the dialog's fields, then open it ───────────────────────

  const openTierDialog = () => {
    setTierChoice(profile.seller_tier)
    setTierNotes('')
    setDialog({ kind: 'tier' })
  }

  const openRestrictDialog = (type: 'restricted' | 'banned') => {
    setRestrictionReason('')
    setDialog({ kind: 'restrict', type })
  }

  const openMessageDialog = () => {
    setMessageText('')
    setDialog({ kind: 'message' })
  }

  const openEmailDialog = () => {
    setEmailSubject('')
    setEmailBody('')
    setDialog({ kind: 'email' })
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeListings = detail.listings.countsByStatus['active'] ?? 0
  const pendingListings = detail.listings.countsByStatus['pending_approval'] ?? 0

  const statCells = [
    {
      label: 'Active Listings',
      value: activeListings,
      hint: pendingListings > 0 ? <span className="text-warning">{pendingListings} pending</span> : undefined,
    },
    { label: 'Total Sales', value: detail.orders.completedCount },
    { label: 'Revenue', value: money(detail.orders.revenue), hint: `GMV ${money(detail.orders.gmv)}` },
    { label: 'Completion Rate', value: `${detail.orders.completionRate}%` },
    {
      label: 'Rating',
      value:
        profile.seller_rating != null ? (
          <span className="inline-flex items-center gap-1.5">
            <Star aria-hidden weight="fill" className="h-5 w-5 text-warning" />
            {decimal(profile.seller_rating, 1)}
          </span>
        ) : (
          '—'
        ),
      hint: `${profile.total_reviews} ${profile.total_reviews === 1 ? 'review' : 'reviews'}`,
    },
    {
      label: 'Seller Balance',
      value: balanceLabel(detail.wallet.sellerBalances),
      hint: `Store credit ${balanceLabel(detail.wallet.storeCreditBalances)}`,
    },
  ]

  return (
    <div className="space-y-5">
      {/* ══ Header ══ */}
      <SellerDetailHeader
        profile={profile}
        presence={presence}
        application={detail.application}
        shopName={shopName}
        now={now}
      />

      <StatStrip stats={statCells} className="md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-6" />

      {/* ══ Body ══ */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <SellerTierSection detail={detail} onChangeTier={openTierDialog} />
          <SellerListingsSection
            detail={detail}
            pendingListings={pendingListings}
            showAllListings={showAllListings}
            onToggleShowAll={() => setShowAllListings((v) => !v)}
          />
          <SellerSalesSection detail={detail} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModerationPanel detail={detail} />
          <SellerSignupSection detail={detail} />
          <SellerAgreementSection detail={detail} />
          <SellerWalletSection detail={detail} busy={busy} setDialog={setDialog} />
          <SellerManagementSection
            detail={detail}
            busy={busy}
            onRestrict={openRestrictDialog}
            setDialog={setDialog}
          />
          <SellerContactSection detail={detail} onMessage={openMessageDialog} onEmail={openEmailDialog} />
        </div>
      </div>

      {/* ══ Dialogs ══ */}
      {dialogsLoaded && (
        <SellerDetailDialogs
          detail={detail}
          dialog={dialog}
          setDialog={setDialog}
          busy={busy}
          shopName={shopName}
          tierChoice={tierChoice}
          setTierChoice={setTierChoice}
          tierNotes={tierNotes}
          setTierNotes={setTierNotes}
          tierMutation={tierMutation}
          restrictionReason={restrictionReason}
          setRestrictionReason={setRestrictionReason}
          restrictMutation={restrictMutation}
          messageText={messageText}
          setMessageText={setMessageText}
          messageMutation={messageMutation}
          emailSubject={emailSubject}
          setEmailSubject={setEmailSubject}
          emailBody={emailBody}
          setEmailBody={setEmailBody}
          emailMutation={emailMutation}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          withdrawalMutation={withdrawalMutation}
        />
      )}
    </div>
  )
}
