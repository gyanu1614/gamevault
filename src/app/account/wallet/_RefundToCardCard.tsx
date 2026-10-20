'use client'

/**
 * Refund To Card (refund rule, 2026-10-16). Refunds land in the Store
 * Balance as store credit for the item price; any refunded order paid
 * through a provider can go back to that payment method for the full
 * amount, service fee included. One row per refunded order: the store
 * credit, what the card gets, and a Request button (or where the request
 * is). Hidden when the buyer has no refunded orders.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from '@/components/navigation/AppLink'
import { listMyRefundToCard } from '@/lib/actions/refund-to-card'
import { requestRefundToSource } from '@/lib/actions/refund-to-source'
import type { RefundToCardRow, RefundToCardState } from '@/lib/wallet/refund-to-card-rows'

const fmt = (minor: number) => `$${(minor / 100).toFixed(2)}`

const STATE_TEXT: Record<Exclude<RefundToCardState, 'available'>, string> = {
  store_credit_only: 'Store Credit Only',
  credit_spent: 'Credit Already Spent',
  requested: 'Requested · Reviewed Within 48 Hours',
  sent: 'Sent To Your Payment Method',
  rejected: 'Declined',
  failed: 'Could Not Be Sent',
}

function RowAction({ row, onRequested }: { row: RefundToCardRow; onRequested: () => void }) {
  const [busy, setBusy] = useState(false)
  if (row.state !== 'available') {
    return (
      <span className="shrink-0 text-[12.5px] font-medium text-text-tertiary">{STATE_TEXT[row.state]}</span>
    )
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const r = await requestRefundToSource(row.orderId)
          if (!r.success) toast.error(r.error ?? 'Could not send the request')
          else {
            toast.success(`Refund Requested — ${fmt(row.totalMinor)} back to your payment method once support reviews it.`)
            onRequested()
          }
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-white/[0.03] px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      Request {fmt(row.totalMinor)}
    </button>
  )
}

export function RefundToCardCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const { data: rows } = useQuery({
    queryKey: ['refund-to-card', userId],
    queryFn: () => listMyRefundToCard(),
    refetchOnWindowFocus: false,
    retry: 1,
  })
  if (!rows || rows.length === 0) return null

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['refund-to-card', userId] })
    queryClient.invalidateQueries({ queryKey: ['wallet-balance', userId] })
  }

  return (
    <section aria-labelledby="refund-to-card-heading" className="mt-3 overflow-hidden rounded-lg bg-bg-raised">
      <div className="flex items-start gap-3 p-5 pb-3">
        <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
        <div className="min-w-0">
          <h2 id="refund-to-card-heading" className="text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary">
            Refund To Card
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-text-secondary">
            Store credit buys the same item with no service fee. Want your money back instead? Send a refund to the
            payment method you used and get the full amount, service fee included.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {rows.map((row) => (
          <li key={row.orderId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
            <div className="min-w-0">
              <Link
                href={`/account/orders/${row.orderId}`}
                className="text-[13px] font-semibold tabular-nums text-text-primary underline-offset-2 hover:underline"
              >
                #{row.orderNumber}
              </Link>
              <p className="mt-0.5 text-[12.5px] tabular-nums text-text-secondary">
                Store credit {fmt(row.creditMinor)}
                <span className="text-text-tertiary"> · </span>
                To {row.methodLabel ?? 'your payment method'} {fmt(row.totalMinor)}
              </p>
            </div>
            <RowAction row={row} onRequested={refresh} />
          </li>
        ))}
      </ul>
    </section>
  )
}
