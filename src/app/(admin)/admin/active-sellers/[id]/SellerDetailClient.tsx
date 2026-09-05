'use client'

/**
 * Forest Ledger — /admin/active-sellers/[id] seller-management detail.
 *
 * Single-column forest-glass cards (Card/ModalShell lifted from the
 * application detail): hero identity band, real-number stat strip, tier
 * management (change control + history), listings, sales, wallet &
 * payouts (with withdrawal approve/reject wired to the existing
 * withdrawals actions), seller management (restrict/ban — moved here from
 * ApplicationDetail) and comms (in-app message + email).
 *
 * Data via react-query seeded with the server wrapper's getSellerDetail;
 * every mutation invalidates the detail key + the active-sellers list.
 * Relative times gate on useNow() — never Date.now() in render.
 */

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react'
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
import {
  FOREST_BG,
  FOREST_CLASSES,
  FOREST_MOTION,
  forestStagger,
} from '../../_theme/forest'
import { tierChipClass } from '../_components/ActiveSellersPageClient'

/** Client copy of the tier ladder (the 'use server' module can't export it). */
const SELLER_TIERS = ['unverified', 'bronze', 'silver', 'gold', 'platinum', 'diamond'] as const

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

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€' }

function balanceLabel(balances: { currency: string; amount: number }[]): string {
  const nonZero = balances.filter((b) => b.amount !== 0)
  const shown = nonZero.length > 0 ? nonZero : balances.slice(0, 1)
  return shown
    .map((b) => `${CURRENCY_SYMBOL[b.currency] ?? `${b.currency} `}${b.amount.toFixed(2)}`)
    .join(' · ')
}

function titleCase(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Generic status → chip tone (lime / amber / red / neutral). */
function statusChipClass(status: string): string {
  const base =
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-bold'
  const lime = `${base} bg-[#A3E635]/[0.16] text-[#BEF264]`
  const amber = `${base} bg-[#F59E0B]/[0.16] text-[#FCD34D]`
  const red = `${base} bg-[#B42318]/20 text-[#FCA5A5]`
  const neutral = `${base} bg-white/[0.1] text-white/85`
  switch (status) {
    case 'active':
    case 'completed':
    case 'approved':
    case 'sold':
      return lime
    case 'pending':
    case 'pending_approval':
    case 'changes_requested':
    case 'processing':
    case 'paid':
    case 'delivering':
    case 'delivered':
    case 'paused':
      return amber
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'disputed':
    case 'failed':
    case 'banned':
      return red
    default:
      return neutral
  }
}

// ─── Small ledger primitives (lifted from ApplicationDetail) ─────────────────

/**
 * Section = floating heading OUTSIDE the glass card, data-only card below
 * (owner: "title floating outside, card has data only" — no icon boxes).
 */
function Card({
  title,
  sub,
  index,
  children,
  className,
}: {
  title: string
  sub?: string
  index: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(FOREST_MOTION.fadeUp, className)} style={forestStagger(index)}>
      <div className="mb-2 px-0.5">
        <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-white">{title}</h3>
        {sub && <p className="mt-0.5 text-[12.5px] text-white/85">{sub}</p>}
      </div>
      <div className={FOREST_CLASSES.card}>{children}</div>
    </section>
  )
}

/** CSS-only modal shell on the forest canvas — forest-glass panel. */
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
          'relative w-full rounded-2xl border border-white/10 bg-[#0F2419]/95 p-6 text-white/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-md',
          wide ? 'max-w-lg' : 'max-w-md',
          'max-h-[90vh] overflow-y-auto',
          FOREST_MOTION.fadeUp,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const MODAL_LABEL =
  'mb-2 block text-[10.5px] font-bold uppercase tracking-[0.07em] text-white/85'
/** In-card sub-section heading — short, bright, human (not a column header). */
const INNER_LABEL = 'mb-2 block text-[13px] font-bold text-white/90'
const MODAL_INPUT =
  'w-full rounded-[10px] border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 focus:border-[#A3E635] focus:outline-none'
