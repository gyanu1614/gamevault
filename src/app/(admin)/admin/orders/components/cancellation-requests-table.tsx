/**
 * Cancellation Requests Table Component
 *
 * Displays pending cancellation requests from buyers
 * Admin can approve or reject requests
 */

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { processCancellationRequest } from '@/lib/actions/order-cancellation'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { TABLE } from '../../components/kit'

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
      <div className="rounded-xl border border-border-default bg-bg-raised p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-border-default border-t-lime"></div>
          <p className="text-sm text-text-tertiary mt-3">Loading cancellation requests...</p>
        </div>
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-raised p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
            <CheckCircle className="h-6 w-6 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">All Clear!</h3>
          <p className="text-sm text-text-tertiary">No pending cancellation requests</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border-default bg-bg-raised overflow-hidden">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>
                  Order
                </th>
                <th className={TABLE.th}>
                  Buyer
                </th>
                <th className={TABLE.th}>
                  Reason
                </th>
                <th className={TABLE.th}>
                  Requested
                </th>
                <th className={cn(TABLE.th, 'text-right')}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">
                        #{request.order?.order_number || request.order_id.substring(0, 8)}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        ${request.order?.total_amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-sm text-text-primary">
                        {request.order?.buyer?.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {request.order?.buyer?.email || '—'}
                      </span>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'max-w-xs')}>
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-text-secondary line-clamp-2">
                        {request.reason}
                      </p>
                      <button
                        onClick={() => setShowReasonModal(request)}
                        className="flex-shrink-0 p-1 rounded hover:bg-bg-overlay text-text-tertiary hover:text-text-secondary"
                        title="View full reason"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <span className="text-xs text-text-tertiary">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleProcess(request.id, 'approve')}
                        disabled={processingId === request.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setShowReasonModal(null)
            setAdminNotes('')
          }}
        >
          <div
            className="bg-bg-raised border border-border-default rounded-xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-text-primary mb-4">Cancellation Request</h3>

            <div className="space-y-4">
              {/* Order Info */}
              <div className="p-3 bg-bg-overlay border border-border-subtle rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-tertiary">Order</span>
                  <span className="text-sm font-medium text-text-primary">
                    #{showReasonModal.order?.order_number || showReasonModal.order_id.substring(0, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Buyer</span>
                  <span className="text-sm text-text-primary">
                    {showReasonModal.order?.buyer?.username || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Buyer's Reason */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Buyer&apos;s Reason:
                </label>
                <div className="p-3 bg-bg-overlay border border-border-subtle rounded-lg">
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{showReasonModal.reason}</p>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label htmlFor="admin-notes" className="block text-xs font-medium text-text-secondary mb-2">
                  Admin Notes (optional):
                </label>
                <textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:border-lime focus:outline-none"
                  rows={3}
                  maxLength={500}
                  disabled={processingId === showReasonModal.id}
                />
                <div className="text-xs text-text-tertiary mt-1 text-right">{adminNotes.length}/500</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowReasonModal(null)
                    setAdminNotes('')
                  }}
                  disabled={processingId === showReasonModal.id}
                  className="flex-1 py-2.5 border border-border-default bg-bg-overlay hover:bg-bg-raised-hover text-text-secondary rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
