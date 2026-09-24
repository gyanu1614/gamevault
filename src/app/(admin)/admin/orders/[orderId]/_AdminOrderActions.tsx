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
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { adminOpenOrderDispute, resolveDispute } from '@/lib/actions/admin-disputes'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
    <div className="rounded-xl border border-border-default bg-bg-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-1">Money Controls</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Seller amount {usd(sellerPayout)} of {usd(totalAmount)} total. Every action writes an audit row with your id and reason.
      </p>
      <div className="space-y-2">
        {canDispute && (
          <Button variant="outline" className="w-full justify-center text-amber-400 border-amber-500/30" onClick={() => setMode('dispute')} disabled={busy}>
            <AlertTriangle className="h-4 w-4" /> Mark Disputed
          </Button>
        )}
        {canResolve && (
          <>
            <Button className="w-full justify-center" onClick={() => setMode('release')} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> Release To Seller
            </Button>
            <Button variant="outline" className="w-full justify-center" onClick={() => setMode('refund_full')} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Refund Buyer In Full
            </Button>
            <Button variant="ghost" className="w-full justify-center" onClick={() => setMode('refund_partial')} disabled={busy}>
              Partial Refund…
            </Button>
          </>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
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
          </DialogHeader>
          {mode === 'refund_partial' && (
            <input
              type="number"
              min={0.01}
              max={Math.max(0.01, totalAmount - 0.01)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Refund amount (USD)"
              className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
            />
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'dispute' ? 'Reason (written to the audit trail, shown to both parties)' : 'Resolution notes (written to the audit trail)'}
            rows={3}
            className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-lime-text"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={busy || reason.trim().length < 5 || (mode === 'refund_partial' && !(Number(amount) > 0 && Number(amount) < totalAmount))}
            >
              {busy ? 'Working…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