const MODAL_CANCEL =
  'flex-1 rounded-[10px] border border-white/15 px-3 py-2.5 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/[0.06] disabled:opacity-50'
const MODAL_CONFIRM_LIME =
  'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#A3E635] px-3 py-2.5 text-[13px] font-bold text-[#0F3320] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
const MODAL_CONFIRM_RED =
  'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#B42318] px-3 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

const CHIP =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-bold'

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

  let cardIndex = 0

  const stats: { label: string; value: React.ReactNode; sub?: string }[] = [
    { label: 'Active Listings', value: activeListings, sub: pendingListings > 0 ? `${pendingListings} pending` : undefined },
    { label: 'Total Sales', value: detail.orders.completedCount },
    { label: 'Revenue', value: money(detail.orders.revenue), sub: `GMV ${money(detail.orders.gmv)}` },
    { label: 'Completion Rate', value: `${detail.orders.completionRate}%` },
    {
      label: 'Rating',
      value:
        profile.seller_rating != null ? (
          <span className="inline-flex items-center gap-1.5">
            <Star className="h-5 w-5 fill-current text-[#FCD34D]" />
            {profile.seller_rating.toFixed(1)}
          </span>
        ) : (
          '—'
        ),
      sub: `${profile.total_reviews} ${profile.total_reviews === 1 ? 'review' : 'reviews'}`,
    },
    { label: 'Seller Balance', value: balanceLabel(detail.wallet.sellerBalances) },
    { label: 'Store Credit', value: balanceLabel(detail.wallet.storeCreditBalances) },
  ]

  return (
    <>
      {/* ══ HERO — forest band, seller identity ══ */}
      <section
        className={cn('relative overflow-hidden rounded-2xl px-6 pb-6 pt-6 sm:px-7', FOREST_MOTION.fadeIn)}
        style={{ background: FOREST_BG.hero }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: FOREST_BG.heroNoise }} />

        <div className="relative z-[1] mb-4 flex items-center gap-2 text-[12px] text-white/70">
          <Link
            href="/admin/active-sellers"
            className="inline-flex items-center gap-1 transition-colors hover:text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Active Sellers
          </Link>
          {' / '}
          <b className="font-medium text-white/85">{shopName}</b>
        </div>

        <div className="relative z-[1] flex flex-wrap items-start gap-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAvatarUrl(profile.avatar_url, profile.username || profile.email || 'seller')}
            alt={shopName}
            className="h-[76px] w-[76px] shrink-0 rounded-2xl object-cover shadow-[0_0_0_3px_rgba(255,255,255,0.14),0_14px_30px_-14px_rgba(0,0,0,0.7)]"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[11px]">
              <h1 className="text-[26px] font-extrabold tracking-[-0.01em] text-white">{shopName}</h1>
              <span className={tierChipClass(profile.seller_tier, currentConfig?.badge_color)}>
                {titleCase(profile.seller_tier)}
              </span>
              {profile.kyc_status && (
                <span className={statusChipClass(profile.kyc_status)}>
                  KYC {titleCase(profile.kyc_status)}
                </span>
              )}
              {profile.seller_status === 'restricted' && (
                <span className={cn(CHIP, 'bg-[#B42318]/20 text-[#FCA5A5]')}>Restricted</span>
              )}
              {profile.seller_status === 'banned' && (
                <span className={cn(CHIP, 'bg-[#B42318]/25 text-[#FCA5A5]')}>Banned</span>
              )}
              {presence.store_paused && (
                <span className={cn(CHIP, 'bg-[#F59E0B]/[0.16] text-[#FCD34D]')}>Paused</span>
              )}
              {profile.founding_seller && (
                <span className={cn(CHIP, 'bg-[#A3E635]/[0.15] text-[#D9F99D]')}>Founding</span>
              )}
              {profile.is_test && (
                <span className={cn(CHIP, 'bg-white/[0.1] text-white/85')}>Test</span>
              )}
            </div>
            <div className="mt-1.5 text-[13px] text-white/85">
              @{profile.username || 'unknown'}
              {profile.email && <> · {profile.email}</>}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-4 text-[12px] text-white/70">
              <span>
                Joined <b className="font-semibold text-white/85">{fmtDate(profile.created_at)}</b>
              </span>
              {presence.last_active_at && now != null && (
                <span>
                  Last Active{' '}
                  <b className="font-semibold text-white/85">
                    {relativeTime(presence.last_active_at, now)}
                  </b>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-[9px] lg:ml-auto">
            {profile.shop_slug && (
              <Link
                href={`/shop/${profile.shop_slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/[0.12] px-4 py-2.5 text-[12.5px] font-bold text-white/85 transition-colors hover:bg-white/[0.2]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Shop
              </Link>
            )}
            {detail.application && (
              <Link
                href={`/admin/sellers/${detail.application.id}`}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/[0.12] px-4 py-2.5 text-[12.5px] font-bold text-white/85 transition-colors hover:bg-white/[0.2]"
              >
                View Application
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ══ STAT BAND — one row, wraps on smaller widths ══ */}
      <div
        className={cn(
          'mt-4 flex flex-wrap gap-x-10 gap-y-5 rounded-[14px] border border-white/[0.09] bg-white/[0.05] px-6 py-5 backdrop-blur-sm',
          FOREST_MOTION.fadeUp,
        )}
        style={forestStagger(cardIndex++)}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/85">
              {s.label}
            </div>
            <div className="mt-1 text-[26px] font-bold leading-none tabular-nums text-white">
              {s.value}
            </div>
            {s.sub && <div className="mt-1 text-[11.5px] tabular-nums text-white/85">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ══ BODY — single column of ledger cards ══ */}
      <div className="mt-5 flex min-w-0 flex-col gap-3.5">
        {/* ── Tier card ── */}
        <Card
          title="Seller Tier"
          sub="Sets commission, listing limits and moderation."
          index={cardIndex++}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className={tierChipClass(profile.seller_tier, currentConfig?.badge_color)}>
              {currentConfig?.display_name || titleCase(profile.seller_tier)}
            </span>
            {currentConfig && (
              <span className="text-[12px] text-white/85">
                {currentConfig.commission_rate != null && (
                  <>Commission{' '}
                    <b className="font-semibold tabular-nums text-white/85">
                      {(currentConfig.commission_rate * 100).toFixed(2)}%
                    </b>
                  </>
                )}
                {' · '}Listing Limit{' '}
                <b className="font-semibold tabular-nums text-white/85">
                  {currentConfig.listing_limit ?? 'Unlimited'}
                </b>
                {currentConfig.pre_moderation_listings != null && (
                  <>
                    {' · '}Pre-Moderated Listings{' '}
                    <b className="font-semibold tabular-nums text-white/85">
                      {currentConfig.pre_moderation_listings}
                    </b>
                  </>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setTierChoice(profile.seller_tier)
                setTierNotes('')
                setDialog({ kind: 'tier' })
              }}
              className="ml-auto rounded-[10px] bg-white/[0.12] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/[0.18]"
            >
              Change Tier
            </button>
          </div>

          {eligibleHigher && (
            <div className="mt-3 rounded-[11px] bg-[#A3E635]/[0.12] px-3.5 py-2.5 text-[12px] text-[#D9F99D]">
              Eligible For <b className="font-bold">{titleCase(eligibleHigher)}</b> by the automatic
              rules — consider an upgrade.
            </div>
          )}

          {detail.tier.history.length > 0 && (
            <div className="mt-3.5">
              <div className={INNER_LABEL}>Recent Tier Changes</div>
              <div className={cn(FOREST_CLASSES.inset, 'px-3.5')}>
                {detail.tier.history.map((h, i) => (
                  <div
                    key={h.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12px] text-white/85',
                      i > 0 && 'border-t border-white/[0.08]',
                    )}
                  >
                    <span className="font-semibold text-white/85">
                      {h.previous_tier ? titleCase(h.previous_tier) : '—'} → {titleCase(h.new_tier)}
                    </span>
                    <span className="text-white/70">{titleCase(h.reason)}</span>
                    {h.notes && <span className="italic text-white/70">“{h.notes}”</span>}
                    <span className="ml-auto text-white/70">{fmtDate(h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── Listings card ── */}
        <Card title="Listings" sub="Inventory by status, newest first." index={cardIndex++}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(detail.listings.countsByStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <span key={status} className={statusChipClass(status)}>
                  {titleCase(status)} <b className="tabular-nums">{count}</b>
                </span>
              ))}
            {Object.keys(detail.listings.countsByStatus).length === 0 && (
              <p className="text-[12.5px] text-white/70">No listings yet.</p>
            )}
            {pendingListings > 0 && (
              <Link
                href="/admin/moderation"
                className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#A3E635] transition hover:brightness-110"
              >
                Open Moderation Queue ↗
              </Link>
            )}
          </div>

          {detail.listings.recent.length > 0 && (
            <div className={cn(FOREST_CLASSES.inset, 'mt-3.5 px-3.5')}>
              {(showAllListings
                ? detail.listings.recent
                : detail.listings.recent.slice(0, 5)
              ).map((l, i) => (
                <div
                  key={l.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5',
                    i > 0 && 'border-t border-white/[0.08]',
                  )}
                >
                  <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                    {l.title}
                  </p>
                  {l.game_name && (
                    <span className="rounded-md bg-white/[0.08] px-2 py-[2.5px] text-[10.5px] font-bold text-white/90">
                      {l.game_name}
                    </span>
                  )}
                  <span className="text-[12.5px] font-semibold tabular-nums text-white/90">
                    {money(l.price)}
                  </span>
                  <span className={statusChipClass(l.status)}>{titleCase(l.status)}</span>
                  <span className="w-[92px] text-right text-[11px] text-white/85">
                    {fmtDate(l.created_at)}
                  </span>
                </div>
              ))}
              {detail.listings.recent.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllListings((v) => !v)}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.08] py-2.5 text-[12px] font-bold text-white/85 transition-colors hover:text-white"
                >
                  {showAllListings ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Show More ({detail.listings.recent.length - 5})
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </Card>

        {/* ── Sales card ── */}
        <Card
          title="Sales"
          sub={`${detail.orders.totalOrders} orders all-time · ${detail.orders.completedCount} completed.`}
          index={cardIndex++}
        >
          {detail.orders.recent.length === 0 ? (
            <p className="text-[12.5px] text-white/70">No orders yet.</p>
          ) : (
            <div className={cn(FOREST_CLASSES.inset, 'px-3.5')}>
              {detail.orders.recent.map((o, i) => (
                <div
                  key={o.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5',
                    i > 0 && 'border-t border-white/[0.08]',
                  )}
                >
                  <span className={cn('text-[12px] font-bold text-white/85', FOREST_CLASSES.mono)}>
                    {o.order_number || `#${o.id.split('-')[0]}`}
                  </span>
                  <span className="text-[12.5px] font-semibold tabular-nums text-white/85">
                    {money(o.total_amount)}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-white/70">
                    payout {money(o.seller_payout)}
                  </span>
                  <span className={cn('ml-auto', statusChipClass(o.status))}>
                    {titleCase(o.status)}
                  </span>
                  <span className="w-[92px] text-right text-[11px] text-white/85">
                    {fmtDate(o.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Wallet & payouts card ── */}
        <Card
          title="Wallet & Payouts"
          sub="Balances, wallet activity and withdrawal requests."
          index={cardIndex++}
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className={cn(FOREST_CLASSES.inset, 'px-3.5 py-3')}>
              <div className={FOREST_CLASSES.kvKey}>Seller Balance</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {detail.wallet.sellerBalances.map((b) => (
                  <span key={b.currency} className="text-[15px] font-extrabold tabular-nums text-white/95">
                    {CURRENCY_SYMBOL[b.currency] ?? `${b.currency} `}
                    {b.amount.toFixed(2)}
                    <span className="ml-1 text-[10.5px] font-bold text-white/70">{b.currency}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className={cn(FOREST_CLASSES.inset, 'px-3.5 py-3')}>
              <div className={FOREST_CLASSES.kvKey}>Store Credit</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {detail.wallet.storeCreditBalances.map((b) => (
                  <span key={b.currency} className="text-[15px] font-extrabold tabular-nums text-white/95">
                    {CURRENCY_SYMBOL[b.currency] ?? `${b.currency} `}
                    {b.amount.toFixed(2)}
                    <span className="ml-1 text-[10.5px] font-bold text-white/70">{b.currency}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {detail.wallet.transactions.length > 0 && (
            <div className="mt-3.5">
              <div className={INNER_LABEL}>Recent Wallet Activity</div>
              <div className={cn(FOREST_CLASSES.inset, 'px-3.5')}>
                {detail.wallet.transactions.map((t, i) => (
                  <div
                    key={t.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1 py-2',
                      i > 0 && 'border-t border-white/[0.08]',
                    )}
                  >
                    <span className="text-[12px] font-semibold text-white/90">
                      {titleCase(t.type)}
                    </span>
                    {t.description && (
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/70">
                        {t.description}
                      </span>
                    )}
                    <span
                      className={cn(
                        'ml-auto text-[12.5px] font-bold tabular-nums',
                        t.amount < 0 ? 'text-[#FCA5A5]' : 'text-[#BEF264]',
                      )}
                    >
                      {t.amount < 0 ? `-$${Math.abs(t.amount).toFixed(2)}` : `+$${t.amount.toFixed(2)}`}
                    </span>
                    <span className="w-[92px] text-right text-[11px] text-white/85">
                      {fmtDate(t.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3.5">
            <div className={INNER_LABEL}>Withdrawal Requests</div>
            {detail.withdrawals.length === 0 ? (
              <p className="text-[12.5px] text-white/70">No withdrawal requests.</p>
            ) : (
              <div className={cn(FOREST_CLASSES.inset, 'px-3.5')}>
                {detail.withdrawals.map((w, i) => (
                  <div
                    key={w.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5',
                      i > 0 && 'border-t border-white/[0.08]',
                    )}
                  >
                    <span className="text-[13px] font-bold tabular-nums text-white/90">
                      {money(w.amount)}
                    </span>
                    {w.net_amount != null && w.net_amount !== w.amount && (
                      <span className="text-[11px] tabular-nums text-white/70">
                        net {money(w.net_amount)}
                      </span>
                    )}
                    <span className="text-[12px] text-white/85">{w.method_name || '—'}</span>
                    <span className={statusChipClass(w.status)}>{titleCase(w.status)}</span>
                    <span className="text-[11px] text-white/85">{fmtDate(w.created_at)}</span>
                    {w.status === 'pending' && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDialog({ kind: 'withdrawal-approve', requestId: w.id, amount: w.amount })
                          }
                          className="rounded-[9px] bg-[#A3E635] px-3 py-1.5 text-[11.5px] font-bold text-[#0F3320] transition hover:brightness-105 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDialog({ kind: 'withdrawal-reject', requestId: w.id, amount: w.amount })
                          }
                          className="rounded-[9px] border border-[#FCA5A5]/35 px-3 py-1.5 text-[11.5px] font-bold text-[#FCA5A5] transition hover:bg-[#FCA5A5]/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Seller management card ── */}
        <Card
          title="Seller Management"
          sub="Restrict or ban this seller's account."
          index={cardIndex++}
        >
          {restrictedish && (
            <div
              className={cn(
                'mb-3 rounded-[11px] px-3.5 py-3',
                profile.seller_status === 'banned' ? 'bg-[#B42318]/20' : 'bg-[#F59E0B]/[0.16]',
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-2 text-[12.5px] font-bold',
                  profile.seller_status === 'banned' ? 'text-[#FCA5A5]' : 'text-[#FCD34D]',
                )}
              >
                {profile.seller_status === 'banned' ? (
                  <Ban className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                Currently {profile.seller_status === 'banned' ? 'Banned' : 'Restricted'}
              </div>
              {profile.seller_restriction_reason && (
                <p className="mt-1.5 text-[11.5px] text-white/85">
                  Reason: {profile.seller_restriction_reason}
                </p>
              )}
              {profile.seller_restricted_at && (
                <p className="mt-1 text-[11px] text-white/70">
                  Since {fmtDate(profile.seller_restricted_at)}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {restrictedish ? (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'unrestrict' })}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#A3E635] px-4 py-2 text-[13px] font-bold text-[#0F3320] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
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
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F59E0B]/[0.16] px-4 py-2 text-[13px] font-bold text-[#FCD34D] transition hover:bg-[#F59E0B]/[0.24] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Restrict
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestrictionReason('')
                    setDialog({ kind: 'restrict', type: 'banned' })
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#B42318]/20 px-4 py-2 text-[13px] font-bold text-[#FCA5A5] transition hover:bg-[#B42318]/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Ban
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setDialog({ kind: 'history' })}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 px-4 py-2 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/[0.06]"
            >
              <History className="h-3.5 w-3.5" />
              View Restriction History
            </button>
          </div>

          <p className="mt-3 rounded-[10px] bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-white/70">
            <b className="text-white/85">Restrict / Ban:</b> pauses all active listings ·{' '}
            <b className="text-white/85">Remove Restriction:</b> does NOT unpause them — the seller
            republishes from their dashboard
          </p>
        </Card>

        {/* ── Comms card ── */}
        <Card
          title="Contact Seller"
          sub="In-app message or branded email — both are logged."
          index={cardIndex++}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMessageText('')
                setDialog({ kind: 'message' })
              }}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/[0.12] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.18]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
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
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/[0.12] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email
            </button>
          </div>

          {detail.reviews.length > 0 && (
            <div className="mt-3.5">
              <div className={INNER_LABEL}>Recent Reviews</div>
              <div className={cn(FOREST_CLASSES.inset, 'px-3.5')}>
                {detail.reviews.map((r, i) => (
                  <div
                    key={r.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5',
                      i > 0 && 'border-t border-white/[0.08]',
                    )}
                  >
                    {r.rating != null && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#FCD34D]">
                        <Star className="h-3 w-3 fill-current" />
                        {r.rating}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/85">
                      {r.title || r.comment || '—'}
                    </span>
                    <span className="text-[11px] text-white/85">{fmtDate(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ══ MODALS ══ */}

      {/* Tier change */}
      {dialog?.kind === 'tier' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-5">
            <h3 className="text-[16px] font-extrabold text-white/95">Change Seller Tier</h3>
            <p className="mt-1 text-[12px] text-white/85">
              Updates commission, listing limits and the moderation threshold immediately. The
              seller is notified.
            </p>
          </div>
          <div className="mb-4">
            <label className={MODAL_LABEL}>New Tier</label>
            <select
              value={tierChoice}
              onChange={(e) => setTierChoice(e.target.value)}
              className={cn(MODAL_INPUT, '[&>option]:bg-[#0F2419]')}
            >
              {SELLER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                  {t === profile.seller_tier ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-5">
            <label className={MODAL_LABEL}>Note (Optional)</label>
            <textarea
              value={tierNotes}
              onChange={(e) => setTierNotes(e.target.value)}
              rows={3}
              placeholder="Why this change? Kept in the tier history…"
              className={cn(MODAL_INPUT, 'resize-none')}
            />
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() => tierMutation.mutate()}
              disabled={busy || tierChoice === profile.seller_tier}
              className={MODAL_CONFIRM_LIME}
            >
              {tierMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Change {shopName} From {titleCase(profile.seller_tier)} To {titleCase(tierChoice)}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Restrict / Ban */}
      {dialog?.kind === 'restrict' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-6 text-center">
            <div
              className={cn(
                'mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl',
                dialog.type === 'banned' ? 'bg-[#B42318]/20' : 'bg-[#F59E0B]/[0.16]',
              )}
            >
              {dialog.type === 'banned' ? (
                <Ban className="h-7 w-7 text-[#FCA5A5]" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-[#FCD34D]" />
              )}
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-white">
              {dialog.type === 'banned' ? 'Ban Seller' : 'Restrict Seller'}
            </h3>
            <p className="text-sm text-white/85">
              {dialog.type === 'banned'
                ? 'This bans the seller from all seller features and pauses their active listings.'
                : 'This blocks new listings and pauses their active listings.'}
            </p>
          </div>
          <div className="mb-6">
            <label className={MODAL_LABEL}>Reason *</label>
            <textarea
              value={restrictionReason}
              onChange={(e) => setRestrictionReason(e.target.value)}
              className={cn(MODAL_INPUT, 'resize-none')}
              rows={4}
              placeholder="Enter a detailed reason — the seller sees it…"
              required
            />
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() =>
                restrictMutation.mutate({ status: dialog.type, reason: restrictionReason })
              }
              disabled={!restrictionReason.trim() || busy}
              className={MODAL_CONFIRM_RED}
            >
              {restrictMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : dialog.type === 'banned' ? (
                <Ban className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              Confirm
            </button>
          </div>
        </ModalShell>
      )}

      {/* Unrestrict confirm */}
      {dialog?.kind === 'unrestrict' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#A3E635]/[0.15]">
              <ShieldCheck className="h-7 w-7 text-[#A3E635]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-white">Remove Restriction?</h3>
            <p className="text-sm leading-relaxed text-white/85">
              <b className="font-semibold text-white">{shopName}</b> can create and publish
              listings again. Paused listings stay paused — the seller republishes them.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() => restrictMutation.mutate({ status: 'active' })}
              disabled={busy}
              className={MODAL_CONFIRM_LIME}
            >
              {restrictMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Remove Restriction
            </button>
          </div>
        </ModalShell>
      )}

      {/* Restriction history */}
      {dialog?.kind === 'history' && (
        <ModalShell onClose={() => setDialog(null)} wide>
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#A3E635]" />
              <h3 className="text-base font-extrabold text-white">Restriction History</h3>
            </div>
            <button
              onClick={() => setDialog(null)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-white/85" />
            </button>
          </div>
          {detail.restrictions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-white/85">No restriction history found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {detail.restrictions.map((r) => (
                <div
                  key={r.id}
                  className="rounded-[11px] border border-white/[0.08] bg-white/[0.04] p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {r.restriction_type === 'restricted' && (
                        <ShieldAlert className="h-3.5 w-3.5 text-[#FCD34D]" />
                      )}
                      {r.restriction_type === 'banned' && (
                        <Ban className="h-3.5 w-3.5 text-[#FCA5A5]" />
                      )}
                      {r.restriction_type === 'unrestricted' && (
                        <CheckCircle className="h-3.5 w-3.5 text-[#A3E635]" />
                      )}
                      <span className="text-sm font-bold text-white/90">
                        {titleCase(r.restriction_type)}
                      </span>
                    </div>
                    <span className="text-xs text-white/70">{fmtDate(r.created_at)}</span>
                  </div>
                  {r.reason && <p className="mb-2 text-xs text-white/85">{r.reason}</p>}
                  {r.admin && (
                    <p className="text-xs text-white/70">
                      By: {r.admin.username || r.admin.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* In-app message */}
      {dialog?.kind === 'message' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-4">
            <h3 className="text-[16px] font-extrabold text-white/95">Send In-App Message</h3>
            <p className="mt-1 text-[12px] text-white/85">
              Lands in their notifications instantly, linked to their seller status page.
            </p>
          </div>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Quick question about your recent listings…"
            className={cn(MODAL_INPUT, 'resize-none')}
          />
          <p className="mt-1 text-right text-[10.5px] tabular-nums text-white/70">
            {messageText.length}/500
          </p>
          <div className="mt-3 flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() => messageMutation.mutate()}
              disabled={busy || !messageText.trim()}
              className={MODAL_CONFIRM_LIME}
            >
              {messageMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Message
            </button>
          </div>
        </ModalShell>
      )}

      {/* Email */}
      {dialog?.kind === 'email' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-4">
            <h3 className="text-[16px] font-extrabold text-white/95">Send Email</h3>
            <p className="mt-1 text-[12px] text-white/85">
              Branded DropMarket email to {profile.email}. Replies reach the support inbox.
            </p>
          </div>
          <div className="mb-4">
            <label className={MODAL_LABEL}>Subject *</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              maxLength={150}
              placeholder="e.g. About your DropMarket shop…"
              className={MODAL_INPUT}
            />
          </div>
          <div className="mb-1">
            <label className={MODAL_LABEL}>Body *</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="Write the email body…"
              className={cn(MODAL_INPUT, 'resize-none')}
            />
          </div>
          <p className="mb-3 text-right text-[10.5px] tabular-nums text-white/70">
            {emailBody.length}/3000
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() => emailMutation.mutate()}
              disabled={busy || !emailSubject.trim() || !emailBody.trim()}
              className={MODAL_CONFIRM_LIME}
            >
              {emailMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Send Email
            </button>
          </div>
        </ModalShell>
      )}

      {/* Withdrawal approve confirm */}
      {dialog?.kind === 'withdrawal-approve' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#A3E635]/[0.15]">
              <CheckCircle className="h-7 w-7 text-[#A3E635]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-white">Approve Withdrawal?</h3>
            <p className="text-sm leading-relaxed text-white/85">
              Approves the{' '}
              <b className="font-semibold tabular-nums text-white">{money(dialog.amount)}</b>{' '}
              payout request — the seller is notified and ops sends the money.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() =>
                withdrawalMutation.mutate({ requestId: dialog.requestId, decision: 'approve' })
              }
              disabled={busy}
              className={MODAL_CONFIRM_LIME}
            >
              {withdrawalMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approve Withdrawal
            </button>
          </div>
        </ModalShell>
      )}

      {/* Withdrawal reject */}
      {dialog?.kind === 'withdrawal-reject' && (
        <ModalShell onClose={() => !busy && setDialog(null)}>
          <div className="mb-5 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#B42318]/20">
              <X className="h-7 w-7 text-[#FCA5A5]" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-white">Reject Withdrawal</h3>
            <p className="text-sm leading-relaxed text-white/85">
              Declines the{' '}
              <b className="font-semibold tabular-nums text-white">{money(dialog.amount)}</b>{' '}
              request and releases the hold — funds return to the seller&apos;s balance.
            </p>
          </div>
          <div className="mb-6">
            <label className={MODAL_LABEL}>Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={cn(MODAL_INPUT, 'resize-none')}
              rows={3}
              placeholder="The seller sees this reason…"
              required
            />
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setDialog(null)} disabled={busy} className={MODAL_CANCEL}>
              Cancel
            </button>
            <button
              onClick={() =>
                withdrawalMutation.mutate({
                  requestId: dialog.requestId,
                  decision: 'reject',
                  reason: rejectReason,
                })
              }
              disabled={busy || !rejectReason.trim()}
              className={MODAL_CONFIRM_RED}
            >
              {withdrawalMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Reject Withdrawal
            </button>
          </div>
        </ModalShell>
      )}
    </>
  )
}
