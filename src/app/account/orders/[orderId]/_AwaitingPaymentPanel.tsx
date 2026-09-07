/**
 * AwaitingPaymentPanel — the whole left column for an UNPAID (pending) order.
 * There is no chat/progress/delivery UI before payment; instead the buyer
 * gets the two actions that matter: Resume/Retry Payment (reuses the stored
 * invoice while valid, otherwise mints a fresh one server-side) and
 * Cancel Order (inline confirm; returns any wallet credit held for the
 * order). A live countdown to the invoice expiry shows the auto-cancel
 * deadline. The seller sees a passive waiting note.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, CreditCard, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { retryOrderPayment } from '@/lib/actions/checkout'
import { cancelOrder } from '@/lib/actions/orders'

interface AwaitingPaymentPanelProps {
  orderId: string
  /** Non-buyers (seller, admin) get a passive waiting note — no actions. */
  role: 'buyer' | 'seller' | 'admin'
  /** True when the stored invoice link is still comfortably valid. */
  hasValidInvoice: boolean
  /** Invoice expiry (ISO) — drives the auto-cancel countdown. */
  paymentExpiresAt?: string | null
}

/**
 * "Auto-Cancels In M:SS" — mount-gated (renders nothing on the server pass)
 * so the ticking value can never cause a hydration mismatch. When the timer
 * hits zero the panel refreshes shortly after, picking up the webhook's
 * cancelled state.
 */
function AutoCancelCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  // Give the expiry webhook a moment to land, then pull the cancelled state.
  useEffect(() => {
    if (secondsLeft !== 0) return
    const id = setTimeout(() => router.refresh(), 20_000)
    return () => clearTimeout(id)
  }, [secondsLeft, router])

  if (secondsLeft === null) return null
  if (secondsLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-error-bg px-2.5 py-1 text-[12.5px] font-semibold text-error">
        <Clock className="h-3.5 w-3.5" />
        Payment Window Ended
      </span>
    )
  }
  // Voucher rails (Payssion 48h windows) read as "47h 59m", not "2879:59".
  const label =
    secondsLeft >= 3600
      ? `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m`
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-bg px-2.5 py-1 text-[12.5px] font-semibold text-warning tabular-nums">
      <Clock className="h-3.5 w-3.5" />
      Auto-Cancels In {label}
    </span>
  )
}

export function AwaitingPaymentPanel({
  orderId,
  role,
  hasValidInvoice,
  paymentExpiresAt,
}: AwaitingPaymentPanelProps) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handlePay = async () => {
    setPaying(true)
    try {
      const res = await retryOrderPayment(orderId)
      if (res.success && res.checkoutUrl) {
        // Provider-hosted pages (absolute URLs) open in a new tab so this
        // panel — the buyer's controls — stays put; blocked popups fall back
        // to the same tab. Our own (relative) pay page keeps the same tab.
        if (/^https?:/i.test(res.checkoutUrl)) {
          const payTab = window.open(res.checkoutUrl, '_blank')
          if (payTab) {
            setPaying(false)
            return
          }
        }
        window.location.href = res.checkoutUrl
        return
      }
      if (res.success && res.fullyPaidByWallet) {
        toast.success('Paid in full from your wallet — order confirmed.')
        router.refresh()
        return
      }
      toast.error(res.error || 'Could not restart payment. Please try again.')
    } catch {
      toast.error('Could not restart payment. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const res = await cancelOrder(orderId)
      if (res.success) {
        toast.success('Order cancelled.')
        router.refresh()
      } else {
        toast.error(res.error || 'Could not cancel the order.')
        setConfirmingCancel(false)
      }
    } catch {
      toast.error('Could not cancel the order.')
      setConfirmingCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-bg">
          <Clock className="h-5 w-5 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base font-semibold text-white">
              {role === 'buyer' ? 'Order Incomplete' : 'Awaiting Payment'}
            </h3>
            {role === 'buyer' && paymentExpiresAt && (
              <AutoCancelCountdown expiresAt={paymentExpiresAt} />
            )}
          </div>
          {role === 'buyer' ? (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {hasValidInvoice
                ? 'Your payment window is still open — resume where you left off. Unpaid orders cancel automatically when the timer ends, and any wallet credit returns to your wallet.'
                : 'The payment window ended, so this order cancels automatically. Retry to get a fresh payment window — chat and delivery unlock the moment payment confirms.'}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Waiting for the buyer to complete payment.
              {role === 'seller' &&
                ' You\u2019ll get a notification the moment this order is paid — nothing to do until then.'}
            </p>
          )}

          {role === 'buyer' && (
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              {!confirmingCancel ? (
                <>
                  <button
                    onClick={handlePay}
                    disabled={paying || cancelling}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-soft disabled:opacity-60"
                  >
                    {paying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {hasValidInvoice ? 'Resume Payment' : 'Retry Payment'}
                  </button>
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    disabled={paying}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-error/40 px-5 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error-bg disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Order
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center text-sm font-medium text-text-secondary">
                    Cancel this order?
                  </span>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-error-bg px-5 py-2.5 text-sm font-semibold text-error transition-colors disabled:opacity-60"
                  >
                    {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                    Yes, Cancel It
                  </button>
                  <button
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center rounded-md border border-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.06] disabled:opacity-60"
                  >
                    Keep Order
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
