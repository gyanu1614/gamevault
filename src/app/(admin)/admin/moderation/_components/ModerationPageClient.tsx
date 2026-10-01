'use client'

/**
 * /admin/moderation client.
 *
 *   - Page header, then five clickable numbers (each jumps to its tab /
 *     history slice), then the Pending / Awaiting Seller / History tabs.
 *   - Toolbar: history slice chips (history tab only) + client-side search.
 *   - Pending queue GROUPED BY SELLER; Awaiting Seller as cards with the
 *     request; History as one panel of rows + pagination.
 *   - Dialogs show WHAT the admin is acting on (thumbnail + title + seller).
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
  ArrowRight,
  ArrowsClockwise,
  ChatText,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  Eye,
  MagnifyingGlass,
  Package,
  Tray,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react'
import Image from 'next/image'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AdminEmpty,
  AdminLoadingRows,
  AdminPagination,
  FilterChip,
  FilterRow,
  PageHeader,
  StatusBadge,
  adminBtn,
  adminBtnSm,
  adminFieldCls,
  type ChipTone,
} from '../../components/kit'
import { TierChip } from '../../components/TierChip'

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

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`

// ─── Shared class snippets ───────────────────────────────────────────────────

/** Small fill chip in a seller group's header. */
const CHIP = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

