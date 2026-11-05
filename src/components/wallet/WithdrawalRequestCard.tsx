'use client'

/**
 * One withdrawal as one row, and its details in a dialog: the status as a timeline
 * (a real sequence, so it reads as one), the sum, the transaction ID to copy, any
 * note from our team, and Cancel while it is still pending.
 *
 * `table` lines the row up under the wallet's column headers; without it the row
 * stacks, for narrower places like the withdrawal page.
 */

import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusPill, accountBtn, type IconTileTone } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import CoinBadge from '@/components/wallet/CoinBadge'
import { cancelWithdrawalRequest, type WithdrawalRequest } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'

const STATUS: Record<string, { label: string; tone: IconTileTone }> = {
  pending: { label: 'Pending', tone: 'trust' },
  approved: { label: 'Approved', tone: 'trust' },
  processing: { label: 'Processing', tone: 'speed' },
  completed: { label: 'Completed', tone: 'money' },
  rejected: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
}

const money = (n: number) => `$${Number(n).toFixed(2)}`
const day = (iso: string) => format(new Date(iso), 'MMM d, yyyy')
const moment = (iso: string) => format(new Date(iso), 'MMM d, yyyy, h:mm a')

export const WITHDRAWAL_TABLE_GRID = 'md:grid-cols-[minmax(0,1fr)_108px_124px_112px_16px]'

type StepState = 'done' | 'current' | 'upcoming' | 'stopped'

/** Where this withdrawal is on its way to being paid. */
function timeline(request: WithdrawalRequest): { label: string; at?: string | null; state: StepState }[] {
  const submitted = { label: 'Submitted', at: request.created_at, state: 'done' as const }
  switch (request.status) {
    case 'rejected':
      return [submitted, { label: 'Declined', at: request.rejected_at, state: 'stopped' }]
    case 'cancelled':
      return [submitted, { label: 'Cancelled', at: request.updated_at, state: 'stopped' }]
    case 'failed':
      return [submitted, { label: 'Failed', at: request.updated_at, state: 'stopped' }]
    case 'completed':
      return [submitted, { label: 'Reviewed', at: request.approved_at, state: 'done' }, { label: 'Paid', at: request.completed_at, state: 'done' }]
    case 'approved':
    case 'processing':
      return [submitted, { label: 'Reviewed', at: request.approved_at, state: 'done' }, { label: 'Processing Payment', state: 'current' }]
    default:
      return [submitted, { label: 'In Review', state: 'current' }, { label: 'Paid', state: 'upcoming' }]
  }
}

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-bg text-success">
        <CheckIcon size={12} weight="bold" />
      </span>
    )
  }
  if (state === 'stopped') {
    return (
      <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-error-bg text-error">
        <XIcon size={12} weight="bold" />
      </span>
    )
  }
  return (
    <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06]">
      <span className={cn('h-2 w-2 rounded-full', state === 'current' ? 'bg-[#6AA8FF]' : 'bg-white/20')} />
    </span>
  )
}

function SumRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="text-[13.5px] font-semibold tabular-nums text-text-primary">{children}</dd>
    </div>
  )
}

interface WithdrawalRequestCardProps {
  request: WithdrawalRequest
  onUpdate?: () => void
  table?: boolean
}

