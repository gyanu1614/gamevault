'use client'

/**
 * Forest Ledger — /admin/moderation client.
 *
 * ONE compact forest frame (no kit PageHeader/StatCard, no stock shadcn
 * modal look, no separate hero):
 *
 *   - Gradient header band: title + one-line sub on the left, the three
 *     pill tabs (Pending / Awaiting Seller / History) on the right, and a
 *     slim strip of five clickable stat chips underneath — each chip jumps
 *     to the matching tab / history slice.
 *   - Toolbar row below: the History slice pills (history tab only) +
 *     right-aligned client-side search. Then the queue GROUPED BY SELLER.
 *   - Everything shares the frame's px-6 grid.
 *   - Dialogs are forest surfaces: forest-gradient header, glass listing
 *     context row (thumbnail + title + seller) so the admin sees what
 *     they're acting on, forest inputs, FOREST_CLASSES confirm buttons.
 *   - Data via react-query seeded with the server wrapper's initialData;
 *     mutations remove acted rows optimistically + invalidate. No
 *     full-page spinner after mount — per-row pending state only.
 */

import React, { useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import {
  getPendingListings,
  approveListing,
  rejectListing,
  requestListingChanges,
  getModerationStats,
  getModerationHistory,
} from '@/lib/actions/moderation'
import type {
  ModerationHistoryRow,
  ModerationHistorySlice,
  SellerModerationContext,
} from '@/lib/actions/moderation'
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  Loader2,
  Search,
  Package,
  RefreshCcw,
  AlertTriangle,
  ArrowRight,
  History,
  Inbox,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import {
  FOREST_BG,
  FOREST_CLASSES,
  FOREST_MOTION,
  forestStagger,
  forestStatusChip,
} from '../../_theme/forest'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'awaiting' | 'history'

interface SellerGroup {
  sellerId: string
  seller: any
  context: SellerModerationContext | null
  listings: any[]
}

interface QueueData {
  listings: any[]
  stats: any
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function titleCaseTier(tier: string | null | undefined): string {
  const t = (tier || 'unverified').replace(/[-_]/g, ' ')
  return t.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Relative label gated on the useNow() clock — `now` is null during SSR +
 * hydration, so both renders emit '' and the real label fills in after
 * mount (Date.now() in render caused a hydration mismatch → inert page).
 */
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

function isOlderThan24h(iso: string | null | undefined, now: number | null): boolean {
  if (!iso || now == null) return false
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return false
  return now - then > 24 * 60 * 60 * 1000
}

/** UTC-pinned so server and client format the identical string. */
function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Joined ${d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}`
}

/** Up to 3 short template_data key:value chips (long/object values skipped). */
function templateChips(td: unknown): { k: string; v: string }[] {
  if (!td || typeof td !== 'object' || Array.isArray(td)) return []
  const out: { k: string; v: string }[] = []
  for (const [k, v] of Object.entries(td as Record<string, unknown>)) {
    if (out.length >= 3) break
    if (v == null || typeof v === 'object') continue
    const s = String(v).trim()
    if (!s || s.length > 24) continue
    out.push({ k: k.replace(/[_-]/g, ' '), v: s })
  }
  return out
}

/** Preview path only when every URL segment actually exists. */
function previewHref(listing: any): string | null {
  if (listing?.game?.slug && listing?.category?.slug && listing?.slug) {
    return `/${listing.game.slug}/${listing.category.slug}/${listing.slug}`
  }
  return null
}

// ─── Shared class snippets ───────────────────────────────────────────────────

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3E635] focus-visible:ring-offset-0'

const GROUP_BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-bold'

const ROW_BTN_BASE = cn(
  'inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-bold',
  'transition-[transform,background-color,border-color,filter] duration-150 hover:-translate-y-px active:translate-y-0',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
  FOCUS_RING,
)

const GHOST_BTN = cn(
  'inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-4 py-2 text-[12px] font-bold text-white/70',
  'transition-[transform,border-color,color] duration-150 hover:-translate-y-px hover:border-[#A3E635]/50 hover:text-white',
  'disabled:opacity-50 disabled:hover:translate-y-0',
  FOCUS_RING,
)

const FIELD_CLASSES =
  'w-full resize-none rounded-[10px] border border-white/[0.12] bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/35 transition-colors hover:border-white/25 focus:border-[#A3E635] focus:outline-none'

const HISTORY_SLICES: { key: ModerationHistorySlice; label: string }[] = [
  { key: 'approved_today', label: 'Approved Today' },
  { key: 'rejected_today', label: 'Rejected Today' },
  { key: 'approved_all', label: 'All Approved' },
  { key: 'all', label: 'Everything' },
]

/** Header-band gradient (top-lit) shared by the frame + dialog headers. */
const BAND_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 42%), ' +
    FOREST_BG.listHeader,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3)',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ModerationPageClient({
  initialListings,
  initialStats,
  fetchFailed = false,
}: {
  initialListings: any[]
  initialStats: any
  /** True when the server wrapper's own fetch errored — show a real error state, not an empty queue. */
  fetchFailed?: boolean
}) {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [historySlice, setHistorySlice] = useState<ModerationHistorySlice>('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  /** Listing ids with an in-flight single action (disables that row). */
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  /** Seller id with an in-flight Approve All loop (disables the group). */
  const [bulkSellerId, setBulkSellerId] = useState<string | null>(null)

  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'changes' | null>(null)
  const [bulkGroup, setBulkGroup] = useState<SellerGroup | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [changeRequest, setChangeRequest] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')

  // ── Queue + stats (server-seeded) ──────────────────────────────────────────
  const queueQuery = useQuery<QueueData>({
    queryKey: ['moderation-queue'],
    queryFn: async () => {
      const [listingsResult, statsResult] = await Promise.all([
        getPendingListings(),
        getModerationStats(),
      ])
      if (!listingsResult.success) {
        throw new Error(listingsResult.error || 'Failed to load the moderation queue')
      }
      return {
        listings: listingsResult.listings ?? [],
        stats: statsResult.success ? statsResult.stats ?? null : null,
      }
    },
    // When the server fetch failed, do NOT seed — let the client fetch run
    // and surface a real error state if it fails again.
    initialData: fetchFailed
      ? undefined
      : { listings: initialListings, stats: initialStats },
    staleTime: fetchFailed ? 0 : 30_000,
    retry: 1,
  })

  const listings = useMemo(
    () => queueQuery.data?.listings ?? [],
    [queueQuery.data],
  )
  const stats = queueQuery.data?.stats ?? null

  // ── History ────────────────────────────────────────────────────────────────
  const historyQuery = useQuery({
    queryKey: ['moderation-history', historySlice, historyPage],
    queryFn: async () => {
      const result = await getModerationHistory({ slice: historySlice, page: historyPage })
      if (!result.success) {
        throw new Error(result.error || 'Failed to load moderation history')
      }
      return result
    },
    enabled: tab === 'history',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  // ── Cache helpers ──────────────────────────────────────────────────────────
  const removeFromQueue = (ids: string[]) => {
    queryClient.setQueryData<QueueData>(['moderation-queue'], (old) =>
      old
        ? { ...old, listings: old.listings.filter((l: any) => !ids.includes(l.id)) }
        : old,
    )
  }

  const markChangesRequested = (id: string, notes: string) => {
    queryClient.setQueryData<QueueData>(['moderation-queue'], (old) =>
      old
        ? {
            ...old,
            listings: old.listings.map((l: any) =>
              l.id === id
                ? {
                    ...l,
                    status: 'changes_requested',
                    moderation_notes: notes,
                    changes_requested_at: new Date().toISOString(),
                  }
                : l,
            ),
          }
        : old,
    )
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['moderation-queue'] })
    queryClient.invalidateQueries({ queryKey: ['moderation-history'] })
  }

  const markPending = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const result = await approveListing(id, notes)
      if (!result.success) throw new Error(result.error || 'Failed to approve listing')
      return result
    },
    onMutate: ({ id }) => markPending(id, true),
    onSuccess: (result, { id }) => {
      const acted = listings.find((l: any) => l.id === id)
      const removed = [id]
      if ((result.drainedCount ?? 0) > 0 && acted?.seller_id) {
        // The drain released the seller's whole remaining queue.
        for (const l of listings) {
          if (l.seller_id === acted.seller_id && l.status === 'pending_approval') {
            removed.push(l.id)
          }
        }
      }
      removeFromQueue(removed)
      toast.success(
        (result.drainedCount ?? 0) > 0
          ? `Approved — ${result.drainedCount} more released automatically`
          : 'Listing approved',
      )
      setDialog(null)
      setApprovalNotes('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: (_result, _error, { id }) => {
      markPending(id, false)
      invalidateAll()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await rejectListing(id, reason)
      if (!result.success) throw new Error(result.error || 'Failed to reject listing')
      return result
    },
    onMutate: ({ id }) => markPending(id, true),
    onSuccess: (_result, { id }) => {
      removeFromQueue([id])
      toast.success('Listing rejected')
      setDialog(null)
      setRejectReason('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: (_result, _error, { id }) => {
      markPending(id, false)
      invalidateAll()
    },
  })

  const changesMutation = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: string }) => {
      const result = await requestListingChanges(id, changes)
      if (!result.success) throw new Error(result.error || 'Failed to send change request')
      return result
    },
    onMutate: ({ id }) => markPending(id, true),
    onSuccess: (_result, { id, changes }) => {
      markChangesRequested(id, changes)
      toast.success('Change request sent to seller')
      setDialog(null)
      setChangeRequest('')
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: (_result, _error, { id }) => {
      markPending(id, false)
      invalidateAll()
    },
  })

  const actionBusy =
    approveMutation.isPending || rejectMutation.isPending || changesMutation.isPending

  // ── Bulk approve (sequential; stop on first error) ─────────────────────────
  const handleBulkApprove = async (group: SellerGroup) => {
    setBulkGroup(null)
    setBulkSellerId(group.sellerId)
    const done = new Set<string>()
    let approvedCount = 0
    let failed = false

    for (const listing of group.listings) {
      if (done.has(listing.id)) continue
      const result = await approveListing(listing.id)
      if (!result.success) {
        toast.error(result.error || `Failed to approve "${listing.title}"`)
        failed = true
        break
      }
      approvedCount++
      done.add(listing.id)
      removeFromQueue([listing.id])
      if ((result.drainedCount ?? 0) > 0) {
        // The threshold drain released the rest of this seller's queue —
        // nothing left to loop over.
        approvedCount += result.drainedCount ?? 0
        for (const rest of group.listings) done.add(rest.id)
        removeFromQueue(group.listings.map((l: any) => l.id))
        break
      }
    }

    if (!failed && approvedCount > 0) {
      const name = group.seller?.shop_name || group.seller?.username || 'seller'
      toast.success(`Approved ${approvedCount} listings from ${name}`)
    }
    setBulkSellerId(null)
    invalidateAll()
  }

  // ── Derived queue views ────────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase()
  const matchesSearch = (listing: any) =>
    !q ||
    (listing.title || '').toLowerCase().includes(q) ||
    (listing.seller?.username || '').toLowerCase().includes(q) ||
    (listing.seller?.shop_name || '').toLowerCase().includes(q) ||
    (listing.game?.name || '').toLowerCase().includes(q)

  const pendingListings = useMemo(
    () => listings.filter((l: any) => l.status !== 'changes_requested'),
    [listings],
  )
  const awaitingListings = useMemo(
    () => listings.filter((l: any) => l.status === 'changes_requested'),
    [listings],
  )

  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const groups = new Map<string, SellerGroup>()
    for (const listing of pendingListings) {
      if (!matchesSearch(listing)) continue
      const sid = listing.seller_id || listing.seller?.id || 'unknown'
      let group = groups.get(sid)
      if (!group) {
        group = {
          sellerId: sid,
          seller: listing.seller ?? null,
          context: (listing.sellerContext as SellerModerationContext) ?? null,
          listings: [],
        }
        groups.set(sid, group)
      }
      group.listings.push(listing)
    }
    return Array.from(groups.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingListings, q])

  const filteredAwaiting = useMemo(
    () => awaitingListings.filter(matchesSearch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awaitingListings, q],
  )

  const historyRows: ModerationHistoryRow[] = useMemo(() => {
    const rows = historyQuery.data?.rows ?? []
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.seller || '').toLowerCase().includes(q) ||
        (r.game?.name || '').toLowerCase().includes(q),
    )
  }, [historyQuery.data, q])

  const historyTotal = historyQuery.data?.total ?? 0
  const historyPageSize = historyQuery.data?.pageSize ?? 25
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize))

  const goToHistory = (slice: ModerationHistorySlice) => {
    setHistorySlice(slice)
    setHistoryPage(1)
    setTab('history')
  }

  const queueErrored = queueQuery.isError
  const queueLoading = queueQuery.isPending

  // ── Stat summary chips (slim strip in the header band) ─────────────────────
  const statChips: {
    label: string
    value: React.ReactNode
    onClick: () => void
  }[] = [
    { label: 'Pending', value: stats?.pending ?? '—', onClick: () => setTab('pending') },
    { label: 'Awaiting', value: stats?.awaiting_seller ?? '—', onClick: () => setTab('awaiting') },
    { label: 'Approved Today', value: stats?.approved_today ?? '—', onClick: () => goToHistory('approved_today') },
    { label: 'Rejected Today', value: stats?.rejected_today ?? '—', onClick: () => goToHistory('rejected_today') },
    { label: 'Total Approved', value: stats?.total_approved ?? '—', onClick: () => goToHistory('approved_all') },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mx-auto max-w-7xl">
        {/* ── The single forest frame ── */}
        <div
          className="overflow-hidden rounded-2xl border border-white/[0.09]"
          style={{ background: FOREST_BG.canvas }}
        >
          {/* Header band — title + tabs, stat strip beneath */}
          <div className="px-6 py-5" style={BAND_STYLE}>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="min-w-0">
                <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-white">
                  Moderation Queue
                </h1>
                <p className="mt-0.5 text-[12px] text-white/50">
                  Review pending listings — approve, bounce back, or reject
                </p>
              </div>

              <div className="ml-auto max-w-full overflow-x-auto pb-0.5">
                <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: 'pending' as Tab, label: 'Pending', count: pendingListings.length },
                    { key: 'awaiting' as Tab, label: 'Awaiting Seller', count: awaitingListings.length },
                    { key: 'history' as Tab, label: 'History', count: undefined },
                  ] as { key: Tab; label: string; count: number | undefined }[]
                ).map((t) => {
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-[7px] text-[11.5px] font-bold',
                        'transition-[transform,background-color,border-color,color,box-shadow] duration-150 hover:-translate-y-px active:translate-y-0',
                        FOCUS_RING,
                        active
                          ? 'bg-[#A3E635] text-[#0F3320] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.12),0_6px_14px_-6px_rgba(163,230,53,0.45)]'
                          : 'border border-white/[0.12] text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-[#A3E635]/50 hover:text-white',
                      )}
                    >
                      {t.label}
                      {t.count !== undefined && (
                        <span
                          className={cn(
                            'grid min-w-[20px] place-items-center rounded-full px-1.5 py-px text-[10px] font-black tabular-nums',
                            active
                              ? 'bg-[#0F3320]/15 text-[#0F3320]'
                              : 'bg-white/[0.1] text-white/55',
                          )}
                        >
                          {t.count}
                        </span>
                      )}
                    </button>
                  )
                })}
                </div>
              </div>
            </div>

            {/* Slim stat strip — clickable summary chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {statChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onClick}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[12px] font-semibold text-white/55',
                    'transition-colors duration-150 hover:border-[#A3E635]/50 hover:bg-white/[0.08] hover:text-white',
                    FOCUS_RING,
                  )}
                >
                  {chip.label}
                  <span className="font-extrabold tabular-nums text-white/90">{chip.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar — history slice pills + client-side search */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] px-6 py-3">
            {tab === 'history' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {HISTORY_SLICES.map((s) => {
                  const active = historySlice === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setHistorySlice(s.key)
                        setHistoryPage(1)
                      }}
                      className={cn(
                        'cursor-pointer whitespace-nowrap rounded-full px-3 py-[6px] text-[11px] font-bold',
                        'transition-[transform,background-color,border-color,color] duration-150 hover:-translate-y-px active:translate-y-0',
                        FOCUS_RING,
                        active
                          ? 'bg-[#A3E635] text-[#0F3320] shadow-[0_6px_14px_-6px_rgba(163,230,53,0.45)]'
                          : 'border border-white/[0.12] text-white/55 hover:border-[#A3E635]/50 hover:text-white',
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                placeholder="Search title, seller, game…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'h-9 w-full rounded-[10px] border border-white/[0.12] bg-white/[0.05] pl-9 pr-8 text-[13px] text-white placeholder:text-white/35',
                  'transition-colors hover:border-white/25 focus:border-[#A3E635] focus:outline-none focus:ring-1 focus:ring-[#A3E635]/40',
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white',
                    FOCUS_RING,
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Queue tabs ── */}
          {(tab === 'pending' || tab === 'awaiting') && (
            <div className="px-6 pb-5 pt-3">
              {queueErrored ? (
                <ErrorPanel
                  message={(queueQuery.error as Error)?.message}
                  onRetry={() => queueQuery.refetch()}
                  retrying={queueQuery.isFetching}
                />
              ) : queueLoading ? (
                <LoadingRow label="Loading the moderation queue…" />
              ) : tab === 'pending' ? (
                sellerGroups.length === 0 ? (
                  <EmptyPanel
                    title={q ? 'No Matches' : 'All Caught Up'}
                    sub={
                      q
                        ? 'No pending listings match your search'
                        : 'Every submitted listing has been reviewed'
                    }
                    action={{
                      label: 'View History',
                      icon: History,
                      onClick: () => goToHistory('all'),
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {sellerGroups.map((group, groupIndex) => (
                      <SellerGroupCard
                        key={group.sellerId}
                        group={group}
                        index={groupIndex}
                        pendingIds={pendingIds}
                        bulkBusy={bulkSellerId === group.sellerId}
                        anyBulkBusy={bulkSellerId !== null}
                        onApprove={(listing) => {
                          setSelectedListing(listing)
                          setApprovalNotes('')
                          setDialog('approve')
                        }}
                        onReject={(listing) => {
                          setSelectedListing(listing)
                          setRejectReason('')
                          setDialog('reject')
                        }}
                        onChanges={(listing) => {
                          setSelectedListing(listing)
                          setChangeRequest('')
                          setDialog('changes')
                        }}
                        onBulkApprove={() => setBulkGroup(group)}
                      />
                    ))}
                  </div>
                )
              ) : filteredAwaiting.length === 0 ? (
                <EmptyPanel
                  title={q ? 'No Matches' : 'Nothing Awaiting Sellers'}
                  sub={
                    q
                      ? 'No awaiting listings match your search'
                      : 'No listings are waiting on seller changes'
                  }
                  action={{
                    label: 'View History',
                    icon: History,
                    onClick: () => goToHistory('all'),
                  }}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredAwaiting.map((listing: any, index: number) => (
                    <AwaitingRow
                      key={listing.id}
                      listing={listing}
                      index={index}
                      busy={pendingIds.has(listing.id)}
                      onUpdateRequest={() => {
                        setSelectedListing(listing)
                        setChangeRequest(listing.moderation_notes || '')
                        setDialog('changes')
                      }}
                      onReject={() => {
                        setSelectedListing(listing)
                        setRejectReason('')
                        setDialog('reject')
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── History tab ── */}
          {tab === 'history' && (
            <div className="pb-1">
              <div className="px-6 pb-5 pt-3">
                {historyQuery.isError ? (
                  <ErrorPanel
                    message={(historyQuery.error as Error)?.message}
                    onRetry={() => historyQuery.refetch()}
                    retrying={historyQuery.isFetching}
                  />
                ) : historyQuery.isPending ? (
                  <LoadingRow label="Loading decision history…" />
                ) : historyRows.length === 0 ? (
                  <EmptyPanel
                    icon={Inbox}
                    title="No Decisions Here"
                    sub={
                      q
                        ? 'No history rows match your search'
                        : 'Nothing recorded for this filter yet'
                    }
                    action={{
                      label: 'View Queue',
                      icon: ArrowRight,
                      onClick: () => setTab('pending'),
                    }}
                  />
                ) : (
                  <div
                    className={cn(
                      'flex flex-col gap-2',
                      historyQuery.isFetching && 'opacity-60 transition-opacity',
                    )}
                  >
                    {/* Column headers (desktop) */}
                    <div className="hidden items-center gap-3.5 px-3.5 pb-1 md:flex">
                      <span className="w-[42px] shrink-0" />
                      <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Listing
                      </span>
                      <span className="w-[130px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Seller
                      </span>
                      <span className="w-[170px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Decided
                      </span>
                      <span className="w-[148px] shrink-0 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        Decision
                      </span>
                    </div>
                    {historyRows.map((row, index) => (
                      <HistoryRowCard key={`${row.id}-${row.decision}`} row={row} index={index} />
                    ))}
                  </div>
                )}
              </div>
              {!historyQuery.isError && !historyQuery.isPending && (
                <PaginationControls
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  hasNextPage={historyPage < historyTotalPages}
                  hasPrevPage={historyPage > 1}
                  onPageChange={setHistoryPage}
                  totalItems={historyTotal}
                  itemsPerPage={historyPageSize}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Approve dialog ── */}
        <ForestDialog
          open={dialog === 'approve' && !!selectedListing}
          onClose={() => {
            setDialog(null)
            setApprovalNotes('')
          }}
          title="Approve Listing"
          description="This listing goes live for buyers immediately."
          listing={selectedListing}
        >
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.06em] text-white/50">
              Notes (Optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any internal notes..."
              className={FIELD_CLASSES}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setDialog(null)
                setApprovalNotes('')
              }}
              className={cn(FOREST_CLASSES.btnChanges, FOCUS_RING, 'disabled:opacity-50')}
              disabled={actionBusy}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedListing &&
                approveMutation.mutate({
                  id: selectedListing.id,
                  notes: approvalNotes || undefined,
                })
              }
              disabled={actionBusy}
              className={cn(
                FOREST_CLASSES.btnApprove,
                FOCUS_RING,
                'inline-flex items-center justify-center gap-2 disabled:opacity-50',
              )}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Listing
                </>
              )}
            </button>
          </DialogFooter>
        </ForestDialog>

        {/* ── Reject dialog ── */}
        <ForestDialog
          open={dialog === 'reject' && !!selectedListing}
          onClose={() => {
            setDialog(null)
            setRejectReason('')
          }}
          title="Reject Listing"
          description="The seller is notified with your reason — the listing will not go live."
          listing={selectedListing}
        >
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.06em] text-white/50">
              Rejection Reason *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this listing is being rejected..."
              className={FIELD_CLASSES}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setDialog(null)
                setRejectReason('')
              }}
              className={cn(FOREST_CLASSES.btnChanges, FOCUS_RING, 'disabled:opacity-50')}
              disabled={actionBusy}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedListing &&
                rejectMutation.mutate({ id: selectedListing.id, reason: rejectReason })
              }
              disabled={actionBusy || !rejectReason.trim()}
              className={cn(
                FOREST_CLASSES.btnReject,
                FOCUS_RING,
                'inline-flex items-center justify-center gap-2 disabled:opacity-50',
              )}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Reject Listing
                </>
              )}
            </button>
          </DialogFooter>
        </ForestDialog>

        {/* ── Request-changes dialog ── */}
        <ForestDialog
          open={dialog === 'changes' && !!selectedListing}
          onClose={() => {
            setDialog(null)
            setChangeRequest('')
          }}
          title={
            selectedListing?.status === 'changes_requested' ? 'Update Request' : 'Request Changes'
          }
          description="The listing moves to Awaiting Seller — they see your notes and resubmit for review."
          listing={selectedListing}
        >
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.06em] text-white/50">
              Required Changes *
            </label>
            <textarea
              value={changeRequest}
              onChange={(e) => setChangeRequest(e.target.value)}
              placeholder="Describe what needs to be changed..."
              className={FIELD_CLASSES}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setDialog(null)
                setChangeRequest('')
              }}
              className={cn(FOREST_CLASSES.btnChanges, FOCUS_RING, 'disabled:opacity-50')}
              disabled={actionBusy}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedListing &&
                changesMutation.mutate({ id: selectedListing.id, changes: changeRequest })
              }
              disabled={actionBusy || !changeRequest.trim()}
              className={cn(
                FOREST_CLASSES.btnApprove,
                FOCUS_RING,
                'inline-flex items-center justify-center gap-2 disabled:opacity-50',
              )}
            >
              {changesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Send Request
                </>
              )}
            </button>
          </DialogFooter>
        </ForestDialog>

        {/* ── Bulk-approve confirm dialog ── */}
        <ForestDialog
          open={!!bulkGroup}
          onClose={() => setBulkGroup(null)}
          title="Approve All Listings"
          description={`All ${bulkGroup?.listings.length ?? 0} pending listing${
            (bulkGroup?.listings.length ?? 0) === 1 ? '' : 's'
          } from this seller go live for buyers immediately.`}
          sellerHeader={bulkGroup?.seller}
          sellerListingCount={bulkGroup?.listings.length ?? 0}
        >
          <DialogFooter className="gap-2">
            <button
              onClick={() => setBulkGroup(null)}
              className={cn(FOREST_CLASSES.btnChanges, FOCUS_RING)}
            >
              Cancel
            </button>
            <button
              onClick={() => bulkGroup && handleBulkApprove(bulkGroup)}
              className={cn(
                FOREST_CLASSES.btnApprove,
                FOCUS_RING,
                'inline-flex items-center justify-center gap-2',
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve All ({bulkGroup?.listings.length})
            </button>
          </DialogFooter>
        </ForestDialog>
      </div>
    </div>
  )
}

// ─── Forest dialog shell ─────────────────────────────────────────────────────

/**
 * Forest surface modal: forest-gradient header band (title + sub), a glass
 * context row showing WHAT the admin is acting on (listing thumbnail +
 * title + seller — or the seller themselves for bulk approve), then the
 * caller's body + footer on the deep-forest canvas.
 */
function ForestDialog({
  open,
  onClose,
  title,
  description,
  listing,
  sellerHeader,
  sellerListingCount,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  listing?: any
  /** Bulk mode: show the seller (avatar + name + pending count) instead of a listing. */
  sellerHeader?: any
  sellerListingCount?: number
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-2xl border-white/[0.12] bg-[#0F2419] p-0 text-white shadow-2xl sm:rounded-2xl"
        style={{ background: FOREST_BG.canvas }}
      >
        {/* Forest header band */}
        <div className="px-5 pb-4 pt-5 pr-12" style={BAND_STYLE}>
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-[16px] font-extrabold tracking-[-0.01em] text-white">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12px] leading-relaxed text-white/55">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          {/* Context row — what is being acted on */}
          {listing && (
            <div className={cn(FOREST_CLASSES.inset, 'flex items-center gap-3 px-3 py-2.5')}>
              <ListingThumb listing={listing} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white/95">{listing.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-white/50">
                  <span className="font-semibold tabular-nums text-white/75">
                    ${Number(listing.price ?? 0).toFixed(2)}
                  </span>
                  {listing.game?.name ? ` · ${listing.game.name}` : ''}
                  {listing.category?.name ? ` • ${listing.category.name}` : ''}
                  {' · '}
                  {listing.seller?.shop_name || listing.seller?.username || 'Unknown seller'}
                </p>
              </div>
            </div>
          )}
          {sellerHeader !== undefined && (
            <div className={cn(FOREST_CLASSES.inset, 'flex items-center gap-3 px-3 py-2.5')}>
              {sellerHeader?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sellerHeader.avatar_url}
                  alt={sellerHeader?.shop_name || sellerHeader?.username || 'Seller'}
                  className="h-[42px] w-[42px] shrink-0 rounded-[10px] object-cover ring-1 ring-white/10"
                />
              ) : (
                <div
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-[#A3E635]"
                  style={{ background: FOREST_BG.storeTile }}
                >
                  {((sellerHeader?.shop_name || sellerHeader?.username || 'S').trim()[0] || 'S').toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white/95">
                  {sellerHeader?.shop_name || sellerHeader?.username || 'Unknown Seller'}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-white/50">
                  {sellerListingCount} pending listing{sellerListingCount === 1 ? '' : 's'} ·{' '}
                  {titleCaseTier(sellerHeader?.seller_tier)} Seller
                </p>
              </div>
            </div>
          )}

          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function ErrorPanel({
  message,
  onRetry,
  retrying,
}: {
  message?: string
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <div
      className={cn(
        FOREST_CLASSES.inset,
        'flex flex-col items-center px-6 py-10 text-center',
        FOREST_MOTION.fadeIn,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#F59E0B]/[0.14] ring-1 ring-[#F59E0B]/30">
        <AlertTriangle className="h-6 w-6 text-[#FCD34D]" />
      </div>
      <p className="mt-3 text-[15px] font-extrabold text-white/95">Couldn&apos;t Load The Queue</p>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] text-white/50">
        {message || 'Something went wrong fetching moderation data.'}
      </p>
      <button type="button" onClick={onRetry} disabled={retrying} className={cn(GHOST_BTN, 'mt-4')}>
        {retrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5" />
        )}
        Retry
      </button>
    </div>
  )
}

function EmptyPanel({
  icon: Icon = CheckCircle2,
  title,
  sub,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  sub: string
  action?: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }
}) {
  const ActionIcon = action?.icon
  return (
    <div
      className={cn(
        FOREST_CLASSES.inset,
        'flex flex-col items-center px-6 py-10 text-center',
        FOREST_MOTION.fadeIn,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#A3E635]/[0.12] ring-1 ring-[#A3E635]/25">
        <Icon className="h-6 w-6 text-[#A3E635]" />
      </div>
      <p className="mt-3 text-[15px] font-extrabold text-white/95">{title}</p>
      <p className="mt-1 text-[12.5px] text-white/50">{sub}</p>
      {action && (
        <button type="button" onClick={action.onClick} className={cn(GHOST_BTN, 'mt-4')}>
          {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
          {action.label}
        </button>
      )}
    </div>
  )
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#A3E635] border-r-transparent" />
      <p className="mt-4 text-[13px] text-white/60">{label}</p>
    </div>
  )
}

// ─── Seller group ────────────────────────────────────────────────────────────

function SellerGroupCard({
  group,
  index,
  pendingIds,
  bulkBusy,
  anyBulkBusy,
  onApprove,
  onReject,
  onChanges,
  onBulkApprove,
}: {
  group: SellerGroup
  index: number
  pendingIds: Set<string>
  bulkBusy: boolean
  anyBulkBusy: boolean
  onApprove: (listing: any) => void
  onReject: (listing: any) => void
  onChanges: (listing: any) => void
  onBulkApprove: () => void
}) {
  const { seller, context } = group
  const name = seller?.shop_name || seller?.username || 'Unknown Seller'
  const initial = (name.trim()[0] || 'S').toUpperCase()
  const joined = joinedLabel(seller?.created_at)

  const willCross =
    !!context && context.approvedCount + context.pendingCount >= context.threshold

  return (
    <div
      className={cn(
        'rounded-[14px] border border-white/[0.09] bg-white/[0.05] backdrop-blur-sm',
        'transition-[border-color,box-shadow] duration-150 hover:border-white/[0.14] hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]',
        FOREST_MOTION.fadeUp,
      )}
      style={forestStagger(Math.min(index, 10), 45)}
    >
      {/* Group header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.08] px-3.5 py-2.5">
        {seller?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={seller.avatar_url}
            alt={name}
            className="h-9 w-9 shrink-0 rounded-[10px] object-cover ring-1 ring-white/10"
          />
        ) : (
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-black text-[#A3E635]"
            style={{ background: FOREST_BG.storeTile }}
          >
            {initial}
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold text-white/95">{name}</p>
          {seller?.shop_name && seller?.username && (
            <p className="truncate text-[11px] text-white/40">@{seller.username}</p>
          )}
        </div>

        <span className={cn(GROUP_BADGE, 'bg-white/[0.08] text-white/70')}>
          {titleCaseTier(seller?.seller_tier)}
        </span>

        {context && (
          <span
            className={cn(
              GROUP_BADGE,
              willCross
                ? 'bg-[#A3E635]/[0.15] text-[#D9F99D]'
                : 'bg-white/[0.08] text-white/55',
            )}
            title={`${context.approvedCount} of ${context.threshold} pre-moderation listings already approved · ${context.pendingCount} pending`}
          >
            {context.approvedCount}/{context.threshold} reviewed
          </span>
        )}

        {context?.storePaused && (
          <span className={cn(GROUP_BADGE, 'bg-[#F59E0B]/[0.16] text-[#FCD34D]')}>
            Store Paused
          </span>
        )}
        {seller?.seller_status === 'restricted' && (
          <span className={cn(GROUP_BADGE, 'bg-[#B42318]/20 text-[#FCA5A5]')}>Restricted</span>
        )}
        {seller?.is_test && (
          <span className={cn(GROUP_BADGE, 'bg-white/[0.1] text-white/55')}>Test</span>
        )}

        {joined && <span className="text-[11px] text-white/35">{joined}</span>}

        <button
          type="button"
          onClick={onBulkApprove}
          disabled={anyBulkBusy}
          className={cn(
            'ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] bg-[#A3E635] px-3.5 py-2 text-[12px] font-bold text-[#0F3320] shadow-[0_8px_20px_-8px_rgba(163,230,53,0.5)]',
            'transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-105 active:translate-y-0',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
            FOCUS_RING,
          )}
        >
          {bulkBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve All ({group.listings.length})
        </button>
      </div>

      {/* Listing rows */}
      <div className="flex flex-col gap-1.5 p-2">
        {group.listings.map((listing: any) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            busy={pendingIds.has(listing.id) || bulkBusy}
            onApprove={() => onApprove(listing)}
            onReject={() => onReject(listing)}
            onChanges={() => onChanges(listing)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Listing row (pending) ───────────────────────────────────────────────────

function ListingThumb({ listing }: { listing: any }) {
  return (
    <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[10px] bg-white/[0.06] ring-1 ring-white/10">
      {listing.images?.[0] ? (
        <Image src={listing.images[0]} alt={listing.title || 'Listing'} fill className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="h-5 w-5 text-white/25" />
        </div>
      )}
    </div>
  )
}

function ListingRow({
  listing,
  busy,
  onApprove,
  onReject,
  onChanges,
}: {
  listing: any
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onChanges: () => void
}) {
  const now = useNow()
  const chips = templateChips(listing.template_data)
  const stale = isOlderThan24h(listing.created_at, now)
  const resubmitted =
    listing.status === 'pending_approval' && !!(listing.moderation_notes || '').trim()
  const preview = previewHref(listing)

  return (
    <div
      className={cn(
        FOREST_CLASSES.inset,
        'flex flex-wrap items-center gap-3 px-2.5 py-2',
        'transition-[background-color,border-color] duration-150 hover:border-white/[0.14] hover:bg-white/[0.06]',
      )}
    >
      <ListingThumb listing={listing} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13.5px] font-bold text-white/95">{listing.title}</p>
          {resubmitted && (
            <span
              className={cn(GROUP_BADGE, 'bg-white/[0.1] text-white/60')}
              title={`Previous request: ${listing.moderation_notes}`}
            >
              Resubmitted
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-white/50">
          <span className="font-semibold tabular-nums text-white/85">
            ${Number(listing.price ?? 0).toFixed(2)}
          </span>
          {listing.quantity != null && Number(listing.quantity) > 1 && (
            <span className="tabular-nums">×{listing.quantity}</span>
          )}
          <span className="truncate">
            {listing.game?.name}
            {listing.category?.name ? ` • ${listing.category.name}` : ''}
          </span>
          <span className={cn(stale && 'font-semibold text-[#FCD34D]')}>
            {relativeTime(listing.created_at, now)}
          </span>
          {chips.map((chip) => (
            <span
              key={chip.k}
              className="rounded-md bg-white/[0.08] px-1.5 py-[1.5px] text-[10px] font-bold capitalize text-white/60"
            >
              {chip.k}: {chip.v}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className={cn(
            ROW_BTN_BASE,
            'bg-[#A3E635] text-[#0F3320] shadow-[0_8px_20px_-8px_rgba(163,230,53,0.5)] hover:brightness-105',
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve
        </button>
        <button
          type="button"
          onClick={onChanges}
          disabled={busy}
          className={cn(ROW_BTN_BASE, 'bg-white/[0.12] text-white hover:bg-white/[0.18]')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Changes
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className={cn(
            ROW_BTN_BASE,
            'border border-[#FCA5A5]/35 bg-transparent text-[#FCA5A5] hover:bg-[#FCA5A5]/10',
          )}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </button>
        {preview && (
          <Link
            href={preview}
            target="_blank"
            className={cn(
              ROW_BTN_BASE,
              'border border-white/[0.12] bg-transparent text-white/60 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Awaiting-seller row ─────────────────────────────────────────────────────

function AwaitingRow({
  listing,
  index,
  busy,
  onUpdateRequest,
  onReject,
}: {
  listing: any
  index: number
  busy: boolean
  onUpdateRequest: () => void
  onReject: () => void
}) {
  const now = useNow()
  const requestedAt = listing.changes_requested_at || listing.updated_at

  return (
    <div
      className={cn(
        'rounded-[14px] border border-white/[0.09] bg-white/[0.05] px-3.5 py-2.5 backdrop-blur-sm',
        'transition-[border-color,box-shadow] duration-150 hover:border-white/[0.14] hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]',
        FOREST_MOTION.fadeUp,
      )}
      style={forestStagger(Math.min(index, 10), 45)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13.5px] font-bold text-white/95">{listing.title}</p>
            <span className={cn(GROUP_BADGE, 'bg-[#F59E0B]/[0.16] text-[#FCD34D]')}>
              Awaiting Seller{now != null ? ` · ${relativeTime(requestedAt, now)}` : ''}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-white/50">
            <span className="font-semibold tabular-nums text-white/85">
              ${Number(listing.price ?? 0).toFixed(2)}
            </span>
            <span className="truncate">
              {listing.seller?.shop_name || listing.seller?.username || 'Unknown'}
            </span>
            <span className="truncate">
              {listing.game?.name}
              {listing.category?.name ? ` • ${listing.category.name}` : ''}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onUpdateRequest}
            disabled={busy}
            className={cn(ROW_BTN_BASE, 'bg-white/[0.12] text-white hover:bg-white/[0.18]')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Update Request
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className={cn(
              ROW_BTN_BASE,
              'border border-[#FCA5A5]/35 bg-transparent text-[#FCA5A5] hover:bg-[#FCA5A5]/10',
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject
          </button>
        </div>
      </div>
      {listing.moderation_notes && (
        <div
          className={cn(
            FOREST_CLASSES.inset,
            'mt-2.5 border-[#F59E0B]/25 bg-[#F59E0B]/[0.08] px-3 py-2 text-[12px] text-white/70',
          )}
        >
          <span className="font-bold text-[#FCD34D]">Requested: </span>
          {listing.moderation_notes}
        </div>
      )}
    </div>
  )
}

// ─── History row ─────────────────────────────────────────────────────────────

function historyChip(decision: ModerationHistoryRow['decision']) {
  if (decision === 'changes_requested') {
    // info_requested carries the amber "Changes Requested" chip.
    return forestStatusChip('info_requested')
  }
  return forestStatusChip(decision)
}

function HistoryRowCard({ row, index }: { row: ModerationHistoryRow; index: number }) {
  const now = useNow()
  const chip = historyChip(row.decision)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3.5 rounded-[14px] border border-white/[0.09] bg-white/[0.05] px-3.5 py-2.5 backdrop-blur-sm',
        'transition-[transform,box-shadow,background-color,border-color] duration-150 hover:-translate-y-[1px]',
        'hover:border-white/[0.14] hover:bg-white/[0.08]',
        'hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]',
        FOREST_MOTION.fadeUp,
      )}
      style={forestStagger(Math.min(index, 10), 45)}
    >
      <ListingThumb listing={row} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-white/95">{row.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-white/50">
          {row.price != null && (
            <span className="font-semibold tabular-nums text-white/85">
              ${Number(row.price).toFixed(2)}
            </span>
          )}
          <span className="truncate">
            {row.game?.name}
            {row.category?.name ? ` • ${row.category.name}` : ''}
          </span>
          {row.reason && (
            <span className="max-w-[360px] truncate italic text-white/40" title={row.reason}>
              “{row.reason}”
            </span>
          )}
        </div>
      </div>

      <div className="hidden w-[130px] shrink-0 md:block">
        <p className="truncate text-[12.5px] font-semibold text-white/75">{row.seller || '—'}</p>
      </div>

      <div className="hidden w-[170px] shrink-0 md:block">
        <p className="truncate text-[11.5px] text-white/50">
          by <span className="font-semibold text-white/75">{row.decidedBy || 'Unknown'}</span>
          {row.decidedAt && now != null ? ` · ${relativeTime(row.decidedAt, now)}` : ''}
        </p>
      </div>

      <div className="ml-auto flex w-auto shrink-0 justify-end md:ml-0 md:w-[148px]">
        <span className={chip.onDark}>{chip.label}</span>
      </div>
    </div>
  )
}
