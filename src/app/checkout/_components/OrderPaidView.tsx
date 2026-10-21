'use client'

/**
 * Order Paid — where a buyer lands after paying on a provider page (same-tab
 * pay, owner 2026-10-16, GameBoost pattern): a clear "Order Paid", a burst of
 * confetti, the order at a glance, then what happens next (PaidNextSteps:
 * three steps for manual delivery, Show My Item for automatic delivery) and
 * one button to the order.
 *
 * It never claims "paid" on its own: while our order is still `pending`
 * (Payssion sends the buyer home before its webhook) it shows "Confirming
 * Your Payment" and polls getPaymentPageStatus (read-only; the webhook is the
 * only thing that marks an order paid). Paid → "Order Paid" (+ confetti once,
 * never under reduced motion). Cancelled → "Payment Not Completed" + Try
 * Again. Still pending after 2 minutes → it stops polling and says so.
 *
 * Back to the checkout URL after paying redirects here too (one design).
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, Copy, Loader2, PackageCheck, X } from 'lucide-react'

import Link from '@/components/navigation/AppLink'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { safeSession } from '@/lib/safe-storage'
import { PAID_LIFECYCLE } from '@/lib/payments/return-destination'
import { PaidNextSteps } from './PaidNextSteps'

const POLL_MS = 2_500
const GIVE_UP_MS = 120_000
const CONFETTI = ['#56B87F', '#A3E635', '#F5C451', '#E9EDF2']

export interface PaidOrderSummary {
  id: string
  orderNumber: string | null
  status: string
  total: number
  quantity: number
  title: string
  image: string | null
  gameName: string | null
  gameSlug: string | null
  sellerName: string | null
  deliveryTime: string | null
  /** Listing delivers automatically (instant codes / credentials). */
  instantDelivery: boolean
  listingId: string
}

type View = 'confirming' | 'slow' | 'paid' | 'failed' | 'other'

function viewFor(status: string): View {
  if (status === 'pending') return 'confirming'
  if (PAID_LIFECYCLE.has(status)) return 'paid'
  if (status === 'cancelled') return 'failed'
  return 'other'
}


