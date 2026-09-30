/**
 * Cancellation Requests Table Component
 *
 * Displays pending cancellation requests from buyers
 * Admin can approve or reject requests
 */

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, CircleNotch, Eye, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { processCancellationRequest } from '@/lib/actions/order-cancellation'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { accountInputCls } from '@/components/account/AccountSurface'
import { AdminEmpty, AdminLoadingRows, adminBtn, adminBtnSm, TABLE } from '../../components/kit'

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

const orderRef = (r: CancellationRequest) => `#${r.order?.order_number || r.order_id.substring(0, 8)}`
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true })

export function CancellationRequestsTable({ requests, isLoading }: CancellationRequestsTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showReasonModal, setShowReasonModal] = useState<CancellationRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  // Refund policy: who is at fault decides the refund. Off = the buyer
  // changed their mind (item price back, service fee kept). On = the seller
  // went quiet / could not deliver (everything back, counts against the
  // seller's non-delivery record).
  const [sellerFault, setSellerFault] = useState(false)
  const queryClient = useQueryClient()

  const handleProcess = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId)
    try {
      const { data, error } = await processCancellationRequest(requestId, action, adminNotes || undefined, sellerFault ? 'seller' : 'buyer')

      if (error) {
        toast.error(error.message)
      } else {
        toast.success(`Cancellation request ${action}d successfully`)
        setAdminNotes('')
        setSellerFault(false)
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

  const closeModal = () => {
    setShowReasonModal(null)
    setAdminNotes('')
  }

  if (isLoading) return <AdminLoadingRows rows={4} />

  if (!requests || requests.length === 0) {
    return <AdminEmpty icon={CheckCircle} tone="success" title="All clear" hint="No buyer is waiting on a cancellation." />
  }

  const actions = (request: CancellationRequest, full?: boolean) => (
    <div className={cn('flex items-center gap-2', full ? 'w-full' : 'justify-end')}>
      <button
        type="button"
        onClick={() => setShowReasonModal(request)}
        disabled={processingId === request.id}
        className={cn(adminBtnSm.danger, full && 'flex-1')}
      >
        <XCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Reject
      </button>
      <button
        type="button"
        onClick={() => handleProcess(request.id, 'approve')}
        disabled={processingId === request.id}
        className={cn(adminBtnSm.primary, full && 'flex-1')}
      >
        {processingId === request.id ? (
          <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
        )}
        Approve
      </button>
    </div>
  )

  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {requests.map((request) => (
          <li key={request.id} className="rounded-lg bg-bg-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">{orderRef(request)}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">
                  {request.order?.buyer?.username || 'Unknown'} · {ago(request.created_at)}
                </p>
              </div>
              <p className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                ${request.order?.total_amount?.toFixed(2) || '0.00'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReasonModal(request)}
              className="mt-3 block w-full rounded-md bg-bg-overlay px-3 py-2.5 text-left text-[13px] leading-relaxed text-text-secondary"
            >
              <span className="line-clamp-3">{request.reason}</span>
            </button>
            <div className="mt-3">{actions(request, true)}</div>
          </li>
        ))}
      </ul>

      {/* md+: table */}
      <div className="hidden overflow-hidden rounded-lg bg-bg-raised md:block">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Order</th>
                <th className={TABLE.th}>Buyer</th>
                <th className={TABLE.th}>Reason</th>
                <th className={TABLE.th}>Requested</th>
                <th className={cn(TABLE.th, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>
                    <div className="flex flex-col">
                      <span className="text-[13.5px] font-semibold text-text-primary">{orderRef(request)}</span>
                      <span className="text-[12px] tabular-nums text-text-tertiary">
                        ${request.order?.total_amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-[13.5px] text-text-primary">{request.order?.buyer?.username || 'Unknown'}</span>
                      <span className="text-[12px] text-text-tertiary">{request.order?.buyer?.email || '—'}</span>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'max-w-xs')}>
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 text-[13px] text-text-secondary">{request.reason}</p>
                      <button
                        type="button"
                        onClick={() => setShowReasonModal(request)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                        aria-label="View full reason"
                      >
                        <Eye aria-hidden weight="bold" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'whitespace-nowrap text-[12.5px] text-text-tertiary')}>{ago(request.created_at)}</td>
                  <td className={TABLE.td}>{actions(request)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason + decision */}
      <Dialog open={!!showReasonModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
          {showReasonModal && (
            <>
              <DialogTitle className="text-[18px] font-bold">Cancellation Request</DialogTitle>
              <DialogDescription>
                {orderRef(showReasonModal)} · {showReasonModal.order?.buyer?.username || 'Unknown'}
              </DialogDescription>

              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-text-secondary">Buyer’s Reason</p>
                  <p className="whitespace-pre-wrap rounded-md bg-bg-overlay px-3.5 py-3 text-[13.5px] leading-relaxed text-text-primary">
                    {showReasonModal.reason}
                  </p>
                </div>

                {/* Fault → refund amount (refund policy) */}
                <label className="flex cursor-pointer items-start gap-3 rounded-md bg-bg-overlay p-3.5">
                  <input
                    type="checkbox"
                    checked={sellerFault}
                    onChange={(e) => setSellerFault(e.target.checked)}
                    disabled={processingId === showReasonModal.id}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-lime"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-text-primary">Seller At Fault</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-tertiary">
                      On approve: the buyer gets everything back including the service fee, and this counts against the
                      seller&apos;s non-delivery record. Leave off when the buyer simply changed their mind (item price back,
                      service fee kept).
                    </span>
                  </span>
                </label>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label htmlFor="admin-notes" className="text-[13px] font-medium text-text-secondary">
                      Admin Notes (Optional)
                    </label>
                    <span className="text-[12px] tabular-nums text-text-tertiary">{adminNotes.length}/500</span>
                  </div>
                  <textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about your decision…"
                    className={cn(accountInputCls, 'resize-none')}
                    rows={3}
                    maxLength={500}
                    disabled={processingId === showReasonModal.id}
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={processingId === showReasonModal.id}
                    className={cn(adminBtn.secondary, 'sm:flex-1')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcess(showReasonModal.id, 'reject')}
                    disabled={processingId === showReasonModal.id}
                    className={cn(adminBtn.danger, 'sm:flex-1')}
                  >
                    {processingId === showReasonModal.id ? (
                      <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle aria-hidden weight="bold" className="h-4 w-4" />
                    )}
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcess(showReasonModal.id, 'approve')}
                    disabled={processingId === showReasonModal.id}
                    className={cn(adminBtn.primary, 'sm:flex-[1.4]')}
                  >
                    {processingId === showReasonModal.id ? (
                      <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
                    )}
                    Approve & Cancel Order
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
