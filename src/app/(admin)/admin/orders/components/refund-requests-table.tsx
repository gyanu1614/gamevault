/**
 * Refund Requests Table — buyers asking for a store-credit refund to go back
 * to their original payment method (refund policy, 2026-09-30). Approve
 * moves the credit out of the wallet and queues the provider refund in ONE
 * RPC (each provider refund costs a fee, so it is never automatic); Reject
 * leaves the credit with the buyer.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUUpLeft, CheckCircle, CircleNotch, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { approveRefundToSource, rejectRefundToSource, type RefundToSourceRequest } from '@/lib/actions/refund-to-source'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { accountInputCls } from '@/components/account/AccountSurface'
import { AdminEmpty, AdminLoadingRows, adminBtn, adminBtnSm, StatusBadge, TABLE, type ChipTone } from '../../components/kit'

type Row = RefundToSourceRequest & {
  order?: { id: string; order_number: string | null; total_amount: number | null; status: string } | null
  buyer?: { id: string; username: string | null; email: string | null } | null
}

interface RefundRequestsTableProps {
  requests: Row[]
  isLoading?: boolean
}

const STATUS_TONE: Record<string, ChipTone> = {
  pending: 'warning',
  approved: 'info',
  sent: 'success',
  failed: 'error',
  rejected: 'neutral',
}

const orderRef = (r: Row) => `#${r.order?.order_number || r.order_id.substring(0, 8)}`
const amount = (r: Row) => `$${(Number(r.amount_minor) / 100).toFixed(2)} ${r.currency}`
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true })

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

  if (isLoading) return <AdminLoadingRows rows={4} />

  if (!requests || requests.length === 0) {
    return (
      <AdminEmpty
        icon={ArrowUUpLeft}
        tone="success"
        title="All clear"
        hint="No buyer has asked for store credit back to their payment method."
      />
    )
  }

  const statusCell = (r: Row) => (
    <>
      <StatusBadge status={r.status} tone={STATUS_TONE[r.status]} />
      {r.status === 'failed' && r.failure_reason && (
        <p className="mt-1 max-w-[240px] text-[12px] text-text-tertiary">{r.failure_reason}</p>
      )}
      {r.status === 'rejected' && r.admin_notes && (
        <p className="mt-1 max-w-[240px] text-[12px] text-text-tertiary">{r.admin_notes}</p>
      )}
    </>
  )

  const actions = (r: Row, full?: boolean) =>
    r.status === 'pending' ? (
      <div className={cn('flex items-center gap-2', full ? 'w-full' : 'justify-end')}>
        <button
          type="button"
          onClick={() => setRejecting(r)}
          disabled={processingId === r.id}
          className={cn(adminBtnSm.danger, full && 'flex-1')}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => approve(r.id)}
          disabled={processingId === r.id}
          className={cn(adminBtnSm.primary, full && 'flex-1')}
        >
          {processingId === r.id ? (
            <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
          )}
          Approve
        </button>
      </div>
    ) : null

  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg bg-bg-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/orders/${r.order_id}`} className="text-[14px] font-semibold text-text-primary">
                  {orderRef(r)}
                </Link>
                <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">
                  {r.buyer?.username || 'Unknown'} · {ago(r.created_at)}
                </p>
              </div>
              <p className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">{amount(r)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[12.5px] text-text-secondary">
                {r.provider} <span className="font-mono text-[11.5px] text-text-tertiary">{r.provider_charge_id}</span>
              </p>
              <div className="shrink-0 text-right">{statusCell(r)}</div>
            </div>
            {r.status === 'pending' && <div className="mt-3">{actions(r, true)}</div>}
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
                    <Link href={`/admin/orders/${r.order_id}`} className="underline-offset-4 hover:underline">
                      {orderRef(r)}
                    </Link>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-[13.5px] text-text-primary">{r.buyer?.username || 'Unknown'}</span>
                      <span className="text-[12px] text-text-tertiary">{r.buyer?.email || '—'}</span>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'whitespace-nowrap tabular-nums text-text-primary')}>{amount(r)}</td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col">
                      <span className="text-[13.5px] text-text-primary">{r.provider}</span>
                      <span className="font-mono text-[11.5px] text-text-tertiary">{r.provider_charge_id}</span>
                    </div>
                  </td>
                  <td className={TABLE.td}>{statusCell(r)}</td>
                  <td className={cn(TABLE.td, 'whitespace-nowrap text-[12.5px] text-text-tertiary')}>{ago(r.created_at)}</td>
                  <td className={cn(TABLE.td, 'text-right')}>
                    {actions(r) ?? <span className="text-[12px] text-text-tertiary">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="max-w-[440px] border-0 p-5 sm:p-6">
          {rejecting && (
            <>
              <DialogTitle className="text-[18px] font-bold">Decline Refund Request</DialogTitle>
              <DialogDescription>
                Order {orderRef(rejecting)}: the store credit stays in the buyer&apos;s Store Balance.
              </DialogDescription>
              <div>
                <label htmlFor="refund-reject-notes" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
                  Reason Shown to the Buyer (Optional)
                </label>
                <textarea
                  id="refund-reject-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={cn(accountInputCls, 'resize-none')}
                  placeholder="e.g. This payment method cannot receive refunds."
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => setRejecting(null)} className={cn(adminBtn.secondary, 'sm:flex-1')}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => reject(rejecting.id)}
                  disabled={processingId === rejecting.id}
                  className={cn(adminBtn.danger, 'sm:flex-1')}
                >
                  {processingId === rejecting.id ? (
                    <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle aria-hidden weight="bold" className="h-4 w-4" />
                  )}
                  Decline
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