// Entrances move, never fade from 0: content stays readable even if the
// animation never runs (background tab, low-power mode).
export function OrderPaidView({ order }: { order: PaidOrderSummary }) {
  const reduce = useReducedMotion()
  const [view, setView] = useState<View>(() => viewFor(order.status))

  // Poll our DB (never the provider) until the webhook moves the order.
  useEffect(() => {
    if (view !== 'confirming') return
    let stopped = false
    const started = Date.now()
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (stopped) return
      if (Date.now() - started > GIVE_UP_MS) {
        setView('slow')
        return
      }
      try {
        const res = await getPaymentPageStatus(order.id)
        if (!stopped && res.success && res.orderStatus && res.orderStatus !== 'pending') {
          setView(viewFor(res.orderStatus))
          return
        }
      } catch {
        // A failed poll just waits for the next one.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [view, order.id])

  // Confetti once, the moment the order reads paid (never under reduced
  // motion, not again on a reload or a Back to this order in this tab). The
  // "seen" mark is written only when it actually fires, so React's dev
  // double-run (mount → cleanup → mount) cannot swallow it. Loaded on demand.
  useEffect(() => {
    if (view !== 'paid' || reduce) return
    const seenKey = `order-paid-confetti:${order.id}`
    if (safeSession.get(seenKey) === '1') return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
      safeSession.set(seenKey, '1')
      const burst = (x: number, angle: number) =>
        confetti({ particleCount: 70, spread: 62, startVelocity: 44, angle, origin: { x, y: 0.65 }, colors: CONFETTI, ticks: 230, scalar: 0.9, disableForReducedMotion: true })
      timers.push(setTimeout(() => { burst(0.15, 60); burst(0.85, 120) }, 150))
      timers.push(setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 30, origin: { x: 0.5, y: 0.35 }, colors: CONFETTI, ticks: 240, scalar: 0.8, disableForReducedMotion: true }), 550))
    })
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [view, reduce, order.id])

  const orderHref = `/account/orders/${order.id}`
  const checkoutHref = `/checkout/${order.listingId}?qty=${order.quantity}`
  const seller = order.sellerName ?? 'The seller'

  const copy: Record<View, { title: string; body: string }> = {
    confirming: { title: 'Confirming Your Payment', body: 'This usually takes a few seconds. Keep this page open.' },
    slow: {
      title: 'Still Confirming',
      body: 'Your payment is taking longer than usual to confirm. Your order page updates the moment it lands.',
    },
    paid: {
      title: 'Order Paid',
      body: `Your payment went through. ${seller} has your order.`,
    },
    failed: { title: 'Payment Not Completed', body: 'No money was taken. You can try again with any payment method.' },
    other: { title: 'Order Updated', body: 'This order has moved on. Open it to see where it stands.' },
  }
  const { title, body } = copy[view]

  const copyNumber = async () => {
    if (!order.orderNumber) return
    try {
      await navigator.clipboard.writeText(order.orderNumber)
      toast.success('Order number copied')
    } catch {
      toast.error('Could not copy — select it instead')
    }
  }


  const mark =
    view === 'paid' ? (
      <span className="relative grid h-[60px] w-[60px] place-items-center">
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#56B87F]"
            initial={{ scale: 1, opacity: 0.45 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )}
        <motion.span
          // Scale only: the tick is visible even if the animation never runs.
          initial={reduce ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          className="relative grid h-[60px] w-[60px] place-items-center rounded-full bg-[#2A7A50] shadow-[0_0_0_7px_rgba(86,184,127,0.16),0_10px_30px_rgba(42,122,80,0.45)]"
        >
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </motion.span>
      </span>
    ) : view === 'failed' ? (
      <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-[rgba(255,178,62,0.14)] ring-1 ring-[rgba(255,178,62,0.35)]">
        <X className="h-8 w-8 text-[#FFB23E]" strokeWidth={3} />
      </span>
    ) : (
      <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-[#24252B] ring-1 ring-white/10">
        <Loader2 className={view === 'slow' ? 'h-7 w-7 text-[#9AA6B3]' : 'h-7 w-7 animate-spin text-[#56B87F]'} />
      </span>
    )

  const secondary =
    view === 'failed'
      ? null
      : order.gameSlug && order.gameName
        ? { href: `/${order.gameSlug}`, label: `Browse ${order.gameName}` }
        : { href: '/', label: 'Keep Shopping' }
  // Automatic delivery: the item is revealed above; the order page is where
  // the buyer talks to the seller, so the button says so.
  const primary =
    view === 'failed'
      ? { href: checkoutHref, label: 'Try Again' }
      : { href: orderHref, label: view === 'paid' && order.instantDelivery ? 'Chat With Seller' : 'Go to Order' }

  return (
    <>
      {/* One screen, no scroll (owner 2026-10-19): fills the space under the
          navbar and centres the content; the layout drops the footer here. */}
      <main className="relative mx-auto flex min-h-[calc(100dvh-var(--navbar-bottom,0px))] w-full max-w-[640px] flex-col justify-center px-4 py-6 [@media(max-height:780px)]:py-3">
        <motion.div
          initial={reduce ? false : { y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          aria-live="polite"
          aria-busy={view === 'confirming'}
          className="flex flex-col items-center text-center"
        >
          {mark}
          <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-[-0.01em] text-[#E9EDF2] sm:text-[32px]">{title}</h1>
          <p className="mt-1.5 max-w-[460px] text-[14.5px] leading-relaxed text-[#9AA6B3]">{body}</p>
        </motion.div>

        <motion.section
          initial={reduce ? false : { y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Your order"
          className="mt-6 overflow-hidden rounded-xl bg-[#1D1E23]/90 ring-1 ring-white/[0.08] backdrop-blur-md"
        >
          <div className="flex items-center gap-3.5 p-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#24252B] ring-1 ring-white/[0.06]">
              {order.image ? (
                <Image src={order.image} alt={order.title} width={56} height={56} unoptimized className="h-14 w-14 object-cover" />
              ) : (
                <PackageCheck className="h-6 w-6 text-[#9AA6B3]" />
              )}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[15px] font-semibold leading-snug text-[#E9EDF2]">{order.title}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-[#9AA6B3]">
                {[order.gameName, `Qty ${order.quantity}`].filter(Boolean).join(' · ')}
              </p>
              {order.orderNumber && (
                <button
                  type="button"
                  onClick={copyNumber}
                  className="-ml-1 mt-0.5 inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[12px] font-semibold text-[#C9D1DA] transition-colors hover:bg-white/[0.06] hover:text-[#E9EDF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={`Copy order number ${order.orderNumber}`}
                >
                  {order.orderNumber}
                  <Copy className="h-3 w-3 text-[#9AA6B3]" />
                </button>
              )}
            </div>
            <span className="shrink-0 self-start pt-0.5 text-[17px] font-bold tabular-nums text-[#E9EDF2]">${order.total.toFixed(2)}</span>
          </div>

        </motion.section>

        {view === 'paid' && (
          <PaidNextSteps orderId={order.id} sellerName={seller} instantDelivery={order.instantDelivery} />
        )}

        <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row-reverse [@media(max-height:780px)]:mt-5">
          <Link
            href={primary.href}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-[#2A7A50] text-[15px] font-semibold text-white transition-[background-color,transform] hover:bg-[#33935F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.99] sm:flex-1"
          >
            {primary.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-white/[0.03] text-[14.5px] font-semibold text-[#C9D1DA] ring-1 ring-white/[0.12] transition-colors hover:bg-white/[0.06] hover:text-[#E9EDF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:flex-1"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </main>
    </>
  )
}
