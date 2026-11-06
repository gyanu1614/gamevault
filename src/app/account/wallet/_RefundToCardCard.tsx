'use client'

/**
 * Refunds on the wallet page (refund rule, 2026-10-16; rewritten for buyers 2026-11-06).
 * A refund lands in the balance as store credit for the item price; an order paid
 * through a provider can go back to that method for the full amount, service fee
 * included. One plain sentence per refund, with the button when there's a choice to
 * make. A refund with nothing to do shows nothing: it's already in the balance above.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from '@/components/navigation/AppLink'
import { listMyRefundToCard } from '@/lib/actions/refund-to-card'
import { requestRefundToSource } from '@/lib/actions/refund-to-source'
import { refundRowsToShow, refundSentence, type RefundToCardRow } from '@/lib/wallet/refund-to-card-rows'

const fmt = (minor: number) => `$${(minor / 100).toFixed(2)}`

function SendBack({ row, onRequested }: { row: RefundToCardRow; onRequested: () => void }) {
  const [busy, setBusy] = useState(false)
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
            toast.success(`Refund Requested: ${fmt(row.totalMinor)} back to your payment method once Support reviews it.`)
            onRequested()
          }
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.07] px-3.5 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      Get {fmt(row.totalMinor)} Back
    </button>
  )
}

function Sentence({ row }: { row: RefundToCardRow }) {
  const order = `#${row.orderNumber}`
  const [before, after] = refundSentence(row).split(order)
  return (
    <p className="min-w-0 text-[14px] leading-relaxed text-text-secondary">
      {before}
      <Link href={`/account/orders/${row.orderId}`} className="font-medium tabular-nums text-text-primary underline-offset-2 hover:underline">
        {order}
      </Link>
      {after}
    </p>
  )
}

export function RefundToCardCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['refund-to-card', userId],
    queryFn: () => listMyRefundToCard(),
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const rows = refundRowsToShow(data ?? [])
  if (rows.length === 0) return null

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['refund-to-card', userId] })
    queryClient.invalidateQueries({ queryKey: ['wallet-balance', userId] })
  }

  return (
    <section aria-label="Refunds" className="mt-3 overflow-hidden rounded-lg bg-bg-raised">
      <ul className="divide-y divide-white/[0.07]">
        {rows.map((row) => (
          <li key={row.orderId} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4">
            <div className="flex min-w-0 flex-1 basis-[280px] items-start gap-3">
              <Undo2 className="mt-1 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
              <Sentence row={row} />
            </div>
            {row.state === 'available' ? <SendBack row={row} onRequested={refresh} /> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