const HISTORY_SLICES: { key: ModerationHistorySlice; label: string }[] = [
  { key: 'approved_today', label: 'Approved Today' },
  { key: 'rejected_today', label: 'Rejected Today' },
  { key: 'approved_all', label: 'All Approved' },
  { key: 'all', label: 'Everything' },
]

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

  // ── Clickable numbers (each jumps to its tab / history slice) ──────────────
  const statCells: {
    label: string
    value: React.ReactNode
    onClick: () => void
  }[] = [
    {
      label: 'Pending',
      value: <span className={(stats?.pending ?? 0) > 0 ? 'text-warning' : undefined}>{stats?.pending ?? '—'}</span>,
      onClick: () => setTab('pending'),
    },
    { label: 'Awaiting Seller', value: stats?.awaiting_seller ?? '—', onClick: () => setTab('awaiting') },
    { label: 'Approved Today', value: stats?.approved_today ?? '—', onClick: () => goToHistory('approved_today') },
    { label: 'Rejected Today', value: stats?.rejected_today ?? '—', onClick: () => goToHistory('rejected_today') },
    { label: 'Total Approved', value: stats?.total_approved ?? '—', onClick: () => goToHistory('approved_all') },
  ]

  const viewHistory = (
    <button type="button" onClick={() => goToHistory('all')} className={adminBtn.secondary}>
      <ClockCounterClockwise aria-hidden weight="bold" className="h-4 w-4" />
      View History
    </button>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Moderation"
        description="Review new listings: approve, send back for changes, or reject."
        className="mb-0 sm:mb-0"
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07] md:grid-cols-5">
        {statCells.map((cell, i) => (
          <button
            key={cell.label}
            type="button"
            onClick={cell.onClick}
            className={cn(
              'group min-w-0 bg-bg-raised px-4 py-4 text-left transition-colors hover:bg-bg-raised-hover sm:px-5',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring',
              i === 0 && 'col-span-2 md:col-span-1',
            )}
          >
            <span className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-text-secondary">
              <span className="truncate">{cell.label}</span>
              <ArrowRight
                aria-hidden
                weight="bold"
                className="h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
              />
            </span>
            <span className="mt-1 block truncate text-[24px] font-bold leading-tight tabular-nums text-text-primary">
              {cell.value}
            </span>
          </button>
        ))}
      </div>

      {/* Tabs + client-side search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs<Tab>
          tabs={[
            { id: 'pending', label: <>Pending <TabCount n={pendingListings.length} /></> },
            { id: 'awaiting', label: <>Awaiting Seller <TabCount n={awaitingListings.length} /></> },
            { id: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="moderation-tabs"
          ariaLabel="Moderation queue"
        />
        <div className="relative w-full lg:max-w-[320px]">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            aria-label="Search the queue"
            placeholder="Search title, seller, game…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(adminFieldCls, 'pl-10 pr-9')}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {tab === 'history' && (
        <FilterRow label="Show">
          {HISTORY_SLICES.map((s) => (
            <FilterChip
              key={s.key}
              selected={historySlice === s.key}
              onClick={() => {
                setHistorySlice(s.key)
                setHistoryPage(1)
              }}
            >
              {s.label}
            </FilterChip>
          ))}
        </FilterRow>
      )}

      <div role="tabpanel" id={`moderation-tabs-panel-${tab}`} aria-labelledby={`moderation-tabs-tab-${tab}`}>
        {/* ── Queue tabs ── */}
        {(tab === 'pending' || tab === 'awaiting') &&
          (queueErrored ? (
            <ErrorPanel
              message={(queueQuery.error as Error)?.message}
              onRetry={() => queueQuery.refetch()}
              retrying={queueQuery.isFetching}
            />
          ) : queueLoading ? (
            <AdminLoadingRows rows={5} />
          ) : tab === 'pending' ? (
            sellerGroups.length === 0 ? (
              <AdminEmpty
                icon={CheckCircle}
                tone={q ? 'neutral' : 'success'}
                title={q ? 'No Matches' : 'All Caught Up'}
                hint={q ? 'No pending listings match your search.' : 'Every submitted listing has been reviewed.'}
                action={viewHistory}
              />
            ) : (
              <div className="space-y-3">
                {sellerGroups.map((group) => (
                  <SellerGroupCard
                    key={group.sellerId}
                    group={group}
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
            <AdminEmpty
              icon={ChatText}
              title={q ? 'No Matches' : 'Nothing Awaiting Sellers'}
              hint={q ? 'No awaiting listings match your search.' : 'No listings are waiting on seller changes.'}
              action={viewHistory}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredAwaiting.map((listing: any) => (
                <AwaitingRow
                  key={listing.id}
                  listing={listing}
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
          ))}

        {/* ── History tab ── */}
        {tab === 'history' &&
          (historyQuery.isError ? (
            <ErrorPanel
              message={(historyQuery.error as Error)?.message}
              onRetry={() => historyQuery.refetch()}
              retrying={historyQuery.isFetching}
            />
          ) : historyQuery.isPending ? (
            <AdminLoadingRows rows={6} />
          ) : historyRows.length === 0 ? (
            <AdminEmpty
              icon={Tray}
              title="No Decisions Here"
              hint={q ? 'No history rows match your search.' : 'Nothing recorded for this filter yet.'}
              action={
                <button type="button" onClick={() => setTab('pending')} className={adminBtn.secondary}>
                  View Queue
                  <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  'divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised',
                  historyQuery.isFetching && 'opacity-60 transition-opacity',
                )}
              >
                {/* Column headers (desktop) */}
                <div className="hidden items-center gap-3 px-4 py-3 text-[12px] font-medium text-text-tertiary md:flex">
                  <span className="w-11 shrink-0" />
                  <span className="min-w-0 flex-1">Listing</span>
                  <span className="w-[140px] shrink-0">Seller</span>
                  <span className="w-[180px] shrink-0">Decided</span>
                  <span className="w-[150px] shrink-0 text-right">Decision</span>
                </div>
                {historyRows.map((row) => (
                  <HistoryRowCard key={`${row.id}-${row.decision}`} row={row} />
                ))}
              </div>
              <AdminPagination
                page={historyPage}
                totalPages={historyTotalPages}
                total={historyTotal}
                limit={historyPageSize}
                onPage={setHistoryPage}
                noun="decisions"
              />
            </div>
          ))}
      </div>

      {/* ── Approve dialog ── */}
      <ModDialog
        open={dialog === 'approve' && !!selectedListing}
        onClose={() => {
          setDialog(null)
          setApprovalNotes('')
        }}
        busy={actionBusy}
        title="Approve Listing"
        description="This listing goes live for buyers immediately."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-approve-notes" className={FIELD_LABEL}>
            Notes (Optional)
          </label>
          <textarea
            id="mod-approve-notes"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add any internal notes…"
            className={cn(accountInputCls, 'resize-none')}
            rows={3}
          />
        </div>
        <DialogActions>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              setApprovalNotes('')
            }}
            className={adminBtn.secondary}
            disabled={actionBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              approveMutation.mutate({
                id: selectedListing.id,
                notes: approvalNotes || undefined,
              })
            }
            disabled={actionBusy}
            className={adminBtn.primary}
          >
            {approveMutation.isPending ? (
              <>
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                Approving…
              </>
            ) : (
              <>
                <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
                Approve Listing
              </>
            )}
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Reject dialog ── */}
      <ModDialog
        open={dialog === 'reject' && !!selectedListing}
        onClose={() => {
          setDialog(null)
          setRejectReason('')
        }}
        busy={actionBusy}
        title="Reject Listing"
        description="The seller is notified with your reason. The listing will not go live."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-reject-reason" className={FIELD_LABEL}>
            Rejection Reason <span className="text-error">*</span>
          </label>
          <textarea
            id="mod-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this listing is being rejected…"
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
          />
        </div>
        <DialogActions>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              setRejectReason('')
            }}
            className={adminBtn.secondary}
            disabled={actionBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              rejectMutation.mutate({ id: selectedListing.id, reason: rejectReason })
            }
            disabled={actionBusy || !rejectReason.trim()}
            className={adminBtn.danger}
          >
            {rejectMutation.isPending ? (
              <>
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                Rejecting…
              </>
            ) : (
              <>
                <XCircle aria-hidden weight="bold" className="h-4 w-4" />
                Reject Listing
              </>
            )}
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Request-changes dialog ── */}
      <ModDialog
        open={dialog === 'changes' && !!selectedListing}
        onClose={() => {
          setDialog(null)
          setChangeRequest('')
        }}
        busy={actionBusy}
        title={
          selectedListing?.status === 'changes_requested' ? 'Update Request' : 'Request Changes'
        }
        description="The listing moves to Awaiting Seller. They see your notes and resubmit for review."
        listing={selectedListing}
      >
        <div>
          <label htmlFor="mod-changes" className={FIELD_LABEL}>
            Required Changes <span className="text-error">*</span>
          </label>
          <textarea
            id="mod-changes"
            value={changeRequest}
            onChange={(e) => setChangeRequest(e.target.value)}
            placeholder="Describe what needs to be changed…"
            className={cn(accountInputCls, 'resize-none')}
            rows={4}
          />
        </div>
        <DialogActions>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              setChangeRequest('')
            }}
            className={adminBtn.secondary}
            disabled={actionBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedListing &&
              changesMutation.mutate({ id: selectedListing.id, changes: changeRequest })
            }
            disabled={actionBusy || !changeRequest.trim()}
            className={adminBtn.primary}
          >
            {changesMutation.isPending ? (
              <>
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <ChatText aria-hidden weight="bold" className="h-4 w-4" />
                Send Request
              </>
            )}
          </button>
        </DialogActions>
      </ModDialog>

      {/* ── Bulk-approve confirm dialog ── */}
      <ModDialog
        open={!!bulkGroup}
        onClose={() => setBulkGroup(null)}
        title="Approve All Listings"
        description={`All ${bulkGroup?.listings.length ?? 0} pending listing${
          (bulkGroup?.listings.length ?? 0) === 1 ? '' : 's'
        } from this seller go live for buyers immediately.`}
        sellerHeader={bulkGroup?.seller}
        sellerListingCount={bulkGroup?.listings.length ?? 0}
      >
        <DialogActions>
          <button type="button" onClick={() => setBulkGroup(null)} className={adminBtn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => bulkGroup && handleBulkApprove(bulkGroup)}
            className={adminBtn.primary}
          >
            <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
            Approve All ({bulkGroup?.listings.length})
          </button>
        </DialogActions>
      </ModDialog>
    </div>
  )
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

