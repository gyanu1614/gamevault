/**
 * Admin Moderation Queue — client component.
 *
 * Review and approve/reject pending listings. Initial data (queue +
 * stats) is fetched by the server wrapper (../page.tsx) and passed in
 * as props, so the page arrives fully rendered. loadData() remains for
 * the approve/reject/request-changes refresh flow.
 *
 * Queue now carries TWO states: pending_approval (needs an admin
 * decision) and changes_requested (bounced back to the seller —
 * "Awaiting Seller"), surfaced via the status tabs above the list.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import {
  getPendingListings,
  approveListing,
  rejectListing,
  requestListingChanges,
  getModerationStats,
} from '@/lib/actions/moderation'
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  User,
  Tag,
  Calendar,
  Clock,
  ShieldCheck,
  Loader2,
  Search,
  Package,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PageHeader, StatCard } from '../../components/kit'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type QueueTab = 'pending' | 'awaiting'

function titleCaseTier(tier: string | null | undefined): string {
  const t = (tier || 'unverified').replace(/[-_]/g, ' ')
  return t.replace(/\b\w/g, (c) => c.toUpperCase())
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function ModerationPageClient({
  initialListings,
  initialStats,
}: {
  initialListings: any[]
  initialStats: any
}) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  // V54 — State is seeded from the server wrapper; the initial render
  // shows real data (isLoading starts false, no mount fetch).
  const [listings, setListings] = useState<any[]>(initialListings)
  const [stats, setStats] = useState<any>(initialStats)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<QueueTab>('pending')
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [changeRequest, setChangeRequest] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const pendingListings = listings.filter((l) => l.status !== 'changes_requested')
  const awaitingListings = listings.filter((l) => l.status === 'changes_requested')
  const tabListings = tab === 'pending' ? pendingListings : awaitingListings

  const q = searchQuery.trim().toLowerCase()
  const filteredListings = q
    ? tabListings.filter(
        (listing) =>
          (listing.title || '').toLowerCase().includes(q) ||
          (listing.seller?.username || '').toLowerCase().includes(q) ||
          (listing.game?.name || '').toLowerCase().includes(q)
      )
    : tabListings

  // V54 — No mount-time fetch: the server wrapper already delivered the
  // initial queue + stats. loadData() is kept for post-action refreshes.
  const loadData = async () => {
    setIsLoading(true)
    const [listingsResult, statsResult] = await Promise.all([
      getPendingListings(),
      getModerationStats(),
    ])

    if (listingsResult.success) {
      setListings(listingsResult.listings || [])
    }

    if (statsResult.success) {
      setStats(statsResult.stats)
    }

    setIsLoading(false)
  }

  const handleApprove = async (listingId: string) => {
    setActionLoading(true)
    const result = await approveListing(listingId, approvalNotes)

    if (result.success) {
      toast.success('Listing approved successfully')
      setShowApproveModal(false)
      setApprovalNotes('')
      loadData()
    } else {
      toast.error(result.error || 'Failed to approve listing')
    }

    setActionLoading(false)
  }

  const handleReject = async (listingId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    setActionLoading(true)
    const result = await rejectListing(listingId, rejectReason)

    if (result.success) {
      toast.success('Listing rejected')
      setShowRejectModal(false)
      setRejectReason('')
      loadData()
    } else {
      toast.error(result.error || 'Failed to reject listing')
    }

    setActionLoading(false)
  }

  const handleRequestChanges = async (listingId: string) => {
    if (!changeRequest.trim()) {
      toast.error('Please describe the required changes')
      return
    }

    setActionLoading(true)
    const result = await requestListingChanges(listingId, changeRequest)

    if (result.success) {
      toast.success('Change request sent to seller')
      setShowChangesModal(false)
      setChangeRequest('')
      loadData()
    } else {
      toast.error(result.error || 'Failed to send change request')
    }

    setActionLoading(false)
  }

  // V54 — authLoading no longer gates the render: auth is enforced by
  // the server layout, and the seeded data is valid for this admin.
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          <p className="text-text-secondary">Loading moderation queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Moderation Queue"
          description="Review and approve pending listings"
        />

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Pending Review" value={stats.pending} icon={Clock} tone="warning" />
            <StatCard label="Awaiting Seller" value={stats.awaiting_seller ?? 0} icon={MessageSquare} tone="info" />
            <StatCard label="Approved Today" value={stats.approved_today} icon={CheckCircle2} tone="success" />
            <StatCard label="Rejected Today" value={stats.rejected_today} icon={XCircle} tone="error" />
            <StatCard label="Total Approved" value={stats.total_approved} icon={ShieldCheck} tone="lime" />
          </div>
        )}

        {/* Queue tabs + search */}
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            {([
              { key: 'pending' as QueueTab, label: 'Pending Review', count: pendingListings.length },
              { key: 'awaiting' as QueueTab, label: 'Awaiting Seller', count: awaitingListings.length },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-md border px-3.5 text-[13px] font-semibold transition-colors',
                  tab === t.key
                    ? 'border-border-strong bg-bg-overlay text-text-primary'
                    : 'border-border-default bg-transparent text-text-secondary hover:bg-bg-overlay hover:text-text-primary'
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                    tab === t.key ? 'text-text-primary' : 'text-text-tertiary'
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-border-default bg-bg-base pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
            />
          </div>
        </div>

        {/* Listings */}
        {filteredListings.length === 0 ? (
          <div className="rounded-lg border border-border-default bg-bg-raised py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-text-disabled" />
            <h3 className="mb-1 text-lg font-bold text-text-primary">
              {tab === 'pending' ? 'All Caught Up' : 'Nothing Awaiting Sellers'}
            </h3>
            <p className="text-sm text-text-secondary">
              {tab === 'pending'
                ? 'No listings pending review'
                : 'No listings are waiting on seller changes'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="rounded-lg border border-border-default bg-bg-raised p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Image */}
                  <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-md border border-border-subtle bg-bg-overlay sm:h-28 sm:w-28">
                    {listing.images && listing.images[0] ? (
                      <Image
                        src={listing.images[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-8 w-8 text-text-disabled" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[15px] font-bold text-text-primary">{listing.title}</h3>
                      {listing.status === 'changes_requested' && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(251,191,36,0.25)] bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning">
                          <MessageSquare className="h-3 w-3" />
                          Changes Requested {relativeTime(listing.updated_at)}
                        </span>
                      )}
                    </div>
                    <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        {listing.game?.name} • {listing.category?.name}
                      </span>
                      <span className="font-semibold tabular-nums text-text-primary">
                        ${Number(listing.price ?? 0).toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {listing.seller?.username || 'Unknown'}
                        <span className="text-text-tertiary">
                          · {titleCaseTier(listing.seller?.seller_tier)} Seller
                        </span>
                      </span>
                    </div>

                    {/* Description */}
                    {listing.description && (
                      <p className="mb-3 line-clamp-2 text-[13px] text-text-secondary">
                        {listing.description}
                      </p>
                    )}

                    {/* Requested changes (awaiting-seller cards) */}
                    {listing.status === 'changes_requested' && listing.moderation_notes && (
                      <div className="mb-3 rounded-md border border-[rgba(251,191,36,0.25)] bg-warning-bg px-3 py-2 text-[12.5px] text-text-secondary">
                        <span className="font-semibold text-warning">Requested: </span>
                        {listing.moderation_notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowApproveModal(true)
                        }}
                        className="flex items-center gap-1.5 rounded-md bg-lime px-3.5 py-2 text-[13px] font-bold text-text-inverse transition-colors hover:bg-lime-hover"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowRejectModal(true)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-[rgba(248,113,113,0.25)] bg-error-bg px-3.5 py-2 text-[13px] font-semibold text-error transition-colors hover:border-[rgba(248,113,113,0.4)]"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setChangeRequest(listing.status === 'changes_requested' ? (listing.moderation_notes || '') : '')
                          setShowChangesModal(true)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-border-default bg-transparent px-3.5 py-2 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {listing.status === 'changes_requested' ? 'Update Request' : 'Request Changes'}
                      </button>
                      <Link
                        href={`/${listing.game?.slug}/${listing.category?.slug}/${listing.slug || listing.id}`}
                        className="flex items-center gap-1.5 rounded-md border border-border-default bg-transparent px-3.5 py-2 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve Dialog */}
        <Dialog
          open={showApproveModal && !!selectedListing}
          onOpenChange={(o) => {
            if (!o) {
              setShowApproveModal(false)
              setApprovalNotes('')
            }
          }}
        >
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>Approve Listing</DialogTitle>
              <DialogDescription>
                &quot;{selectedListing?.title}&quot; will go live for buyers immediately.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any internal notes..."
                className="w-full resize-none rounded-md border border-border-default bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
                rows={3}
              />
            </div>
            <DialogFooter>
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setApprovalNotes('')
                }}
                className="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => selectedListing && handleApprove(selectedListing.id)}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-bold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve Listing'
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog
          open={showRejectModal && !!selectedListing}
          onOpenChange={(o) => {
            if (!o) {
              setShowRejectModal(false)
              setRejectReason('')
            }
          }}
        >
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>Reject Listing</DialogTitle>
              <DialogDescription>
                The seller will be notified with your reason. &quot;{selectedListing?.title}&quot; will
                not go live.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this listing is being rejected..."
                className="w-full resize-none rounded-md border border-border-default bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
                rows={4}
              />
            </div>
            <DialogFooter>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => selectedListing && handleReject(selectedListing.id)}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex items-center justify-center gap-2 rounded-md border border-[rgba(248,113,113,0.3)] bg-error-bg px-4 py-2 text-sm font-semibold text-error transition-colors hover:border-[rgba(248,113,113,0.45)] disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Listing'
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Changes Dialog */}
        <Dialog
          open={showChangesModal && !!selectedListing}
          onOpenChange={(o) => {
            if (!o) {
              setShowChangesModal(false)
              setChangeRequest('')
            }
          }}
        >
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>Request Changes</DialogTitle>
              <DialogDescription>
                The listing moves to Awaiting Seller — the seller sees your notes on their offer and
                resubmits it for review.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Required Changes *
              </label>
              <textarea
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                placeholder="Describe what needs to be changed..."
                className="w-full resize-none rounded-md border border-border-default bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
                rows={4}
              />
            </div>
            <DialogFooter>
              <button
                onClick={() => {
                  setShowChangesModal(false)
                  setChangeRequest('')
                }}
                className="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => selectedListing && handleRequestChanges(selectedListing.id)}
                disabled={actionLoading || !changeRequest.trim()}
                className="flex items-center justify-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-bold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Request'
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
