'use client'

/**
 * Cancel – Not Delivered (owner 2026-10-16/19/20). Nothing here cancels or
 * refunds an order: an admin decides.
 *
 *  · NotDeliveredModal — the buyer's report: the seller gets a response
 *    window (the listing's delivery time, 15 min .. 24 h) to reply in the
 *    order chat or start delivery.
 *  · NotDeliveredRequestModal — once the window ran out with no response:
 *    the buyer asks DropMarket to cancel; it lands in the admin's
 *    Cancellation Requests with an alert.
 *  · NotDeliveredStatus — the report on the order page: the live countdown
 *    for both sides ("Keep Waiting" for the buyer), then "the seller didn't
 *    respond" / "under review" / "the seller responded". When the countdown
 *    ends on screen it asks the server to sync (the SQL re-checks the clock),
 *    and while open it re-reads the report so a seller reply shows up.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Hourglass, Loader2, MessageSquareReply, TimerOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getNotDeliveredClaim,
  openNotDeliveredClaim,
  requestNotDeliveredCancel,
  syncNotDeliveredClaim,
  withdrawNotDeliveredClaim,
  type NotDeliveredClaim,
} from '@/lib/actions/not-delivered'
import { windowSpan } from '@/lib/orders/not-delivered'
import { OrderCard } from './_OrderCard'
import { OrderModal, modalButton, modalField } from './_OrderModal'

const usd = (n: number) => `$${n.toFixed(2)}`

export function NotDeliveredModal({
  open,
  onOpenChange,
  orderId,
  windowMinutes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** The seller's response window (the listing's delivery time, 15 min .. 24 h). */
  windowMinutes: number
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const span = windowSpan(windowMinutes)

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
    toast.success(`Seller notified. They have ${span} to reply or deliver.`)
    close(false)
    router.refresh()
  }

  return (
    <OrderModal
      open={open}
      onOpenChange={close}
      icon={TimerOff}
      tone="warning"
      title="Cancel – Not Delivered"
      description={`We'll ask the seller to reply or deliver within ${span}. If they don't respond, you can request cancellation and our team will review it.`}
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
              'Notify Seller'
            )}
          </button>
        </>
      }
    />
  )
}

export function NotDeliveredRequestModal({
  open,
  onOpenChange,
  orderId,
  creditAmount,
  totalAmount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** What an approved cancel puts in the Store Balance (the item price). */
  creditAmount: number
  /** What a card refund sends instead (the order total). */
  totalAmount: number
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function close(o: boolean) {
    if (submitting) return
    onOpenChange(o)
    if (!o) setNote('')
  }

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    const res = await requestNotDeliveredCancel(orderId, note)
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error ?? 'Could not send the request.')
      return
    }
    toast.success('Cancellation requested. Our team will review it.')
    close(false)
    router.refresh()
  }

  const refundLine =
    totalAmount > creditAmount
      ? `If it's approved, ${usd(creditAmount)} goes to your Store Balance, and you can request the full ${usd(totalAmount)} back to your payment method from your Wallet.`
      : `If it's approved, ${usd(creditAmount)} goes back to your Store Balance.`

  return (
    <OrderModal
      open={open}
      onOpenChange={close}
      icon={Ban}
      tone="warning"
      title="Request Cancellation"
      description={`The seller didn't respond in time. Our team reviews your request; the seller can still deliver until then. ${refundLine}`}
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
              'Request Cancellation'
            )}
          </button>
        </>
      }
    >
      <div className="mt-3.5">
        <label htmlFor="nd-note" className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
          Anything we should know? (optional)
        </label>
        <textarea
          id="nd-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="For example: the seller never replied in chat"
          className={cn(modalField, 'resize-none')}
        />
      </div>
    </OrderModal>
  )
}

/** Milliseconds left until `targetMs`, ticking once a second; 0 when it has passed. */
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
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function Line({ icon: Icon, tone, children }: { icon: typeof TimerOff; tone: 'lime' | 'warning'; children: React.ReactNode }) {
  return (
    <OrderCard className="flex items-start gap-3 px-5 py-4" padded={false}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'lime' ? 'text-lime-text' : 'text-warning')} aria-hidden />
      <p className="text-[13px] leading-[1.55] text-text-secondary">{children}</p>
    </OrderCard>
  )
}

export function NotDeliveredStatus({
  role,
  orderId,
  claim: initial,
  onWithdrawRequest,
}: {
  role: 'buyer' | 'seller' | 'admin'
  orderId: string
  claim: NotDeliveredClaim
  /** Buyer: take back a pending cancellation request (the report goes back to "seller didn't respond"). */
  onWithdrawRequest?: () => void
}) {
  const router = useRouter()
  const [claim, setClaim] = useState(initial)
  const [withdrawing, setWithdrawing] = useState(false)
  const syncing = useRef(false)
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

  // The window ran out on screen: ask the server to sync once (no money moves).
  useEffect(() => {
    if (!isOpen || left > 0 || syncing.current) return
    syncing.current = true
    syncNotDeliveredClaim(orderId)
      .then(() => router.refresh())
      .catch(() => undefined)
  }, [isOpen, left, orderId, router])

  if (claim.status === 'seller_responded' && role === 'buyer') {
    return (
      <Line icon={MessageSquareReply} tone="lime">
        The seller replied and is working on your order. Still not delivered? Open a dispute.
      </Line>
    )
  }
  if (claim.status === 'expired') {
    return (
      <Line icon={TimerOff} tone="warning">
        {role === 'seller'
          ? "You didn't respond in time. The buyer can now ask DropMarket to cancel this order, which counts against your record. Deliver now to keep it."
          : "The seller didn't respond in time. Request cancellation above and our team will review it."}
      </Line>
    )
  }
  if (claim.status === 'cancel_requested') {
    return (
      <Line icon={Hourglass} tone="warning">
        {role === 'seller'
          ? 'The buyer asked DropMarket to cancel this order. Deliver now to keep it — our team reviews the request shortly.'
          : (
            <>
              Cancellation requested. Our team reviews it shortly; the seller can still deliver until then.
              {onWithdrawRequest && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onWithdrawRequest}
                    className="font-semibold text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
                  >
                    Withdraw Request
                  </button>
                </>
              )}
            </>
          )}
      </Line>
    )
  }
  if (!isOpen) return null

  const until = new Date(endsMs).toLocaleString([], { hour: 'numeric', minute: '2-digit', ...(claim.windowMinutes >= 360 ? { weekday: 'short' } : {}) })
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
            ? `Reply in the chat or start delivery by ${until}. If you don't, the buyer can ask DropMarket to cancel the order, and it counts against your record.`
            : `The seller has until ${until} to reply or deliver. If they don't, you can request cancellation and our team will review it.`}
        </p>
      </div>
      <span
        className={cn('shrink-0 font-mono text-[15px] font-bold tabular-nums', left > 0 ? 'text-warning' : 'text-text-tertiary')}
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
