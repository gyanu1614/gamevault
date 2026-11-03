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
 *   - Data via react-query seeded with the server wrapper's initialData. A
 *     decision shows the moment it is clicked: the row leaves, the numbers
 *     move, the dialog closes. The server confirms behind it, and a failure
 *     reloads the queue. No refetch after a success.
 */

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import {
  getPendingListings,
  approveListing,
  approveListings,
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
import { toast } from 'sonner'
import { PageHeader } from '../../components/kit'
import { type StatCell, QueueToolbar, StatTiles } from './ModerationControls'
import { ModerationHistory } from './ModerationHistory'
import { ModerationQueue } from './ModerationQueue'
import {
  APPROVED_TILES,
  type QueueData,
  type SellerGroup,
  type StatKey,
  type Tab,
  moveStats,
  tileOf,
} from './moderation-format'

// ssr:false — the dialogs are never part of the first paint. They load on the
// first open (see dialogsOpened below).
const ModerationDialogs = dynamic(() => import('./ModerationDialogs'), { ssr: false })

// ─── Component ───────────────────────────────────────────────────────────────

export default function ModerationPageClient({
  initialListings,
  initialStats,
  fetchFailed = false,
}: {
  /** Absent on a server action's refresh: the client already has the data. */
  initialListings?: any[]
  initialStats?: any
  /** True when the server wrapper's own fetch errored — show a real error state, not an empty queue. */
  fetchFailed?: boolean
}) {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [historySlice, setHistorySlice] = useState<ModerationHistorySlice>('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'changes' | null>(null)
  const [bulkGroup, setBulkGroup] = useState<SellerGroup | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [changeRequest, setChangeRequest] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')

  // Mount the lazy dialogs only after one has been opened at least once.
  // Rendering them earlier would make next/dynamic fetch the chunk on page
  // load. Once mounted they stay mounted, so a dialog still closes with its
  // exit animation.
  const [dialogsOpened, setDialogsOpened] = useState(false)
  const anyDialogOpen = dialog !== null || bulkGroup !== null
  useEffect(() => {
    if (anyDialogOpen) setDialogsOpened(true)
  }, [anyDialogOpen])

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
    initialData:
      fetchFailed || !initialListings
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
  const patchQueue = (patch: (data: QueueData) => QueueData) => {
    queryClient.setQueryData<QueueData>(['moderation-queue'], (old) => (old ? patch(old) : old))
  }

  /** Take rows out of the queue; the numbers follow. `decidedAs` are the tiles they now count under. */
  const removeFromQueue = (ids: string[], decidedAs: StatKey[]) => {
    patchQueue((old) => {
      const leaving = old.listings.filter((l: any) => ids.includes(l.id))
      const changes: Partial<Record<StatKey, number>> = {}
      for (const l of leaving) {
        changes[tileOf(l)] = (changes[tileOf(l)] ?? 0) - 1
        for (const tile of decidedAs) changes[tile] = (changes[tile] ?? 0) + 1
      }
      return {
        listings: old.listings.filter((l: any) => !ids.includes(l.id)),
        stats: moveStats(old.stats, changes),
      }
    })
  }

  /** The threshold drain released the rest of this seller's queue. */
  const removeSellerQueue = (sellerId: string) => {
    const queue = queryClient.getQueryData<QueueData>(['moderation-queue'])
    removeFromQueue(
      (queue?.listings ?? [])
        .filter((l: any) => l.seller_id === sellerId && l.status === 'pending_approval')
        .map((l: any) => l.id),
      APPROVED_TILES,
    )
  }

  const markChangesRequested = (id: string, notes: string) => {
    patchQueue((old) => {
      const row = old.listings.find((l: any) => l.id === id)
      return {
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
        // Updating an existing request moves nothing.
        stats:
          row && tileOf(row) === 'pending'
            ? moveStats(old.stats, { pending: -1, awaiting_seller: 1 })
            : old.stats,
      }
    })
  }

  /** Before changing rows: a load already running must not write the old queue back. */
  const holdQueueLoads = () => {
    void queryClient.cancelQueries({ queryKey: ['moderation-queue'] })
  }
  const reloadQueue = () => {
    void queryClient.invalidateQueries({ queryKey: ['moderation-queue'] })
  }
  /** Marks history out of date. It only loads if the History tab is open. */
  const refreshHistory = () => {
    void queryClient.invalidateQueries({ queryKey: ['moderation-history'] })
  }

  const closeDialog = () => {
    setDialog(null)
    setApprovalNotes('')
    setRejectReason('')
    setChangeRequest('')
  }

  const showFailure = (error: Error) => {
    toast.error(error.message)
    reloadQueue()
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; sellerId?: string; notes?: string }) => {
      const result = await approveListing(id, notes)
      if (!result.success) throw new Error(result.error || 'Failed to approve listing')
      return result
    },
    onMutate: ({ id }) => {
      holdQueueLoads()
      removeFromQueue([id], APPROVED_TILES)
      closeDialog()
    },
    onSuccess: (result, { sellerId }) => {
      if ((result.drainedCount ?? 0) > 0 && sellerId) removeSellerQueue(sellerId)
      toast.success(
        (result.drainedCount ?? 0) > 0
          ? `Approved — ${result.drainedCount} more released automatically`
          : 'Listing approved',
      )
    },
    onError: showFailure,
    onSettled: refreshHistory,
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await rejectListing(id, reason)
      if (!result.success) throw new Error(result.error || 'Failed to reject listing')
      return result
    },
    onMutate: ({ id }) => {
      holdQueueLoads()
      removeFromQueue([id], ['rejected_today'])
      closeDialog()
    },
    onSuccess: () => {
      toast.success('Listing rejected')
    },
    onError: showFailure,
    onSettled: refreshHistory,
  })

  const changesMutation = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: string }) => {
      const result = await requestListingChanges(id, changes)
      if (!result.success) throw new Error(result.error || 'Failed to send change request')
      return result
    },
    onMutate: ({ id, changes }) => {
      holdQueueLoads()
      markChangesRequested(id, changes)
      closeDialog()
    },
    onSuccess: () => {
      toast.success('Change request sent to seller')
    },
    onError: showFailure,
    onSettled: refreshHistory,
  })

  // ── Approve All: one action for the group ──────────────────────────────────
  const bulkMutation = useMutation({
    mutationFn: async (group: SellerGroup) => {
      const result = await approveListings(group.listings.map((l: any) => l.id))
      if (!result.success) throw new Error(result.error || 'Failed to approve listings')
      return result
    },
    onMutate: (group) => {
      holdQueueLoads()
      removeFromQueue(group.listings.map((l: any) => l.id), APPROVED_TILES)
      setBulkGroup(null)
    },
    onSuccess: (result, group) => {
      if ((result.drainedCount ?? 0) > 0) removeSellerQueue(group.sellerId)
      const name = group.seller?.shop_name || group.seller?.username || 'seller'
      toast.success(`Approved ${result.approvedIds.length + (result.drainedCount ?? 0)} listings from ${name}`)
    },
    onError: showFailure,
    onSettled: refreshHistory,
  })

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

  // ── Open a dialog on a listing ─────────────────────────────────────────────
  const openApprove = (listing: any) => {
    setSelectedListing(listing)
    setApprovalNotes('')
    setDialog('approve')
  }
  const openReject = (listing: any) => {
    setSelectedListing(listing)
    setRejectReason('')
    setDialog('reject')
  }
  const openChanges = (listing: any) => {
    setSelectedListing(listing)
    setChangeRequest('')
    setDialog('changes')
  }
  const openUpdateRequest = (listing: any) => {
    setSelectedListing(listing)
    setChangeRequest(listing.moderation_notes || '')
    setDialog('changes')
  }

  // ── Clickable numbers (each jumps to its tab / history slice) ──────────────
  const statCells: StatCell[] = [
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Moderation"
        description="Review new listings: approve, send back for changes, or reject."
        className="mb-0 sm:mb-0"
      />

      <StatTiles cells={statCells} />

      {/* Tabs + client-side search */}
      <QueueToolbar
        tab={tab}
        setTab={setTab}
        pendingCount={pendingListings.length}
        awaitingCount={awaitingListings.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        historySlice={historySlice}
        setHistorySlice={setHistorySlice}
        setHistoryPage={setHistoryPage}
      />

      <div role="tabpanel" id={`moderation-tabs-panel-${tab}`} aria-labelledby={`moderation-tabs-tab-${tab}`}>
        {/* ── Queue tabs ── */}
        {(tab === 'pending' || tab === 'awaiting') && (
          <ModerationQueue
            tab={tab}
            errored={queueErrored}
            loading={queueLoading}
            errorMessage={(queueQuery.error as Error)?.message}
            retrying={queueQuery.isFetching}
            onRetry={() => queueQuery.refetch()}
            sellerGroups={sellerGroups}
            filteredAwaiting={filteredAwaiting}
            q={q}
            onViewHistory={() => goToHistory('all')}
            onApprove={openApprove}
            onReject={openReject}
            onChanges={openChanges}
            onBulkApprove={setBulkGroup}
            onUpdateRequest={openUpdateRequest}
          />
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <ModerationHistory
            isError={historyQuery.isError}
            isPending={historyQuery.isPending}
            isFetching={historyQuery.isFetching}
            errorMessage={(historyQuery.error as Error)?.message}
            onRetry={() => historyQuery.refetch()}
            historyRows={historyRows}
            q={q}
            onViewQueue={() => setTab('pending')}
            historyPage={historyPage}
            historyTotalPages={historyTotalPages}
            historyTotal={historyTotal}
            historyPageSize={historyPageSize}
            setHistoryPage={setHistoryPage}
          />
        )}
      </div>

      {dialogsOpened && (
        <ModerationDialogs
          dialog={dialog}
          selectedListing={selectedListing}
          bulkGroup={bulkGroup}
          approvalNotes={approvalNotes}
          setApprovalNotes={setApprovalNotes}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          changeRequest={changeRequest}
          setChangeRequest={setChangeRequest}
          closeDialog={closeDialog}
          closeBulk={() => setBulkGroup(null)}
          onApprove={approveMutation.mutate}
          onReject={rejectMutation.mutate}
          onRequestChanges={changesMutation.mutate}
          onBulkApprove={bulkMutation.mutate}
        />
      )}
    </div>
  )
}
