/**
 * Admin Moderation Queue — client component.
 *
 * Review and approve/reject pending listings. Initial data (pending
 * listings + stats) is fetched by the server wrapper (../page.tsx) and
 * passed in as props, so the page arrives fully rendered — no
 * "Loading moderation queue…" flash. loadData() remains for the
 * approve/reject/request-changes refresh flow.
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
  DollarSign,
  Calendar,
  Clock,
  ShieldCheck,
  Loader2,
  Search,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import Link from 'next/link'
import { PageHeader, StatCard } from '../../components/kit'

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
  const [filteredListings, setFilteredListings] = useState<any[]>(initialListings)
  const [stats, setStats] = useState<any>(initialStats)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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

  useEffect(() => {
    // Filter listings based on search
    if (searchQuery) {
      const filtered = listings.filter(
        (listing) =>
          listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.seller.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.game.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredListings(filtered)
    } else {
      setFilteredListings(listings)
    }
  }, [searchQuery, listings])

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
      setFilteredListings(listingsResult.listings || [])
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
  // isLoading starts false, so the initial render can never hit this
  // branch; it only shows during post-action loadData() refreshes.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Pending Review" value={stats.pending} icon={Clock} tone="warning" />
            <StatCard label="Approved Today" value={stats.approved_today} icon={CheckCircle2} tone="success" />
            <StatCard label="Rejected Today" value={stats.rejected_today} icon={XCircle} tone="error" />
            <StatCard label="Total Approved" value={stats.total_approved} icon={ShieldCheck} tone="lime" />
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none"
            />
          </div>
        </div>

        {/* Listings */}
        {filteredListings.length === 0 ? (
          <div className="text-center py-12 bg-bg-raised border border-border-default rounded-xl">
            <CheckCircle2 className="w-16 h-16 text-text-disabled mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">All caught up!</h3>
            <p className="text-text-secondary">No listings pending review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-bg-raised border border-border-default rounded-xl p-6 hover:border-border-strong transition-colors"
              >
                <div className="flex gap-6">
                  {/* Image */}
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 border border-border-subtle bg-bg-overlay">
                    {listing.images && listing.images[0] ? (
                      <Image
                        src={listing.images[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎮
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-text-primary mb-2">{listing.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-text-secondary">
                          <span className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {listing.game.name} • {listing.category.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${listing.price.toFixed(2)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(listing.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="flex items-center gap-3 mb-4 p-3 bg-bg-overlay border border-border-subtle rounded-lg">
                      <User className="w-5 h-5 text-lime-text" />
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {listing.seller.username}
                        </div>
                        <div className="text-xs text-text-tertiary capitalize">
                          {listing.seller.seller_tier || 'unverified'} seller
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {listing.description && (
                      <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                        {listing.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowApproveModal(true)
                        }}
                        className="px-4 py-2 bg-lime-pressed hover:bg-lime text-text-inverse font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowRejectModal(true)
                        }}
                        className="px-4 py-2 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowChangesModal(true)
                        }}
                        className="px-4 py-2 border border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Request Changes
                      </button>
                      <Link
                        href={`/${listing.game.slug}/${listing.category.slug}/${listing.slug}`}
                        className="px-4 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary hover:text-text-primary font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedListing && (
          <Modal
            title="Approve Listing"
            onClose={() => {
              setShowApproveModal(false)
              setApprovalNotes('')
            }}
          >
            <p className="text-text-secondary mb-4">
              Approve &quot;{selectedListing.title}&quot;?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any internal notes..."
                className="w-full px-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setApprovalNotes('')
                }}
                className="flex-1 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(selectedListing.id)}
                disabled={actionLoading}
                className="flex-1 py-2 bg-lime-pressed hover:bg-lime text-text-inverse font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve Listing'
                )}
              </button>
            </div>
          </Modal>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedListing && (
          <Modal
            title="Reject Listing"
            onClose={() => {
              setShowRejectModal(false)
              setRejectReason('')
            }}
          >
            <p className="text-text-secondary mb-4">
              Reject &quot;{selectedListing.title}&quot;?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this listing is being rejected..."
                className="w-full px-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="flex-1 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedListing.id)}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Listing'
                )}
              </button>
            </div>
          </Modal>
        )}

        {/* Changes Modal */}
        {showChangesModal && selectedListing && (
          <Modal
            title="Request Changes"
            onClose={() => {
              setShowChangesModal(false)
              setChangeRequest('')
            }}
          >
            <p className="text-text-secondary mb-4">
              Request changes to &quot;{selectedListing.title}&quot;
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Required Changes *
              </label>
              <textarea
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                placeholder="Describe what needs to be changed..."
                className="w-full px-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChangesModal(false)
                  setChangeRequest('')
                }}
                className="flex-1 py-2 border border-border-default bg-bg-overlay hover:bg-bg-overlay-2 text-text-secondary font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequestChanges(selectedListing.id)}
                disabled={actionLoading || !changeRequest.trim()}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Request'
                )}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

// Modal Component
function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-raised border border-border-default rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text-primary mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
