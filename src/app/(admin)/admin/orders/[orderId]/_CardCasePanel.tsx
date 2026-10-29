'use client'

/**
 * Card refunds and disputes on this order (card_cases, 2026-10-28):
 *   · Submit Evidence — one click: the order record, delivery and chat go to
 *     the bank through Stripe (once per dispute);
 *   · Seller Pays / DropMarket Pays — a card refund made in Stripe after the
 *     seller was paid; the seller share is on hold until you choose;
 *   · Unblock Buyer — a card dispute blocks the buyer from checking out.
 * Money moves only inside the SQL seams; every action is permission-checked.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch } from '@phosphor-icons/react'
import { adminSettleCardCase, adminSubmitCardDisputeEvidence, adminUnblockBuyer } from '@/lib/actions/admin-card-cases'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { CardCaseRow } from '@/lib/admin/card-cases'
import { adminBtn, StatusBadge } from '../../components/kit'

type Pending =
  | { kind: 'evidence'; c: CardCaseRow }
  | { kind: 'settle'; c: CardCaseRow; bearer: 'seller' | 'platform' }
  | { kind: 'unblock' }
  | null

const STATUS_LABEL: Record<CardCaseRow['status'], string> = {
  open: 'Open',
  awaiting_decision: 'Needs Decision',
  review: 'Needs Review',
  won: 'Won',
  settled: 'Settled',
}
const money = (minor: number, cur: string) => (cur === 'USD' ? `$${(minor / 100).toFixed(2)}` : `${(minor / 100).toFixed(2)} ${cur}`)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function CardCasePanel({
  orderId,
  buyerId,
  cases,
  buyerBlock,
}: {
  orderId: string
  buyerId: string | null
  cases: CardCaseRow[]
  buyerBlock: { reason: string; blocked_at: string } | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  const [busy, start] = useTransition()
  if (cases.length === 0 && !buyerBlock) return null

  function confirm() {
    if (!pending) return
    start(async () => {
      const r =
        pending.kind === 'evidence' ? await adminSubmitCardDisputeEvidence(pending.c.id)
        : pending.kind === 'settle' ? await adminSettleCardCase(pending.c.id, pending.bearer)
        : await adminUnblockBuyer(buyerId as string, orderId)
      if (!r.success) return void toast.error(r.error)
      toast.success(r.message)
      setPending(null)
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg bg-bg-raised p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Card Refunds &amp; Disputes</h2>
      <div className="mt-3 space-y-3">
        {cases.map((c) => (
          <div key={c.id} className="rounded-md bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13.5px] font-semibold text-text-primary">
                {c.kind === 'dispute' ? 'Card Dispute' : 'Refund In Stripe'} · {money(c.amount_minor, c.currency)}
              </p>
              <StatusBadge status={STATUS_LABEL[c.status]} />
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">
              {c.reason ? `${c.reason.replace(/_/g, ' ')} · ` : ''}
              {c.status === 'settled' && c.bearer ? `${c.bearer === 'seller' ? 'Seller paid' : 'DropMarket paid'} · ` : ''}
              {c.kind === 'dispute' && c.status === 'open' && c.evidence_due_by ? `Evidence due ${day(c.evidence_due_by)} · ` : ''}
              {c.evidence_submitted_at ? `Evidence sent ${day(c.evidence_submitted_at)} · ` : ''}
              {c.provider_ref}
            </p>
            {c.kind === 'dispute' && c.status === 'open' && !c.evidence_submitted_at && (
              <button type="button" className={`${adminBtn.primary} mt-3 w-full`} disabled={busy} onClick={() => setPending({ kind: 'evidence', c })}>
                Submit Evidence
              </button>
            )}
            {c.status === 'awaiting_decision' && c.amount_minor === c.card_minor && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className={adminBtn.danger} disabled={busy} onClick={() => setPending({ kind: 'settle', c, bearer: 'seller' })}>
                  Seller Pays
                </button>
                <button type="button" className={adminBtn.secondary} disabled={busy} onClick={() => setPending({ kind: 'settle', c, bearer: 'platform' })}>
                  DropMarket Pays
                </button>
              </div>
            )}
          </div>
        ))}
        {buyerBlock && buyerId && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] p-3.5">
            <p className="text-[12.5px] text-text-tertiary">Buyer blocked from checkout since {day(buyerBlock.blocked_at)}</p>
            <button type="button" className={adminBtn.secondary} disabled={busy} onClick={() => setPending({ kind: 'unblock' })}>
              Unblock Buyer
            </button>
          </div>
        )}
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="space-y-2 pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">
              {pending?.kind === 'evidence' ? 'Submit Evidence'
                : pending?.kind === 'settle' ? (pending.bearer === 'seller' ? 'Seller Pays' : 'DropMarket Pays')
                : 'Unblock Buyer'}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === 'evidence' && 'Sends the order timeline, delivery proof count and order chat to the bank through Stripe. You can submit only once.'}
              {pending?.kind === 'settle' && pending.bearer === 'seller' && `The order is refunded and ${money(pending.c.card_minor, pending.c.currency)} comes out of the seller’s balance — it may go negative.`}
              {pending?.kind === 'settle' && pending.bearer === 'platform' && `The seller keeps the sale. DropMarket’s commission pays back ${money(pending.c.card_minor, pending.c.currency)}.`}
              {pending?.kind === 'unblock' && 'The buyer can check out again. Their open card dispute is not affected.'}
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={adminBtn.secondary} onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className={pending?.kind === 'settle' && pending.bearer === 'seller' ? adminBtn.danger : adminBtn.primary} onClick={confirm} disabled={busy}>
              {busy && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              {busy ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