/**
 * Title + description, then a context row showing WHAT the admin is acting
 * on (listing thumbnail + title + seller — or the seller themselves for bulk
 * approve), then the caller's body + actions.
 */
function ModDialog({
  open,
  onClose,
  busy,
  title,
  description,
  listing,
  sellerHeader,
  sellerListingCount,
  children,
}: {
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description: string
  listing?: any
  /** Bulk mode: show the seller (avatar + name + pending count) instead of a listing. */
  sellerHeader?: any
  sellerListingCount?: number
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>
        </div>

        {listing && (
          <div className="flex items-center gap-3 rounded-md bg-bg-overlay px-3 py-2.5">
            <ListingThumb listing={listing} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
                <span className="font-semibold tabular-nums text-text-secondary">{money(listing.price)}</span>
                {listing.game?.name ? ` · ${listing.game.name}` : ''}
                {listing.category?.name ? ` · ${listing.category.name}` : ''}
                {' · '}
                {listing.seller?.shop_name || listing.seller?.username || 'Unknown seller'}
              </p>
            </div>
          </div>
        )}
        {sellerHeader !== undefined && (
          <div className="flex items-center gap-3 rounded-md bg-bg-overlay px-3 py-2.5">
            <SellerAvatar seller={sellerHeader} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-primary">
                {sellerHeader?.shop_name || sellerHeader?.username || 'Unknown Seller'}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
                {sellerListingCount} pending listing{sellerListingCount === 1 ? '' : 's'}
              </p>
            </div>
            <TierChip tier={sellerHeader?.seller_tier} className="shrink-0" />
          </div>
        )}

        {children}
      </DialogContent>
    </Dialog>
  )
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
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
    <AdminEmpty
      icon={Warning}
      tone="warning"
      title="Couldn't Load the Queue"
      hint={message || 'Something went wrong fetching moderation data.'}
      action={
        <button type="button" onClick={onRetry} disabled={retrying} className={adminBtn.secondary}>
          {retrying ? (
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowsClockwise aria-hidden weight="bold" className="h-4 w-4" />
          )}
          Retry
        </button>
      }
    />
  )
}