export default function WithdrawalRequestCard({ request, onUpdate, table }: WithdrawalRequestCardProps) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const status = STATUS[request.status] ?? { label: request.status, tone: 'neutral' as const }
  const name = request.method?.display_name ?? request.method_name
  const coin = request.method?.coin ?? null
  const netAmount = Number(request.net_amount)

  const openChange = (next: boolean) => {
    if (cancelling) return
    setOpen(next)
    if (!next) setConfirming(false)
  }

  const cancel = async () => {
    setCancelling(true)
    try {
      const result = await cancelWithdrawalRequest(request.id)
      if (!result.success) throw new Error(result.error || 'Could not cancel this withdrawal.')
      toast.success('Withdrawal cancelled. The amount has returned to your balance.')
      setOpen(false)
      setConfirming(false)
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel this withdrawal.')
    } finally {
      setCancelling(false)
    }
  }

  const copyTransaction = async () => {
    try {
      await navigator.clipboard.writeText(request.transaction_hash ?? '')
      toast.success('Transaction ID copied')
    } catch {
      toast.error('Could not copy. Select the ID and copy it instead.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:px-5',
          table && cn(WITHDRAWAL_TABLE_GRID, 'md:gap-x-4'),
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <CoinBadge coin={coin} methodName={request.method_name} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-text-primary">{name}</span>
            <span className={cn('mt-0.5 block text-[12px] text-text-tertiary', table && 'md:hidden')}>{day(request.created_at)}</span>
          </span>
        </span>

        {table && <span className="hidden text-[13px] text-text-secondary md:block">{day(request.created_at)}</span>}
        {table && <span className="hidden md:block"><StatusPill tone={status.tone}>{status.label}</StatusPill></span>}

        <span className={cn('flex flex-col items-end gap-1', table && 'md:block md:text-right')}>
          <span className={cn('text-[14.5px] font-bold tabular-nums', ['rejected', 'cancelled', 'failed'].includes(request.status) ? 'text-text-tertiary' : 'text-text-primary')}>{money(netAmount)}</span>
          <span className={cn(table && 'md:hidden')}><StatusPill tone={status.tone}>{status.label}</StatusPill></span>
        </span>

        {table && <CaretRightIcon size={14} weight="bold" aria-hidden className="hidden text-text-tertiary transition-colors group-hover:text-text-secondary md:block" />}
      </button>

      <Dialog open={open} onOpenChange={openChange}>
        <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
          {confirming ? (
            <div className="p-5 sm:p-6">
              <DialogTitle className="pr-8 text-base font-semibold">Cancel Withdrawal?</DialogTitle>
              <DialogDescription className="mt-1.5">{money(request.amount)} will return to your balance.</DialogDescription>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirming(false)} disabled={cancelling} className={accountBtn.secondary}>
                  Keep Withdrawal
                </button>
                <button type="button" onClick={cancel} disabled={cancelling} className={accountBtn.danger}>
                  {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Cancel Withdrawal
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3 pr-8">
                  <CoinBadge coin={coin} methodName={request.method_name} size={40} />
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-base font-semibold">{name}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-[12.5px]">Withdrawal Details</DialogDescription>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-text-secondary">You Receive</p>
                    <p className="mt-0.5 text-[32px] font-bold leading-none tracking-[-0.01em] tabular-nums text-success">{money(netAmount)}</p>
                  </div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>

                <ol className="mt-5">
                  {timeline(request).map((step, i, all) => (
                    <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < all.length - 1 && <span aria-hidden className="absolute left-[9.5px] top-5 h-[calc(100%-20px)] w-px bg-white/[0.1]" />}
                      <StepDot state={step.state} />
                      <div className="min-w-0 pt-px">
                        <p className={cn('text-[13.5px] font-medium', step.state === 'upcoming' ? 'text-text-tertiary' : 'text-text-primary')}>{step.label}</p>
                        {step.at && <p className="mt-0.5 text-[12px] text-text-tertiary">{moment(step.at)}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-4 bg-[#1F2025] p-5 sm:p-6">
                <dl className="space-y-2">
                  <SumRow label="Amount">{money(request.amount)}</SumRow>
                  <SumRow label="Fee">-{money(request.fee_amount)}</SumRow>
                </dl>

                {request.transaction_hash && (
                  <div>
                    <p className="text-[13px] text-text-secondary">Transaction ID</p>
                    <div className="mt-1.5 flex items-start gap-2 rounded-md bg-black/20 p-2.5">
                      <p translate="no" className="min-w-0 flex-1 break-all font-mono text-[12.5px] leading-relaxed text-text-primary">{request.transaction_hash}</p>
                      <button
                        type="button"
                        onClick={copyTransaction}
                        aria-label="Copy transaction ID"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <CopyIcon size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                )}

                {request.admin_notes && (
                  <div>
                    <p className="text-[13px] text-text-secondary">Note</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-primary">{request.admin_notes}</p>
                  </div>
                )}

                {request.status === 'pending' && (
                  <button type="button" onClick={() => setConfirming(true)} className={cn(accountBtn.danger, 'w-full')}>
                    Cancel Withdrawal
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
