'use client'

/**
 * Admin withdrawals queue — the ops surface for seller payouts.
 *
 * Lifecycle it drives (ledger side in brackets):
 *   pending  → Approve [no journal — hold already sits in payout_clearing]
 *   pending  → Reject  [withdrawal_reversal: clearing → seller]
 *   approved → Mark Paid, after ops actually sends the money
 *              [withdrawal_payout: payout_clearing → external_payout]
 *
 * Mark Paid is the settlement step: skipping it leaves seller money looking
 * in-flight forever, which is why the approved rows get the loud CTA.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Clock, Send, CheckCircle2, Landmark, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  PageHeader,
  AdminPanel,
  StatCard,
  StatusBadge,
  TABLE,
} from '../components/kit'
import {
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  markWithdrawalPaid,
} from '@/lib/actions/withdrawals'

type RequestRow = {
  id: string
  user_id: string
  amount: number
  fee_amount: number
  net_amount: number
  method_name: string
  status: string
  payment_details: Record<string, any> | null
  admin_notes?: string | null
  transaction_hash?: string | null
  created_at: string
  user?: { username?: string | null; email?: string | null } | null
  method?: { display_name?: string | null } | null
}

type DialogState =
  | { kind: 'approve'; row: RequestRow }
  | { kind: 'reject'; row: RequestRow }
  | { kind: 'paid'; row: RequestRow }
  | null

const FILTERS = ['all', 'pending', 'approved', 'completed', 'rejected', 'cancelled'] as const

const usd = (n: number | string | null | undefined) =>
  `$${(Number(n) || 0).toFixed(2)}`

const OPEN_STATUSES = ['pending', 'approved', 'processing']

export default function WithdrawalsClient({
  initialRequests,
}: {
  initialRequests: RequestRow[]
}) {
  const [requests, setRequests] = useState<RequestRow[]>(initialRequests)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [reason, setReason] = useState('')
  const [txRef, setTxRef] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, startTransition] = useTransition()

  const stats = useMemo(() => {
    const by = (s: string) => requests.filter((r) => r.status === s)
    const sum = (rows: RequestRow[]) => rows.reduce((t, r) => t + (Number(r.amount) || 0), 0)
    const open = requests.filter((r) => OPEN_STATUSES.includes(r.status))
    return {
      pending: by('pending').length,
      approved: by('approved').length,
      approvedSum: sum(by('approved')),
      paidSum: sum(by('completed')),
      clearingSum: sum(open),
    }
  }, [requests])

  const visible = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  )

  const refresh = async () => {
    const result = await getAllWithdrawalRequests()
    if (result.success && result.requests) setRequests(result.requests as RequestRow[])
  }

  const closeDialog = () => {
    setDialog(null)
    setReason('')
    setTxRef('')
    setNotes('')
  }

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      toast.success(done)
      closeDialog()
      await refresh()
    })
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
    toast.success('Copied.')
  }

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        description="Approve requests, then Mark Paid once the money is actually sent — that settles the ledger."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending Review" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard
          label="Awaiting Payout"
          value={stats.approved}
          sub={`${usd(stats.approvedSum)} to send`}
          icon={Send}
          tone="lime"
        />
        <StatCard label="Paid Out" value={usd(stats.paidSum)} icon={CheckCircle2} tone="success" />
        <StatCard
          label="In Clearing"
          value={usd(stats.clearingSum)}
          sub="open requests holding funds"
          icon={Landmark}
          tone="info"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? 'rounded-lg border border-lime-tint-border bg-lime-tint-bg px-3 py-1.5 text-[12.5px] font-semibold capitalize text-lime-text'
                : 'rounded-lg border border-border-default bg-bg-raised px-3 py-1.5 text-[12.5px] font-semibold capitalize text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary'
            }
          >
            {f}
          </button>
        ))}
      </div>

      <AdminPanel pad={false}>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-text-tertiary">
            No withdrawal requests{filter === 'all' ? ' yet' : ` with status “${filter}”`}.
          </p>
        ) : (
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Requested</th>
                  <th className={TABLE.th}>Seller</th>
                  <th className={TABLE.th}>Method</th>
                  <th className={TABLE.th}>Destination</th>
                  <th className={TABLE.th}>Amount</th>
                  <th className={TABLE.th}>Net</th>
                  <th className={TABLE.th}>Status</th>
                  <th className={TABLE.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className={TABLE.row}>
                    <td className={TABLE.td}>
                      {new Date(row.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className={TABLE.tdPrimary}>
                      <div>{row.user?.username || '—'}</div>
                      <div className="text-[11.5px] font-normal text-text-tertiary">
                        {row.user?.email}
                      </div>
                    </td>
                    <td className={TABLE.td}>{row.method?.display_name || row.method_name}</td>
                    <td className={TABLE.td}>
                      <Destination details={row.payment_details} onCopy={copy} />
                    </td>
                    <td className={`${TABLE.td} tabular-nums`}>
                      <div>{usd(row.amount)}</div>
                      <div className="text-[11.5px] text-text-tertiary">
                        fee {usd(row.fee_amount)}
                      </div>
                    </td>
                    <td className={`${TABLE.tdPrimary} tabular-nums`}>{usd(row.net_amount)}</td>
                    <td className={TABLE.td}>
                      <StatusBadge status={row.status} />
                      {row.transaction_hash && (
                        <div
                          className="mt-1 max-w-[140px] truncate font-mono text-[10.5px] text-text-tertiary"
                          title={row.transaction_hash}
                        >
                          {row.transaction_hash}
                        </div>
                      )}
                    </td>
                    <td className={TABLE.td}>
                      <div className="flex gap-1.5">
                        {row.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => setDialog({ kind: 'approve', row })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-error"
                              disabled={busy}
                              onClick={() => setDialog({ kind: 'reject', row })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(row.status === 'approved' || row.status === 'processing') && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => setDialog({ kind: 'paid', row })}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* Approve */}
      <Dialog open={dialog?.kind === 'approve'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
            <DialogDescription>
              {dialog && (
                <>
                  {usd(dialog.row.amount)} for {dialog.row.user?.username || 'seller'} — the funds
                  are already held. Approving queues it for sending; the ledger settles when you
                  Mark Paid.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                dialog &&
                run(
                  () =>
                    approveWithdrawalRequest({
                      requestId: dialog.row.id,
                      adminNotes: notes.trim() || undefined,
                    }),
                  'Withdrawal approved.',
                )
              }
            >
              {busy ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={dialog?.kind === 'reject'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>
              {dialog && (
                <>
                  {usd(dialog.row.amount)} for {dialog.row.user?.username || 'seller'} — the held
                  funds go back to their balance and the seller is told why.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to the seller)"
            rows={2}
            className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() =>
                dialog &&
                run(
                  () =>
                    rejectWithdrawalRequest({ requestId: dialog.row.id, reason: reason.trim() }),
                  'Withdrawal rejected — funds released back to the seller.',
                )
              }
            >
              {busy ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid */}
      <Dialog open={dialog?.kind === 'paid'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Paid</DialogTitle>
            <DialogDescription>
              {dialog && (
                <>
                  Confirms you sent {usd(dialog.row.net_amount)} (net of fees) to the destination
                  below. This settles the ledger — only do it after the money has actually left.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === 'paid' && (
            <div className="rounded-lg border border-border-subtle bg-bg-overlay px-3 py-2.5 text-[12.5px]">
              <Destination details={dialog.row.payment_details} onCopy={copy} />
            </div>
          )}
          <input
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
            placeholder="Tx hash / payment reference (optional)"
            className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 font-mono text-[12.5px] text-text-primary placeholder:font-sans placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                dialog &&
                run(
                  () =>
                    markWithdrawalPaid({
                      requestId: dialog.row.id,
                      transactionHash: txRef.trim() || undefined,
                      adminNotes: notes.trim() || undefined,
                    }),
                  'Payout settled — request completed.',
                )
              }
            >
              {busy ? 'Settling…' : 'Money Sent — Mark Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Compact renderer for payment_details — crypto gets address+network+copy,
 *  anything else falls back to key/value pairs. */
function Destination({
  details,
  onCopy,
}: {
  details: Record<string, any> | null
  onCopy: (text: string) => void
}) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-text-tertiary">—</span>
  }
  if (details.wallet_address) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="min-w-0">
          <div
            className="max-w-[180px] truncate font-mono text-[12px] text-text-primary"
            title={details.wallet_address}
          >
            {details.wallet_address}
          </div>
          <div className="text-[11px] uppercase text-text-tertiary">
            {[details.coin, details.network].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          onClick={() => onCopy(details.wallet_address)}
          className="shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
          title="Copy address"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  return (
    <div className="max-w-[220px] text-[12px]">
      {Object.entries(details).map(([k, v]) => (
        <div key={k} className="truncate" title={`${k}: ${String(v)}`}>
          <span className="text-text-tertiary">{k.replace(/_/g, ' ')}:</span>{' '}
          <span className="text-text-primary">{String(v)}</span>
        </div>
      ))}
    </div>
  )
}
