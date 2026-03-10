/**
 * Cancellation Requests Table Component
 *
 * Displays pending cancellation requests from buyers
 * Admin can approve or reject requests
 */

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, Loader2, Eye, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { processCancellationRequest } from '@/lib/actions/order-cancellation'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface CancellationRequest {
  id: string
  order_id: string
  buyer_id: string
  reason: string
  status: string
  created_at: string
  order?: any
}

interface CancellationRequestsTableProps {
  requests: CancellationRequest[]
  isLoading?: boolean
}

export function CancellationRequestsTable({ requests, isLoading }: CancellationRequestsTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showReasonModal, setShowReasonModal] = useState<CancellationRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const queryClient = useQueryClient()

  const handleProcess = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId)
    try {
      const { data, error } = await processCancellationRequest(requestId, action, adminNotes || undefined)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success(`Cancellation request ${action}d successfully`)
        setAdminNotes('')
        setShowReasonModal(null)
        // Refetch requests
        queryClient.invalidateQueries({ queryKey: ['admin-cancellation-requests'] })
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request')
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-amber-500 border-r-transparent"></div>
          <p className="text-sm text-gray-500 mt-3">Loading cancellation requests...</p>
        </div>
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
            <CheckCircle className="h-6 w-6 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">All Clear!</h3>
          <p className="text-sm text-gray-500">No pending cancellation requests</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        #{request.order?.order_number || request.order_id.substring(0, 8)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ${request.order?.total_amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white">
                        {request.order?.buyer?.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {request.order?.buyer?.email || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {request.reason}
                      </p>
                      <button
                        onClick={() => setShowReasonModal(request)}
                        className="flex-shrink-0 p-1 rounded hover:bg-white/[0.05] text-gray-500 hover:text-gray-400"
                        title="View full reason"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleProcess(request.id, 'approve')}
                        disabled={processingId === request.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setShowReasonModal(request)
                        }}
                        disabled={processingId === request.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason Modal with Approve/Reject */}
      {showReasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => {
            setShowReasonModal(null)
            setAdminNotes('')
          }}
        >
          <div
            className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">Cancellation Request</h3>

            <div className="space-y-4">
              {/* Order Info */}
              <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Order</span>
                  <span className="text-sm font-medium text-white">
                    #{showReasonModal.order?.order_number || showReasonModal.order_id.substring(0, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Buyer</span>
                  <span className="text-sm text-white">
                    {showReasonModal.order?.buyer?.username || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Buyer's Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Buyer's Reason:
                </label>
                <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{showReasonModal.reason}</p>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label htmlFor="admin-notes" className="block text-xs font-medium text-gray-400 mb-2">
                  Admin Notes (optional):
                </label>
                <textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  rows={3}
                  maxLength={500}
                  disabled={processingId === showReasonModal.id}
                />
                <div className="text-xs text-gray-600 mt-1 text-right">{adminNotes.length}/500</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowReasonModal(null)
                    setAdminNotes('')
                  }}
                  disabled={processingId === showReasonModal.id}
                  className="flex-1 py-2.5 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.05] text-gray-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleProcess(showReasonModal.id, 'reject')}
                  disabled={processingId === showReasonModal.id}
                  className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingId === showReasonModal.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Reject
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleProcess(showReasonModal.id, 'approve')}
                  disabled={processingId === showReasonModal.id}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingId === showReasonModal.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve & Cancel Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
