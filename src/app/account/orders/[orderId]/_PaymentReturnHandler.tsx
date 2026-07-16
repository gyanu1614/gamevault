'use client'

/**
 * PaymentReturnHandler — post-payment return from CoinGate (success_url =
 * …?paid=1).
 *
 * The order flips pending → paid ONLY via the verified CoinGate webhook
 * (safedrop_transition CHARGE_CONFIRMED) — never from this redirect. So on
 * return we cannot claim "paid"; we show a BLOCKING "Confirming Your Payment"
 * overlay and wait for the flip to arrive:
 *
 *   1. COLLAPSE HISTORY — replace the ?paid=1 entry with the clean order URL so
 *      Back skips the CoinGate invoice page. A sessionStorage flag
 *      (`paid-return:${orderId}`) preserves the "we're confirming" state across
 *      that searchParam strip so the overlay survives the replace.
 *   2. OVERLAY while the flag is set AND the order is still 'pending'. Styled
 *      like the navbar logout overlay (opaque body-matched fill, spinner tile).
 *   3. RESOLUTION arrives two ways: the _OrderClient orders-UPDATE realtime
 *      subscription router.refresh()es on the webhook flip (re-rendering this
 *      with orderStatus !== 'pending'), plus a 4s router.refresh() fallback
 *      poll. On leaving 'pending' we clear the flag + toast "Payment Confirmed".
 *   4. TIMEOUT — after 120s the overlay degrades to a dismissible "still
 *      confirming" state with a Continue Browsing escape. Crypto confirmations
 *      can take minutes (CHARGE_PENDING is a webhook no-op), so we never trap
 *      the buyer and the copy never promises seconds.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

const CONFIRM_TIMEOUT_MS = 120_000
const REFRESH_INTERVAL_MS = 4_000

function flagKey(orderId: string) {
  return `paid-return:${orderId}`
}

export function PaymentReturnHandler({
  orderId,
  orderStatus,
}: {
  orderId: string
  orderStatus: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Confirming = we returned from CoinGate for THIS order and it hasn't flipped
  // off 'pending' yet. Seeded from sessionStorage so it survives the ?paid=1
  // strip + any re-render, and only ever set client-side.
  const [confirming, setConfirming] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const resolvedRef = useRef(false)

  // Mount: detect the payment return. Read ?paid=1 off the live URL (not the
  // Suspense-y useSearchParams hook — this component isn't wrapped in one) and
  // persist the confirming flag before collapsing history.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasPaidParam = new URLSearchParams(window.location.search).get('paid') === '1'
    const flagSet = window.sessionStorage.getItem(flagKey(orderId)) === '1'

    if (hasPaidParam) {
      window.sessionStorage.setItem(flagKey(orderId), '1')
      // Collapse the ?paid=1 history entry so Back never returns to CoinGate.
      router.replace(pathname)
    }

    if ((hasPaidParam || flagSet) && orderStatus === 'pending') {
      setConfirming(true)
    }
    // Only run on mount / when the order id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // The order left 'pending' (webhook confirmed, or it was never pending) →
  // clear the flag, lift the overlay, and acknowledge success once.
  useEffect(() => {
    if (orderStatus === 'pending') return
    if (typeof window !== 'undefined') {
      const wasConfirming = window.sessionStorage.getItem(flagKey(orderId)) === '1'
      window.sessionStorage.removeItem(flagKey(orderId))
      if (wasConfirming && !resolvedRef.current) {
        resolvedRef.current = true
        toast.success('Payment Confirmed', {
          description: 'Your order is now active.',
        })
      }
    }
    setConfirming(false)
    setTimedOut(false)
  }, [orderStatus, orderId])

  // While confirming: poll router.refresh() as a fallback to the realtime
  // subscription, and arm the 120s degrade-to-dismissible timeout.
  useEffect(() => {
    if (!confirming) return
    const poll = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    const timer = setTimeout(() => setTimedOut(true), CONFIRM_TIMEOUT_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(timer)
    }
  }, [confirming, router])

  if (!confirming) return null

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(flagKey(orderId))
    }
    setConfirming(false)
  }

  return (
    <div
      aria-live="polite"
      aria-busy={!timedOut}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        backgroundImage: 'var(--gradient-page-scrim)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
        backgroundSize: '100% 100%',
      }}
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-lg bg-bg-raised/80 ring-1 ring-white/10">
          {timedOut ? (
            <span aria-hidden className="text-2xl">⏳</span>
          ) : (
            <span
              aria-hidden
              className="h-7 w-7 animate-spin rounded-full border-2 border-white/[0.08] border-t-lime"
            />
          )}
        </span>

        {timedOut ? (
          <>
            <p className="text-[15px] font-bold text-text-primary">Still Confirming Your Payment</p>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Crypto confirmations can take a few minutes. You can keep browsing —
              we&apos;ll email you the moment it lands, and this order updates on
              its own.
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/browse"
                className="inline-flex items-center justify-center rounded-lg border border-border-default bg-bg-overlay px-4 py-2 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-bg-overlay-2"
              >
                Continue Browsing
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
              >
                Stay On This Order
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold text-text-primary">Confirming Your Payment…</p>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Your crypto payment is being verified — this usually takes a few
              seconds. Please keep this tab open.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
