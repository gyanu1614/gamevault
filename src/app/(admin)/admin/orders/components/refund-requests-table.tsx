/**
 * Refund Requests Table — buyers asking for a store-credit refund to go back
 * to their original payment method (refund policy, 2026-09-30). Approve
 * moves the credit out of the wallet and queues the provider refund in ONE
 * RPC (each provider refund costs a fee, so it is never automatic); Reject
 * leaves the credit with the buyer.
 */

'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { approveRefundToSource, rejectRefundToSource, type RefundToSourceRequest } from '@/lib/actions/refund-to-source'
import { cn } from '@/lib/utils'
import { TABLE } from '../../components/kit'

type Row = RefundToSourceRequest & {
  order?: { id: string; order_number: string | null; total_amount: number | null; status: string } | null
  buyer?: { id: string; username: string | null; email: string | null } | null
}

interface RefundRequestsTableProps {
  requests: Row[]
  isLoading?: boolean
}

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-blue-500/10 text-blue-400',
  sent: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
  rejected: 'bg-white/[0.06] text-text-tertiary',
}

export function RefundRequestsTable({ requests, isLoading }: RefundRequestsTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  const done = () => {
    setRejecting(null)
    setNotes('')
    queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] })
  }

  const approve = async (id: string) => {
    setProcessingId(id)
    try {
      const r = await approveRefundToSource(id)
      if (!r.success) toast.error(r.error ?? 'Could not approve')
      else toast.success('Refund approved — sending it to the provider')
      done()
    } finally {
      setProcessingId(null)
    }
  }

  const reject = async (id: string) => {
    setProcessingId(id)
    try {
      const r = await rejectRefundToSource(id, notes || undefined)
      if (!r.success) toast.error(r.error ?? 'Could not reject')
      else toast.success('Refund request declined — the store credit stays with the buyer')
      done()
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-raised p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-border-default border-t-lime"></div>
          <p className="mt-3 text-sm text-text-tertiary">Loading refund requests...</p>
        </div>
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-raised p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle className="h-6 w-6 text-green-400" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-text-primary">All Clear!</h3>
          <p className="text-sm text-text-tertiary">No refund-to-payment-method requests</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Order</th>
                <th className={TABLE.th}>Buyer</th>
                <th className={TABLE.th}>Amount</th>
                <th className={TABLE.th}>Method</th>
                <th className={TABLE.th}>Status</th>
                <th className={TABLE.th}>Requested</th>
                <th className={cn(TABLE.th, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>
                    <a href={`/admin/orders/${r.order_id}`} className="text-sm font-medium text-text-primary hover:underline">
                      #{r.order?.order_number || r.order_id.substring(0, 8)}
                    </a>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-sm text-text-primary">{r.buyer?.username || 'Unknown'}</span>
                      <span className="text-xs text-text-tertiary">{r.buyer?.email || '—'}</span>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'tabular-nums')}>
                    ${(Number(r.amount_minor) / 100).toFixed(2)} {r.currency}
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-sm text-text-primary">{r.provider}</span>
                      <span className="font-mono text-[11px] text-text-tertiary">{r.provider_charge_id}</span>
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize', STATUS_TONE[r.status])}>
                      {r.status}
                    </span>
                    {r.status === 'failed' && r.failure_reason && (
                      <p className="mt-1 max-w-[220px] text-[11px] text-text-tertiary">{r.failure_reason}</p>
                    )}
                    {r.status === 'rejected' && r.admin_notes && (
                      <p className="mt-1 max-w-[220px] text-[11px] text-text-tertiary">{r.admin_notes}</p>
                    )}
                  </td>
                  <td className={cn(TABLE.td, 'text-text-tertiary')}>
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className={cn(TABLE.td, 'text-right')}>
                    {r.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setRejecting(r)}
                          disabled={processingId === r.id}
                          className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => approve(r.id)}
                          disabled={processingId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                        >
                          {processingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-raised p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-text-primary">Decline Refund Request</h3>
            <p className="mt-1 text-sm text-text-tertiary">
              Order #{rejecting.order?.order_number || rejecting.order_id.substring(0, 8)} — the store credit stays in the buyer&apos;s Store Balance.
            </p>
            <label htmlFor="refund-reject-notes" className="mt-4 block text-xs font-medium text-text-secondary">
              Reason shown to the buyer (optional)
            </label>
            <textarea
              id="refund-reject-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-2 w-full resize-none rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-focus-border focus:outline-none"
              placeholder="e.g. This payment method cannot receive refunds."
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setRejecting(null)}
                className="flex-1 rounded-lg border border-border-default bg-bg-overlay py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-raised-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => reject(rejecting.id)}
                disabled={processingId === rejecting.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {processingId === rejecting.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
