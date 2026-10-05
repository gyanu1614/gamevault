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
 */

import React, { useMemo, useState } from 'react'
import Link from '@/components/navigation/AppLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp'
import { ChatCircleText } from '@phosphor-icons/react/dist/csr/ChatCircleText'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleNotch } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { EnvelopeSimple } from '@phosphor-icons/react/dist/csr/EnvelopeSimple'
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { Prohibit } from '@phosphor-icons/react/dist/csr/Prohibit'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning'
import { Star } from '@phosphor-icons/react/dist/csr/Star'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { cn } from '@/lib/utils'
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
import { getAvatarUrl } from '@/lib/utils/avatar'
import { TIERS, TIER_KEYS, tierByKey } from '@/lib/seller/tiers'
import {
  balanceLabel as sharedBalanceLabel,
  decimal,
  money,
  signedMoney,
} from '@/lib/seller/format-amount'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { StatStrip } from '@/components/account/AccountSurface'
import { accountInputCls } from '@/components/account/AccountSurface'
import { StatusBadge, adminBtn, adminBtnSm, type ChipTone } from '../../components/kit'
import { TierChip } from '../../components/TierChip'

/** Seller rank ladder, low → high, from the central module. */
const SELLER_TIERS = TIER_KEYS

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** UTC-pinned so server and client format the identical string. */
function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function relativeTime(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€' }

function balanceLabel(balances: { currency: string; amount: number }[]): string {
  return sharedBalanceLabel(balances, CURRENCY_SYMBOL)
}

function titleCase(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Generic status → badge tone. */
function statusTone(status: string): ChipTone {
  switch (status) {
    case 'active':
    case 'completed':
    case 'approved':
    case 'sold':
      return 'success'
    case 'pending':
    case 'pending_approval':
    case 'changes_requested':
    case 'processing':
    case 'paid':
    case 'delivering':
    case 'delivered':
    case 'paused':
      return 'warning'
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'disputed':
    case 'failed':
    case 'banned':
      return 'error'
    default:
      return 'neutral'
  }
}

function Badge({ status }: { status: string }) {
  return <StatusBadge status={titleCase(status)} tone={statusTone(status)} />
}

// ─── Small primitives ────────────────────────────────────────────────────────

/**
 * Section = heading ABOVE a data-only card (owner: "title floating outside,
 * card has data only" — no icon boxes).
 */
function Section({
  title,
  sub,
  aside,
  children,
  className,
}: {
  title: string
  sub?: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-text-tertiary">{sub}</p>}
        </div>
        {aside && <div className="shrink-0 whitespace-nowrap">{aside}</div>}
      </div>
      <div className="rounded-lg bg-bg-raised p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** Sub-heading inside a card. */
const INNER_LABEL = 'mb-2 text-[13px] font-semibold text-text-secondary'

/** Rows inside a card, hairlines between. */
const ROWS = 'divide-y divide-white/[0.06]'

const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

const FLAG = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

/** The shared Radix dialog; closing is blocked while a mutation runs. */
function ActionDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row [&>*]:sm:flex-1">{children}</div>
}

function Spinner() {
  return <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
}

// ─── The page ────────────────────────────────────────────────────────────────

type DialogKind =
  | { kind: 'tier' }
  | { kind: 'restrict'; type: 'restricted' | 'banned' }
  | { kind: 'unrestrict' }
  | { kind: 'history' }
  | { kind: 'message' }
  | { kind: 'email' }
  | { kind: 'withdrawal-approve'; requestId: string; amount: number }
  | { kind: 'withdrawal-reject'; requestId: string; amount: number }
  | null

export default function SellerDetailClient({
  userId,
  initialDetail,
}: {
  userId: string
  initialDetail: SellerDetail
}) {
  const queryClient = useQueryClient()
  const now = useNow()

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

  const detail = detailQuery.data
  const { profile, presence } = detail

  const [dialog, setDialog] = useState<DialogKind>(null)
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
  const restrictedish = profile.seller_status === 'restricted' || profile.seller_status === 'banned'

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeListings = detail.listings.countsByStatus['active'] ?? 0
  const pendingListings = detail.listings.countsByStatus['pending_approval'] ?? 0

  const currentConfig = useMemo(
    () => detail.tier.configs.find((c) => c.tier === profile.seller_tier) ?? null,
    [detail.tier.configs, profile.seller_tier],
  )

  const eligibleHigher = useMemo(() => {
    const info = detail.tier.info
    if (!info || !info.eligible_tier || info.eligible_tier === profile.seller_tier) return null
    const order = (t: string) => SELLER_TIERS.indexOf(t as (typeof SELLER_TIERS)[number])
    return order(info.eligible_tier) > order(profile.seller_tier) ? info.eligible_tier : null
  }, [detail.tier.info, profile.seller_tier])

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

  const listings = showAllListings ? detail.listings.recent : detail.listings.recent.slice(0, 5)

  return (
    <div className="space-y-5">
      {/* ══ Header ══ */}
      <div>
        <Link
          href="/admin/active-sellers"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Active Sellers
        </Link>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarUrl(profile.avatar_url, profile.username || profile.email || 'seller')}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
                  {shopName}
                </h1>
                <TierChip tier={profile.seller_tier} />
                {profile.kyc_status && (
                  <StatusBadge status={`KYC ${titleCase(profile.kyc_status)}`} tone={statusTone(profile.kyc_status)} />
                )}
                {profile.seller_status === 'restricted' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Restricted</span>}
                {profile.seller_status === 'banned' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Banned</span>}
                {presence.store_paused && <span className={cn(FLAG, 'bg-warning-bg text-warning')}>Paused</span>}
                {profile.founding_seller && <span className={cn(FLAG, 'bg-success-bg text-success')}>Founding</span>}
                {profile.is_test && <span className={cn(FLAG, 'bg-white/[0.07] text-text-secondary')}>Test</span>}
              </div>
              <p className="mt-1 break-words text-[13px] text-text-secondary">
                @{profile.username || 'unknown'}
                {profile.email && <> · {profile.email}</>}
              </p>
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-tertiary">
                <span>
                  Joined <span className="font-medium text-text-secondary">{fmtDate(profile.created_at)}</span>
                </span>
                {presence.last_active_at && now != null && (
                  <span>
                    Last active <span className="font-medium text-text-secondary">{relativeTime(presence.last_active_at, now)}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {profile.shop_slug && (
              <Link href={`/shop/${profile.shop_slug}`} target="_blank" className={adminBtn.secondary}>
                <ArrowSquareOut aria-hidden weight="bold" className="h-4 w-4" />
                View Shop
              </Link>
            )}
            {detail.application && (
              <Link href={`/admin/sellers/${detail.application.id}`} className={adminBtn.secondary}>
                View Application
              </Link>
            )}
          </div>
        </div>
      </div>

      <StatStrip stats={statCells} className="md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-6" />

      {/* ══ Body ══ */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Section
            title="Seller Tier"
            sub="Sets commission, listing limits and moderation."
            aside={
              <button
                type="button"
                onClick={() => {
                  setTierChoice(profile.seller_tier)
                  setTierNotes('')
                  setDialog({ kind: 'tier' })
                }}
                className={adminBtnSm.secondary}
              >
                Change Tier
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TierChip tier={profile.seller_tier} className="text-[12.5px]" />
              {currentConfig && (
                <span className="text-[12.5px] text-text-tertiary">
                  {currentConfig.discount_pts != null && (
                    <>
                      Rank discount{' '}
                      <span className="font-semibold tabular-nums text-text-secondary">
                        {currentConfig.discount_pts > 0 ? `−${currentConfig.discount_pts} pts` : 'none'}
                      </span>
                      {' · '}
                    </>
                  )}
                  Listing limit{' '}
                  <span className="font-semibold tabular-nums text-text-secondary">
                    {currentConfig.listing_limit ?? 'Unlimited'}
                  </span>
                  {currentConfig.pre_moderation_listings != null && (
                    <>
                      {' · '}Pre-moderated listings{' '}
                      <span className="font-semibold tabular-nums text-text-secondary">
                        {currentConfig.pre_moderation_listings}
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>

            {eligibleHigher && (
              <p className="mt-3 rounded-md bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success">
                Eligible for <span className="font-bold">{titleCase(eligibleHigher)}</span> by the automatic rules —
                consider an upgrade.
              </p>
            )}

            {detail.tier.history.length > 0 && (
              <div className="mt-4">
                <p className={INNER_LABEL}>Recent Tier Changes</p>
                <div className={ROWS}>
                  {detail.tier.history.map((h) => (
                    <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px] first:pt-0">
                      <span className="font-semibold text-text-primary">
                        {h.previous_tier ? titleCase(h.previous_tier) : '—'} → {titleCase(h.new_tier)}
                      </span>
                      <span className="text-text-tertiary">{titleCase(h.reason)}</span>
                      {h.notes && <span className="italic text-text-tertiary">“{h.notes}”</span>}
                      <span className="ml-auto text-text-tertiary">{fmtDate(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="Listings"
            sub="Inventory by status, newest first."
            aside={
              pendingListings > 0 ? (
                <Link
                  href="/admin/moderation"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                >
                  Moderation Queue
                  <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(detail.listings.countsByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <StatusBadge key={status} status={`${titleCase(status)} ${count}`} tone={statusTone(status)} />
                ))}
              {Object.keys(detail.listings.countsByStatus).length === 0 && (
                <p className="text-[13px] text-text-tertiary">No listings yet.</p>
              )}
            </div>

            {detail.listings.recent.length > 0 && (
              <div className={cn(ROWS, 'mt-3')}>
                {listings.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <p className="min-w-0 basis-full truncate text-[13.5px] font-medium text-text-primary sm:flex-1 sm:basis-auto">{l.title}</p>
                    {l.game_name && (
                      <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                        {l.game_name}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold tabular-nums text-text-primary">{money(l.price)}</span>
                    <Badge status={l.status} />
                    <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(l.created_at)}</span>
                  </div>
                ))}
                {detail.listings.recent.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllListings((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 pt-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {showAllListings ? (
                      <>
                        <CaretUp aria-hidden weight="bold" className="h-3.5 w-3.5" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <CaretDown aria-hidden weight="bold" className="h-3.5 w-3.5" />
                        Show More ({detail.listings.recent.length - 5})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Sales"
            sub={`${detail.orders.totalOrders} orders all-time · ${detail.orders.completedCount} completed.`}
          >
            {detail.orders.recent.length === 0 ? (
              <p className="text-[13px] text-text-tertiary">No orders yet.</p>
            ) : (
              <div className={ROWS}>
                {detail.orders.recent.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 transition-colors first:pt-0 hover:bg-white/[0.03]"
                  >
                    <span className="font-mono text-[12.5px] font-semibold text-text-primary">
                      {o.order_number || `#${o.id.split('-')[0]}`}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-text-primary">{money(o.total_amount)}</span>
                    <span className="text-[12px] tabular-nums text-text-tertiary">payout {money(o.seller_payout)}</span>
                    <span className="ml-auto">
                      <Badge status={o.status} />
                    </span>
                    <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(o.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Wallet & Payouts" sub="Balances, wallet activity and withdrawal requests.">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                { label: 'Seller Balance', rows: detail.wallet.sellerBalances },
                { label: 'Store Credit', rows: detail.wallet.storeCreditBalances },
              ].map((box) => (
                <div key={box.label} className="rounded-md bg-bg-overlay px-3.5 py-3">
                  <p className="text-[12px] font-medium text-text-tertiary">{box.label}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {box.rows.map((b) => (
                      <span key={b.currency} className="text-[16px] font-bold tabular-nums text-text-primary">
                        {CURRENCY_SYMBOL[b.currency] ?? `${b.currency} `}
                        {decimal(b.amount)}
                        <span className="ml-1 text-[11.5px] font-semibold text-text-tertiary">{b.currency}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {detail.wallet.transactions.length > 0 && (
              <div className="mt-4">
                <p className={INNER_LABEL}>Recent Wallet Activity</p>
                <div className={ROWS}>
                  {detail.wallet.transactions.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0">
                      <span className="text-[13px] font-medium text-text-primary">{titleCase(t.type)}</span>
                      {t.description && (
                        <span className="min-w-0 flex-1 truncate text-[12px] text-text-tertiary">{t.description}</span>
                      )}
                      <span className={cn('ml-auto text-[13px] font-semibold tabular-nums', t.amount < 0 ? 'text-error' : 'text-success')}>
                        {signedMoney(t.amount)}
                      </span>
                      <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className={INNER_LABEL}>Withdrawal Requests</p>
              {detail.withdrawals.length === 0 ? (
                <p className="text-[13px] text-text-tertiary">No withdrawal requests.</p>
              ) : (
                <div className={ROWS}>
                  {detail.withdrawals.map((w) => (
                    <div key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0">
                      <span className="text-[13.5px] font-semibold tabular-nums text-text-primary">{money(w.amount)}</span>
                      {w.net_amount != null && w.net_amount !== w.amount && (
                        <span className="text-[12px] tabular-nums text-text-tertiary">net {money(w.net_amount)}</span>
                      )}
                      <span className="text-[12.5px] text-text-secondary">{w.method_name || '—'}</span>
                      <Badge status={w.status} />
                      <span className="text-[12px] text-text-tertiary">{fmtDate(w.created_at)}</span>
                      {w.status === 'pending' && (
                        <span className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDialog({ kind: 'withdrawal-reject', requestId: w.id, amount: w.amount })}
                            className={adminBtnSm.danger}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDialog({ kind: 'withdrawal-approve', requestId: w.id, amount: w.amount })}
                            className={adminBtnSm.secondary}
                          >
                            Approve
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

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
                    onClick={() => {
                      setRestrictionReason('')
                      setDialog({ kind: 'restrict', type: 'restricted' })
                    }}
                    disabled={busy}
                    className={cn(adminBtn.secondary, 'text-warning')}
                  >
                    <ShieldWarning aria-hidden weight="bold" className="h-4 w-4" />
                    Restrict
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRestrictionReason('')
                      setDialog({ kind: 'restrict', type: 'banned' })
                    }}
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

          <Section title="Contact Seller" sub="In-app message or branded email — both are logged.">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessageText('')
                  setDialog({ kind: 'message' })
                }}
                className={adminBtn.secondary}
              >
                <ChatCircleText aria-hidden weight="bold" className="h-4 w-4" />
                Send In-App Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailSubject('')
                  setEmailBody('')
                  setDialog({ kind: 'email' })
                }}
                disabled={!profile.email}
                className={adminBtn.secondary}
              >
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
        </div>
      </div>

      {/* ══ Dialogs ══ */}

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
    </div>
  )
}
