'use client'

/**
 * Admin money controls on the order page (PR 7):
 *   · "Mark Disputed" — moves a paid/delivered/COMPLETED order to disputed
 *     (ADMIN_DISPUTED; after completion the seller amount is set aside);
 *   · resolution — release to seller / full refund / partial refund, through
 *     the same order_dispute_resolve RPC the disputes page uses.
 * Every action re-checks the admin permission server-side.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowCounterClockwise, CheckCircle, CircleNotch, Warning } from '@phosphor-icons/react'
import { adminOpenOrderDispute, resolveDispute } from '@/lib/actions/admin-disputes'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { adminBtn } from '../../components/kit'

type Mode = 'dispute' | 'release' | 'refund_full' | 'refund_partial' | null

export function AdminOrderActions({
  orderId,
  status,
  totalAmount,
  sellerPayout,
  openDisputeId,
}: {
  orderId: string
  status: string
  totalAmount: number
  sellerPayout: number
  openDisputeId: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, start] = useTransition()

  const canDispute = ['paid', 'delivering', 'delivered', 'completed'].includes(status) && !openDisputeId
  const canResolve = status === 'disputed' && !!openDisputeId
  if (!canDispute && !canResolve) return null

  const close = () => { setMode(null); setReason(''); setAmount('') }
  const usd = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

  function submit() {
    if (!mode) return
    start(async () => {
      let r: { success: boolean; error?: string }
      if (mode === 'dispute') {
        r = await adminOpenOrderDispute(orderId, reason.trim())
      } else {
        const partial = mode === 'refund_partial'
        r = await resolveDispute(openDisputeId!, {
          status: mode === 'release' ? 'resolved_seller_favor' : partial ? 'resolved_partial' : 'resolved_buyer_favor',
          resolutionType: mode === 'release' ? 'no_refund' : partial ? 'refund_partial' : 'refund_full',
          resolvedAmount: partial ? Number(amount) : mode === 'refund_full' ? totalAmount : 0,
          notes: reason.trim(),
        })
      }
      if (!r.success) return void toast.error(r.error || 'Action failed')
      toast.success(
        mode === 'dispute' ? 'Order moved to disputed — the seller amount is set aside.'
        : mode === 'release' ? 'Released to the seller.'
        : 'Refund credited to the buyer’s wallet.',
      )
      close()
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg bg-bg-raised p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Money Controls</h2>
      <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-text-tertiary">
        Seller amount {usd(sellerPayout)} of {usd(totalAmount)} total. Every action writes an audit row with your id and reason.
      </p>
      <div className="space-y-2">
        {canDispute && (
          <button type="button" className={cn(adminBtn.secondary, 'w-full text-warning')} onClick={() => setMode('dispute')} disabled={busy}>
            <Warning aria-hidden weight="bold" className="h-4 w-4" /> Mark Disputed
          </button>
        )}
        {canResolve && (
          <>
            <button type="button" className={cn(adminBtn.primary, 'w-full')} onClick={() => setMode('release')} disabled={busy}>
              <CheckCircle aria-hidden weight="bold" className="h-4 w-4" /> Release To Seller
            </button>
            <button type="button" className={cn(adminBtn.secondary, 'w-full')} onClick={() => setMode('refund_full')} disabled={busy}>
              <ArrowCounterClockwise aria-hidden weight="bold" className="h-4 w-4" /> Refund Buyer In Full
            </button>
            <button type="button" className={cn(adminBtn.secondary, 'w-full bg-transparent')} onClick={() => setMode('refund_partial')} disabled={busy}>
              Partial Refund…
            </button>
          </>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="space-y-2 pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">
              {mode === 'dispute' ? 'Mark Order Disputed'
                : mode === 'release' ? 'Release To Seller'
                : mode === 'refund_full' ? 'Refund Buyer In Full'
                : 'Partial Refund'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'dispute' && (status === 'completed'
                ? `The order is completed: ${usd(sellerPayout)} will be set aside from the seller’s balance until you resolve the dispute.`
                : 'The order stays paid and nothing is credited to the seller until you resolve the dispute.')}
              {mode === 'release' && 'Closes the dispute in the seller’s favour; their amount becomes available again.'}
              {mode === 'refund_full' && `${usd(totalAmount)} is credited to the buyer’s wallet. The seller side (${usd(sellerPayout)}) is deducted from their balance — it may go negative.`}
              {mode === 'refund_partial' && `Enter the refund amount (under ${usd(totalAmount)}). The seller covers it first, up to ${usd(sellerPayout)}; the rest comes from our commission.`}
            </DialogDescription>
          </div>
          {mode === 'refund_partial' && (
            <input
              type="number"
              min={0.01}
              max={Math.max(0.01, totalAmount - 0.01)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Refund amount (USD)"
              aria-label="Refund amount in USD"
              inputMode="decimal"
              className={accountInputCls}
            />
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'dispute' ? 'Reason (written to the audit trail, shown to both parties)' : 'Resolution notes (written to the audit trail)'}
            rows={3}
            aria-label={mode === 'dispute' ? 'Reason' : 'Resolution notes'}
            className={cn(accountInputCls, 'resize-none')}
          />
          <p className="-mt-2 text-[12px] text-text-tertiary">At least 5 characters.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={adminBtn.secondary} onClick={close} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={mode === 'refund_full' || mode === 'refund_partial' || mode === 'dispute' ? adminBtn.danger : adminBtn.primary}
              onClick={submit}
              disabled={busy || reason.trim().length < 5 || (mode === 'refund_partial' && !(Number(amount) > 0 && Number(amount) < totalAmount))}
            >
              {busy && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              {busy ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
