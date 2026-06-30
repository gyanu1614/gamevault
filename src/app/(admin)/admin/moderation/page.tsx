/**
 * Admin Moderation Queue Page
 *
 * Review and approve/reject pending listings
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
  AlertCircle,
  Loader2,
  Filter,
  Search,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ModerationQueuePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [listings, setListings] = useState<any[]>([])
  const [filteredListings, setFilteredListings] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
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
    loadData()
  }, [])

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

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-gray-400">Loading moderation queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Moderation Queue</h1>
          <p className="text-gray-400">Review and approve pending listings</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Pending Review</div>
              <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Approved Today</div>
              <div className="text-3xl font-bold text-green-400">{stats.approved_today}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Rejected Today</div>
              <div className="text-3xl font-bold text-red-400">{stats.rejected_today}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-1">Total Approved</div>
              <div className="text-3xl font-bold text-white">{stats.total_approved}</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Listings */}
        {filteredListings.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.03] border border-white/[0.05] rounded-xl">
            <CheckCircle2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">All caught up!</h3>
            <p className="text-gray-400">No listings pending review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6 hover:border-violet-500/50 transition-colors"
              >
                <div className="flex gap-6">
                  {/* Image */}
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20">
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
                        <h3 className="text-xl font-bold text-white mb-2">{listing.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
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
                    <div className="flex items-center gap-3 mb-4 p-3 bg-white/[0.03] rounded-lg">
                      <User className="w-5 h-5 text-violet-400" />
                      <div>
                        <div className="text-sm font-medium text-white">
                          {listing.seller.username}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">
                          {listing.seller.seller_tier || 'unverified'} seller
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {listing.description && (
                      <p className="text-sm text-gray-300 mb-4 line-clamp-2">
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
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowRejectModal(true)
                        }}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setShowChangesModal(true)
                        }}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Request Changes
                      </button>
                      <Link
                        href={`/${listing.game.slug}/${listing.category.slug}/${listing.slug}`}
                        className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors flex items-center gap-2"
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
            <p className="text-gray-400 mb-4">
              Approve "{selectedListing.title}"?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any internal notes..."
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setApprovalNotes('')
                }}
                className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(selectedListing.id)}
                disabled={actionLoading}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
            <p className="text-gray-400 mb-4">
              Reject "{selectedListing.title}"?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this listing is being rejected..."
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors"
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
            <p className="text-gray-400 mb-4">
              Request changes to "{selectedListing.title}"
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Required Changes *
              </label>
              <textarea
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                placeholder="Describe what needs to be changed..."
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChangesModal(false)
                  setChangeRequest('')
                }}
                className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-lg transition-colors"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-black border border-white/[0.1] rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
