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
import { Copy, HandCoins } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  AdminPanel,
  AdminEmpty,
  StatusBadge,
  TABLE,
  adminBtn,
  adminBtnSm,
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
  payment_reference?: string | null
  /** PR 7 — withdrawal_risk_snapshot(seller). */
  risk?: {
    account_age_days?: number | null
    completed_sales?: number
    completed_sales_total?: number
    open_disputes?: number
    refund_rate_90d?: number
    payout_details_changed_recently?: boolean
    matured_minor?: number
  } | null
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

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const DIALOG_CLS = 'max-w-[480px] border-0 p-5 sm:p-6'

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length }
    for (const f of FILTERS) if (f !== 'all') c[f] = requests.filter((r) => r.status === f).length
    return c
  }, [requests])

  const actions = (row: RequestRow, full?: boolean) => {
    if (row.status === 'pending') {
      return (
        <div className={cn('flex gap-2', full && 'w-full')}>
          <button
            type="button"
            className={cn(adminBtnSm.danger, full && 'flex-1')}
            disabled={busy}
            onClick={() => setDialog({ kind: 'reject', row })}
          >
            Reject
          </button>
          <button
            type="button"
            className={cn(adminBtnSm.secondary, full && 'flex-1')}
            disabled={busy}
            onClick={() => setDialog({ kind: 'approve', row })}
          >
            Approve
          </button>
        </div>
      )
    }
    if (row.status === 'approved' || row.status === 'processing') {
      return (
        <button
          type="button"
          className={cn(adminBtnSm.primary, full && 'w-full')}
          disabled={busy}
          onClick={() => setDialog({ kind: 'paid', row })}
        >
          Mark Paid
        </button>
      )
    }
    return null
  }

  const reference = (row: RequestRow) =>
    (row.payment_reference || row.transaction_hash) && (
      <div
        className="mt-1 max-w-[160px] truncate font-mono text-[11.5px] text-text-tertiary"
        title={row.payment_reference || row.transaction_hash || ''}
      >
        {row.payment_reference || row.transaction_hash}
      </div>
    )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Withdrawals"
        description="Approve requests, then Mark Paid once the money is actually sent. That settles the ledger."
        className="mb-0 sm:mb-0"
      />

      <StatStrip
        stats={[
          { label: 'Pending Review', value: stats.pending },
          { label: 'Awaiting Payout', value: stats.approved, hint: `${usd(stats.approvedSum)} to send` },
          { label: 'Paid Out', value: usd(stats.paidSum) },
          { label: 'In Clearing', value: usd(stats.clearingSum), hint: 'Open requests holding funds' },
        ]}
      />

      <SegmentedTabs
        tabs={FILTERS.map((f) => ({
          id: f,
          label: (
            <>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {counts[f] > 0 && <TabCount n={counts[f]} />}
            </>
          ),
        }))}
        value={filter}
        onChange={setFilter}
        layoutId="admin-withdrawals-filter"
        ariaLabel="Withdrawal status"
      />

      {visible.length === 0 ? (
        <AdminEmpty
          icon={HandCoins}
          title={filter === 'all' ? 'No withdrawal requests yet' : `No ${filter} withdrawals`}
          hint="Sellers’ payout requests show up here."
        />
      ) : (
        <>
          {/* Below xl: cards */}
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:hidden">
            {visible.map((row) => (
              <li key={row.id} className="flex flex-col rounded-lg bg-bg-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-text-primary">{row.user?.username || '—'}</p>
                    <p className="truncate text-[12.5px] text-text-tertiary">
                      {row.method?.display_name || row.method_name} · {shortDate(row.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold tabular-nums text-text-primary">{usd(row.net_amount)}</p>
                    <p className="text-[12px] tabular-nums text-text-tertiary">
                      {usd(row.amount)} − {usd(row.fee_amount)} fee
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-md bg-bg-overlay px-3 py-2.5">
                  <Destination details={row.payment_details} onCopy={copy} />
                </div>
                <div className="mt-3">
                  <RiskCell risk={row.risk} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <div className="min-w-0">
                    <StatusBadge status={row.status} />
                    {reference(row)}
                  </div>
                  {actions(row)}
                </div>
              </li>
            ))}
          </ul>

          {/* xl+: table */}
          <AdminPanel pad={false} className="hidden overflow-hidden xl:block">
            <div className={TABLE.wrap}>
              <table className={TABLE.table}>
                <thead>
                  <tr>
                    <th className={TABLE.th}>Seller</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Destination</th>
                    <th className={cn(TABLE.th, 'text-right')}>Net</th>
                    <th className={TABLE.th}>Risk</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={cn(TABLE.th, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className={TABLE.row}>
                      <td className={TABLE.tdPrimary}>
                        <div className="max-w-[180px] truncate">{row.user?.username || '—'}</div>
                        <div className="text-[12px] font-normal text-text-tertiary">{shortDate(row.created_at)}</div>
                      </td>
                      <td className={cn(TABLE.td, 'whitespace-nowrap')}>{row.method?.display_name || row.method_name}</td>
                      <td className={TABLE.td}>
                        <Destination details={row.payment_details} onCopy={copy} />
                      </td>
                      <td className={cn(TABLE.td, 'whitespace-nowrap text-right tabular-nums')}>
                        <div className="font-semibold text-text-primary">{usd(row.net_amount)}</div>
                        <div className="text-[12px] text-text-tertiary">
                          {usd(row.amount)} − {usd(row.fee_amount)}
                        </div>
                      </td>
                      <td className={TABLE.td}>
                        <RiskCell risk={row.risk} />
                      </td>
                      <td className={TABLE.td}>
                        <StatusBadge status={row.status} />
                        {reference(row)}
                      </td>
                      <td className={TABLE.td}>
                        <div className="flex justify-end">{actions(row)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </>
      )}

      {/* Approve */}
      <Dialog open={dialog?.kind === 'approve'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className={DIALOG_CLS}>
          <DialogTitle className="text-[18px] font-bold">Approve Withdrawal</DialogTitle>
          <DialogDescription>
            {dialog && (
              <>
                {usd(dialog.row.amount)} for {dialog.row.user?.username || 'seller'}. The funds are already held.
                Approving queues it for sending; the ledger settles when you Mark Paid.
              </>
            )}
          </DialogDescription>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
            aria-label="Internal notes"
            rows={2}
            className={cn(accountInputCls, 'resize-none')}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={adminBtn.secondary} onClick={closeDialog} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={adminBtn.primary}
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
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={dialog?.kind === 'reject'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className={DIALOG_CLS}>
          <DialogTitle className="text-[18px] font-bold">Reject Withdrawal</DialogTitle>
          <DialogDescription>
            {dialog && (
              <>
                {usd(dialog.row.amount)} for {dialog.row.user?.username || 'seller'}. The held funds go back to their
                balance and the seller is told why.
              </>
            )}
          </DialogDescription>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to the seller)"
            aria-label="Reason shown to the seller"
            rows={2}
            className={cn(accountInputCls, 'resize-none')}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={adminBtn.secondary} onClick={closeDialog} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={adminBtn.danger}
              disabled={busy || !reason.trim()}
              onClick={() =>
                dialog &&
                run(
                  () => rejectWithdrawalRequest({ requestId: dialog.row.id, reason: reason.trim() }),
                  'Withdrawal rejected — funds released back to the seller.',
                )
              }
            >
              {busy ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Paid */}
      <Dialog open={dialog?.kind === 'paid'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className={DIALOG_CLS}>
          <DialogTitle className="text-[18px] font-bold">Mark Paid</DialogTitle>
          <DialogDescription>
            {dialog && (
              <>
                Confirms you sent {usd(dialog.row.net_amount)} (net of fees) to the destination below. This settles the
                ledger, so only do it after the money has actually left.
              </>
            )}
          </DialogDescription>
          {dialog?.kind === 'paid' && (
            <div className="rounded-md bg-bg-overlay px-3.5 py-3">
              <Destination details={dialog.row.payment_details} onCopy={copy} full />
            </div>
          )}
          <input
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
            placeholder="Tx hash or Payoneer payment reference (sent to the seller)"
            aria-label="Payment reference"
            className={cn(accountInputCls, 'font-mono placeholder:font-sans')}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
            aria-label="Internal notes"
            rows={2}
            className={cn(accountInputCls, 'resize-none')}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={adminBtn.secondary} onClick={closeDialog} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={adminBtn.primary}
              disabled={busy}
              onClick={() =>
                dialog &&
                run(
                  () =>
                    markWithdrawalPaid({
                      requestId: dialog.row.id,
                      reference: txRef.trim(),
                      adminNotes: notes.trim() || undefined,
                    }),
                  'Payout settled — request completed.',
                )
              }
            >
              {busy ? 'Settling…' : 'Money Sent — Mark Paid'}
            </button>
          </div>
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
  full,
}: {
  details: Record<string, any> | null
  onCopy: (text: string) => void
  /** Mark Paid dialog: show every value whole (it is what gets paid to). */
  full?: boolean
}) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-text-tertiary">—</span>
  }
  if (details.wallet_address) {
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'font-mono text-[12px] text-text-primary',
              full ? 'break-all' : 'max-w-full truncate xl:max-w-[180px]',
            )}
            title={details.wallet_address}
          >
            {details.wallet_address}
          </div>
          <div className="text-[11.5px] uppercase text-text-tertiary">
            {[details.coin, details.network].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCopy(details.wallet_address)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          aria-label="Copy address"
        >
          <Copy aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  return (
    <div className={cn('max-w-full text-[12.5px]', !full && 'xl:max-w-[220px]')}>
      {Object.entries(details).map(([k, v]) => (
        <div key={k} className={full ? 'break-all' : 'truncate'} title={`${k}: ${String(v)}`}>
          <span className="text-text-tertiary">{k.replace(/_/g, ' ')}:</span>{' '}
          <span className="text-text-primary">{String(v)}</span>
        </div>
      ))}
    </div>
  )
}


/** PR 7 — compact risk snapshot: age · sales · disputes · refund rate · recent detail change. */
function RiskCell({ risk }: { risk: RequestRow['risk'] }) {
  if (!risk) return <span className="text-[12.5px] text-text-tertiary">No risk data</span>
  const age = risk.account_age_days ?? null
  const flags: string[] = []
  if (age != null && age < 30) flags.push('new')
  if ((risk.open_disputes ?? 0) > 0) flags.push(`${risk.open_disputes} open dispute${risk.open_disputes === 1 ? '' : 's'}`)
  if ((risk.refund_rate_90d ?? 0) >= 0.1) flags.push(`${Math.round((risk.refund_rate_90d ?? 0) * 100)}% refunds`)
  if (risk.payout_details_changed_recently) flags.push('payout details changed <7d')
  if ((risk.matured_minor ?? 0) < 0) flags.push('negative balance')
  return (
    <div className="min-w-[150px] text-[12px] leading-snug">
      <div className="text-text-secondary">
        {age == null ? 'age —' : `${age}d old`} · {risk.completed_sales ?? 0} sales ({usd(risk.completed_sales_total ?? 0)})
      </div>
      {flags.length ? (
        <div className="mt-0.5 font-medium text-warning">{flags.join(' · ')}</div>
      ) : (
        <div className="mt-0.5 text-text-tertiary">No flags</div>
      )}
    </div>
  )
}
