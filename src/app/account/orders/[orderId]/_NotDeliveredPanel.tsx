'use client'

/**
 * Cancel – Not Delivered (owner 2026-10-16/19).
 *
 *  · NotDeliveredModal — the buyer's confirm: the seller gets one hour to
 *    reply in the order chat or start delivery; no response → the order
 *    cancels and refunds itself (the item price as store credit, the full
 *    amount on request to the card from the Wallet).
 *  · NotDeliveredStatus — the open report on the order page: a live
 *    countdown for both sides ("Keep Waiting" for the buyer), and the
 *    "seller responded" line once they did. When the countdown ends on
 *    screen it asks the server to finalize (the SQL re-checks the clock),
 *    and while open it re-reads the report so a seller reply shows up.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareReply, TimerOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  finalizeNotDeliveredClaim,
  getNotDeliveredClaim,
  openNotDeliveredClaim,
  withdrawNotDeliveredClaim,
  type NotDeliveredClaim,
} from '@/lib/actions/not-delivered'
import { OrderCard } from './_OrderCard'
import { OrderModal, modalButton } from './_OrderModal'

const usd = (n: number) => `$${n.toFixed(2)}`

export function NotDeliveredModal({
  open,
  onOpenChange,
  orderId,
  creditAmount,
  totalAmount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** What the cancel would put in the Store Balance (the item price). */
  creditAmount: number
  /** What a card refund would send (the order total). */
  totalAmount: number
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  function close(o: boolean) {
    if (submitting) return
    onOpenChange(o)
  }

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    const res = await openNotDeliveredClaim(orderId)
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error ?? 'Could not report this order.')
      return
    }
    toast.success('Seller notified. They have 1 hour to reply or deliver.')
    close(false)
    router.refresh()
  }

  const refundLine =
    totalAmount > creditAmount
      ? `${usd(creditAmount)} goes to your Store Balance (spend it with no service fee), and you can request the full ${usd(totalAmount)} back to your payment method from your Wallet.`
      : `${usd(creditAmount)} goes back to your Store Balance.`

  return (
    <OrderModal
      open={open}
      onOpenChange={close}
      icon={TimerOff}
      tone="warning"
      title="Cancel – Not Delivered"
      description={`We'll ask the seller to reply or deliver within 1 hour. If they don't respond, this order is cancelled automatically: ${refundLine}`}
      footer={
        <>
          <button type="button" onClick={() => close(false)} disabled={submitting} className={modalButton('ghost')}>
            Keep Waiting
          </button>
          <button type="button" onClick={submit} disabled={submitting} className={modalButton('warning')}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending
              </>
            ) : (
              'Cancel – Not Delivered'
            )}
          </button>
        </>
      }
    />
  )
}

/** "mm:ss" left until `targetMs`, ticking once a second; 0 when it has passed. */
function useRemaining(targetMs: number): number {
  const [left, setLeft] = useState(() => Math.max(0, targetMs - Date.now()))
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, targetMs - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [targetMs])
  return left
}

function fmtLeft(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function NotDeliveredStatus({
  role,
  orderId,
  claim: initial,
}: {
  role: 'buyer' | 'seller' | 'admin'
  orderId: string
  claim: NotDeliveredClaim
}) {
  const router = useRouter()
  const [claim, setClaim] = useState(initial)
  const [withdrawing, setWithdrawing] = useState(false)
  const finalizing = useRef(false)
  const endsMs = Date.parse(claim.graceEndsAt)
  const left = useRemaining(endsMs)
  const isOpen = claim.status === 'open'

  useEffect(() => setClaim(initial), [initial])

  // While open: re-read the report so a seller reply (closed in SQL by the
  // message trigger) shows without a reload. Paused while the tab is hidden.
  useEffect(() => {
    if (!isOpen) return
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const next = await getNotDeliveredClaim(orderId).catch(() => null)
      if (next && next.status !== 'open') {
        setClaim(next)
        router.refresh()
      }
    }, 30_000)
    return () => clearInterval(t)
  }, [isOpen, orderId, router])

  // The hour ran out on screen: ask the server to finalize once.
  useEffect(() => {
    if (!isOpen || left > 0 || finalizing.current) return
    finalizing.current = true
    finalizeNotDeliveredClaim(orderId)
      .then(() => router.refresh())
      .catch(() => undefined)
  }, [isOpen, left, orderId, router])

  if (claim.status === 'seller_responded' && role === 'buyer') {
    return (
      <OrderCard className="flex items-start gap-3 px-5 py-4" padded={false}>
        <MessageSquareReply className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" aria-hidden />
        <p className="text-[13px] leading-[1.55] text-text-secondary">
          The seller replied and is working on your order. Still not delivered? Open a dispute.
        </p>
      </OrderCard>
    )
  }
  if (!isOpen) return null

  const until = new Date(endsMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <OrderCard className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-5 py-4" padded={false}>
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[9px] bg-warning-bg text-warning">
        <TimerOff className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[14px] font-bold text-text-primary">
          {role === 'seller' ? 'Buyer Reported Not Delivered' : 'Waiting For The Seller'}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-text-secondary">
          {role === 'seller'
            ? `Reply in the chat or start delivery by ${until}, or the order cancels and counts against your record.`
            : `The seller has until ${until} to reply or deliver. Otherwise this order cancels and refunds automatically.`}
        </p>
      </div>
      <span
        className={cn('shrink-0 font-mono text-[15px] font-bold tabular-nums', left > 0 ? 'text-warning' : 'text-text-tertiary')}
        aria-live="off"
        aria-label={left > 0 ? `${fmtLeft(left)} left` : 'Time is up'}
      >
        {left > 0 ? fmtLeft(left) : '0:00'}
      </span>
      {role === 'buyer' && (
        <button
          type="button"
          disabled={withdrawing}
          onClick={async () => {
            setWithdrawing(true)
            const r = await withdrawNotDeliveredClaim(orderId)
            setWithdrawing(false)
            if (!r.success) toast.error('Could not update the report.')
            else router.refresh()
          }}
          className="text-[12.5px] font-semibold text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary disabled:opacity-60 max-sm:basis-full max-sm:text-left"
        >
          Keep Waiting Instead
        </button>
      )}
    </OrderCard>
  )
}