// ─── Seller group ────────────────────────────────────────────────────────────

function SellerAvatar({ seller, className }: { seller: any; className?: string }) {
  const name = seller?.shop_name || seller?.username || 'Seller'
  if (seller?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={seller.avatar_url} alt="" className={cn('h-10 w-10 shrink-0 rounded-md object-cover', className)} />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[14px] font-bold text-text-secondary',
        className,
      )}
    >
      {(name.trim()[0] || 'S').toUpperCase()}
    </span>
  )
}

function SellerGroupCard({
  group,
  pendingIds,
  bulkBusy,
  anyBulkBusy,
  onApprove,
  onReject,
  onChanges,
  onBulkApprove,
}: {
  group: SellerGroup
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
  const joined = joinedLabel(seller?.created_at)

  const willCross =
    !!context && context.approvedCount + context.pendingCount >= context.threshold

  return (
    <section aria-label={name} className="overflow-hidden rounded-lg bg-bg-raised">
      {/* Group header */}
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <SellerAvatar seller={seller} />
          <div className="min-w-0 flex-1">
            {group.sellerId !== 'unknown' ? (
              <Link
                href={`/admin/active-sellers/${group.sellerId}`}
                className="block truncate text-[14.5px] font-semibold text-text-primary underline-offset-4 hover:underline"
              >
                {name}
              </Link>
            ) : (
              <p className="truncate text-[14.5px] font-semibold text-text-primary">{name}</p>
            )}
            <p className="truncate text-[12px] text-text-tertiary">
              {seller?.shop_name && seller?.username ? `@${seller.username}` : null}
              {seller?.shop_name && seller?.username && joined ? ' · ' : null}
              {joined}
            </p>
          </div>
          <button
            type="button"
            onClick={onBulkApprove}
            disabled={anyBulkBusy}
            className={cn(adminBtnSm.primary, 'shrink-0')}
          >
            {bulkBusy ? (
              <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
            )}
            Approve All ({group.listings.length})
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-[52px]">
          <TierChip tier={seller?.seller_tier} />
          {context && (
            <span
              className={cn(CHIP, willCross ? 'bg-lime-tint-bg text-lime-text' : 'bg-white/[0.07] text-text-secondary')}
              title={`${context.approvedCount} of ${context.threshold} pre-moderation listings already approved · ${context.pendingCount} pending`}
            >
              {context.approvedCount}/{context.threshold} Reviewed
            </span>
          )}
          {context?.storePaused && <span className={cn(CHIP, 'bg-warning-bg text-warning')}>Store Paused</span>}
          {seller?.seller_status === 'restricted' && (
            <span className={cn(CHIP, 'bg-error-bg text-error')}>Restricted</span>
          )}
          {seller?.is_test && <span className={cn(CHIP, 'bg-white/[0.07] text-text-tertiary')}>Test</span>}
        </div>
      </div>

      {/* Listing rows */}
      <div className="space-y-1.5 px-2 pb-2">
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
    </section>
  )
}

// ─── Listing row (pending) ───────────────────────────────────────────────────

function ListingThumb({ listing }: { listing: any }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.05]">
      {listing.images?.[0] ? (
        <Image src={listing.images[0]} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package aria-hidden weight="bold" className="h-5 w-5 text-text-disabled" />
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
    <div className="flex flex-col gap-3 rounded-md bg-bg-overlay p-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {preview ? (
              <Link
                href={preview}
                target="_blank"
                className="truncate text-[13.5px] font-semibold text-text-primary underline-offset-4 hover:underline"
              >
                {listing.title}
              </Link>
            ) : (
              <p className="truncate text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
            )}
            {resubmitted && (
              <span
                className={cn(CHIP, 'shrink-0 bg-white/[0.07] text-text-secondary')}
                title={`Previous request: ${listing.moderation_notes}`}
              >
                Resubmitted
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-tertiary">
            <span className="font-semibold tabular-nums text-text-primary">{money(listing.price)}</span>
            {listing.quantity != null && Number(listing.quantity) > 1 && (
              <span className="tabular-nums">×{listing.quantity}</span>
            )}
            <span className="truncate">
              {listing.game?.name}
              {listing.category?.name ? ` · ${listing.category.name}` : ''}
            </span>
            <span className={cn(stale && 'font-semibold text-warning')}>
              {relativeTime(listing.created_at, now)}
            </span>
            {chips.map((chip) => (
              <span
                key={chip.k}
                className="rounded bg-white/[0.06] px-1.5 py-px text-[11px] font-medium capitalize text-text-secondary"
              >
                {chip.k}: {chip.v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onApprove} disabled={busy} className={cn(adminBtnSm.primary, 'min-w-0 flex-1 md:flex-none')}>
          {busy ? (
            <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          )}
          Approve
        </button>
        <button type="button" onClick={onChanges} disabled={busy} className={cn(adminBtnSm.secondary, 'min-w-0 flex-1 md:flex-none')}>
          <ChatText aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Changes
        </button>
        <button type="button" onClick={onReject} disabled={busy} className={cn(adminBtnSm.danger, 'min-w-0 flex-1 md:flex-none')}>
          <XCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Reject
        </button>
        {/* Phones open the preview from the title instead. */}
        {preview && (
          <Link href={preview} target="_blank" className={cn(adminBtnSm.secondary, 'hidden md:inline-flex')}>
            <Eye aria-hidden weight="bold" className="h-3.5 w-3.5" />
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
  busy,
  onUpdateRequest,
  onReject,
}: {
  listing: any
  busy: boolean
  onUpdateRequest: () => void
  onReject: () => void
}) {
  const now = useNow()
  const requestedAt = listing.changes_requested_at || listing.updated_at

  return (
    <div className="flex flex-col rounded-lg bg-bg-raised p-4">
      <div className="flex min-w-0 items-start gap-3">
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[13.5px] font-semibold text-text-primary">{listing.title}</p>
            <StatusBadge status="Awaiting Seller" tone="warning" className="shrink-0" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-tertiary">
            <span className="font-semibold tabular-nums text-text-primary">{money(listing.price)}</span>
            <span className="truncate">{listing.seller?.shop_name || listing.seller?.username || 'Unknown'}</span>
            <span className="truncate">
              {listing.game?.name}
              {listing.category?.name ? ` · ${listing.category.name}` : ''}
            </span>
            {now != null && requestedAt && <span>Asked {relativeTime(requestedAt, now)}</span>}
          </div>
        </div>
      </div>
      {listing.moderation_notes && (
        <p className="mt-3 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-warning">Requested: </span>
          {listing.moderation_notes}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
        <button type="button" onClick={onUpdateRequest} disabled={busy} className={adminBtnSm.secondary}>
          <ChatText aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Update Request
        </button>
        <button type="button" onClick={onReject} disabled={busy} className={adminBtnSm.danger}>
          {busy ? (
            <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          )}
          Reject
        </button>
      </div>
    </div>
  )
}

// ─── History row ─────────────────────────────────────────────────────────────

const DECISION: Record<ModerationHistoryRow['decision'], { label: string; tone: ChipTone }> = {
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'error' },
  changes_requested: { label: 'Changes Requested', tone: 'warning' },
}

function HistoryRowCard({ row }: { row: ModerationHistoryRow }) {
  const now = useNow()
  const decision = DECISION[row.decision] ?? { label: row.decision, tone: 'neutral' as ChipTone }
  const decided = `by ${row.decidedBy || 'Unknown'}${row.decidedAt && now != null ? ` · ${relativeTime(row.decidedAt, now)}` : ''}`

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
      <ListingThumb listing={row} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">{row.title}</p>
          <StatusBadge status={decision.label} tone={decision.tone} className="shrink-0 md:hidden" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-tertiary">
          {row.price != null && (
            <span className="font-semibold tabular-nums text-text-secondary">{money(row.price)}</span>
          )}
          <span className="truncate">
            {row.game?.name}
            {row.category?.name ? ` · ${row.category.name}` : ''}
          </span>
          <span className="truncate md:hidden">
            {row.seller || '—'} · {decided}
          </span>
          {row.reason && (
            <span className="max-w-full truncate italic md:max-w-[360px]" title={row.reason}>
              “{row.reason}”
            </span>
          )}
        </div>
      </div>

      <p className="hidden w-[140px] shrink-0 truncate text-[13px] font-medium text-text-secondary md:block">
        {row.seller || '—'}
      </p>
      <p className="hidden w-[180px] shrink-0 truncate text-[12.5px] text-text-tertiary md:block">{decided}</p>
      <div className="hidden w-[150px] shrink-0 justify-end md:flex">
        <StatusBadge status={decision.label} tone={decision.tone} />
      </div>
    </div>
  )
}
