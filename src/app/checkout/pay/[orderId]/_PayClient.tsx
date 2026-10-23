'use client'

/**
 * PayClient: the native BTCPay payment page.
 *
 * White hosted-invoice layout (owner 2026-10-21, the CoinGate / Cryptomus
 * look, our own build): one centred card, 480px on phones and 880px on
 * desktop with the QR on the left (owner 2026-10-22: shorter, wider). The order total heads it with an
 * Order Info toggle; then the coin + network, the countdown, the exact amount
 * to send, the QR, the address and Open In Wallet; a progress bar; "safe to
 * close" + Cancel Order. Help, terms and SafeDrop sit under the card.
 * UI pieces live in ./_pay-ui.
 *
 * Display-only state machine; the verified webhook is the sole authority
 * for marking the order paid:
 *   waiting → seen (instant chain-watch, tx id shown) → confirming → paid
 *   waiting → partial (live remaining due) · waiting/partial → expired
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { retryOrderPayment } from '@/lib/actions/checkout'
import { cancelOrder } from '@/lib/actions/orders'
import { cn } from '@/lib/utils'
import { nextPollDelayMs, countdownShouldContinue, POLL_BASE_MS } from './poll-policy'
import { isTabVisible } from '@/lib/polling/intervals'
import { qrPayload, walletDeepLink } from './qr'
import { PaymentQr } from './_PaymentQr'
import {
  CopyButton,
  ExpiryChip,
  HelpDrawer,
  Note,
  PayStepper,
  StatePanel,
  SummaryRow,
  btn,
  copyText,
  fmtCrypto,
  shortTx,
  type PayStep,
} from './_pay-ui'

export interface PayMethod {
  id: string
  label: string
  short: string
  icon: string | null
  network: string | null
  /** Human chain name for prose ("TRON", "Polygon"); null when unproven. */
  networkName: string | null
  /** Confirmation-time clause, lowercase ("usually under a minute"). */
  confirmEta: string | null
  networkWarning: string | null
  address: string
  paymentLink: string | null
  due: string
  totalPaid: string
  rate: string | null
}

/** Order money rows, built on the server from the buyer's own fields.
 *  itemPrice/serviceFee are null when they could not be read. */
export interface PaySummary {
  itemPrice: number | null
  quantity: number
  serviceFee: number | null
  promoDiscount: number
  storeCredit: number
  total: number
}

export type ViewState = 'waiting' | 'seen' | 'confirming' | 'paid' | 'partial' | 'expired' | 'unreachable'

// ─── Main component ─────────────────────────────────────────────────

export default function PayClient({
  orderId,
  orderNumber,
  listingId,
  listingTitle,
  itemImage,
  gameName,
  summary,
  currency,
  invoiceAmount,
  initialInvoiceStatus,
  expiresAt,
  createdAt,
  methods,
  initialMethodId,
  previewView,
}: {
  orderId: string
  orderNumber: string | null
  listingId: string | null
  listingTitle: string
  itemImage: string | null
  gameName: string | null
  summary: PaySummary
  currency: string
  invoiceAmount: number
  initialInvoiceStatus: string
  expiresAt: string | null
  createdAt: string | null
  methods: PayMethod[]
  initialMethodId?: string | null
  user?: { email?: string | null } | null
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
  /** /dev/crypto-pay-preview only: start in this view (never set by the real page). */
  previewView?: ViewState
}) {
  const router = useRouter()
  const reduce = useReducedMotion() ?? false

  const initialView: ViewState =
    initialInvoiceStatus === 'Processing'
      ? 'confirming'
      : initialInvoiceStatus === 'New'
        ? 'waiting'
        : initialInvoiceStatus === 'Unreachable'
          ? 'unreachable'
          : 'expired'

  const [view, setView] = useState<ViewState>(previewView ?? initialView)
  const [orderOpen, setOrderOpen] = useState(false)
  const [selectedId] = useState(initialMethodId ?? methods[0]?.id ?? '')
  const [liveDue, setLiveDue] = useState<Record<string, { due?: string; totalPaid?: string }>>({})
  const [seenTx, setSeenTx] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  )
  const [retrying, setRetrying] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const stamps = useRef<Record<string, string>>({})

  const selected = useMemo(
    () => methods.find((m) => m.id === selectedId) ?? methods[0],
    [methods, selectedId]
  )
  const live = selected ? liveDue[selected.id] : undefined
  const dueDisplay = fmtCrypto(live?.due ?? selected?.due)
  const sym = currency.toUpperCase() === 'EUR' ? '€' : '$'
  const money = (n: number) => `${sym}${n.toFixed(2)}`
  const rateLine = selected?.rate
    ? `1 ${selected.short} = ${sym}${Number(selected.rate).toFixed(2)}`
    : null

  const stamp = (key: string) => {
    if (!stamps.current[key]) stamps.current[key] = new Date().toISOString()
    return stamps.current[key]
  }

  // ── Countdown ─────────────────────────────────────────────────────
  // PAY-019: stops at zero (the view flips to expired once) instead of
  // ticking negative seconds every second for as long as the tab is open.
  useEffect(() => {
    if (!expiresAt || !(view === 'waiting' || view === 'seen' || view === 'partial')) return
    const t = setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now()
      setRemainingMs(left)
      if (!countdownShouldContinue(left)) {
        clearInterval(t)
        setView((v) => (v === 'waiting' || v === 'seen' || v === 'partial' ? 'expired' : v))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt, view])

  // ── Status poll (webhook truth + chain-watch sugar) ───────────────
  // PAY-019: a setTimeout chain (never two calls in flight), base rate while
  // a payment can land, ×2 backoff to 60 s in expired / unreachable, and
  // nothing at all once paid. Schedule in poll-policy.ts.
  useEffect(() => {
    if (view === 'paid' || previewView) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = nextPollDelayMs(view, POLL_BASE_MS) ?? POLL_BASE_MS
    const schedule = () => {
      timer = setTimeout(tick, delay)
    }
    const tick = async () => {
      if (cancelled) return
      // Hidden tab: no status call; the next visible tick (within the base
      // rate) catches up. The webhook flips the order either way.
      if (!isTabVisible()) {
        schedule()
        return
      }
      let res
      try {
        res = await getPaymentPageStatus(orderId)
      } catch {
        res = { success: false } as Awaited<ReturnType<typeof getPaymentPageStatus>>
      }
      if (cancelled) return
      const next = nextPollDelayMs(view, delay)
      if (next === null) return
      delay = next
      schedule()
      if (!res.success) return
      if (res.orderStatus && res.orderStatus !== 'pending') {
        stamp('confirmed')
        setView('paid')
        setTimeout(() => router.replace(`/account/orders/${orderId}?paid=1`), 3200)
        return
      }
      if (res.methods?.length) {
        setLiveDue((prev) => {
          const next = { ...prev }
          for (const m of res.methods!) next[m.paymentMethodId] = { due: m.due, totalPaid: m.totalPaid }
          return next
        })
      }
      if (res.seenTxId) setSeenTx(res.seenTxId)

      const partiallyPaid = (res.methods ?? []).some((m) => Number(m.totalPaid ?? 0) > 0)
      switch (res.invoiceStatus) {
        case 'Processing':
          stamp('seen')
          setView('confirming')
          break
        case 'Expired':
        case 'Invalid':
          setView((v) => (v === 'confirming' ? v : 'expired'))
          break
        case 'New':
          setView((v) => {
            if (v === 'confirming') return v
            if (partiallyPaid) return 'partial'
            if (res.seenOnNetwork) {
              stamp('seen')
              return 'seen'
            }
            return v === 'unreachable' ? 'waiting' : v
          })
          break
      }
    }
    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [orderId, router, view, previewView])

  const freshInvoice = useCallback(async () => {
    setRetrying(true)
    const res = await retryOrderPayment(orderId)
    if (res.success && res.fullyPaidByWallet) {
      router.replace(`/account/orders/${orderId}?paid=1`)
      return
    }
    router.refresh()
    setRetrying(false)
    setView('waiting')
  }, [orderId, router])

  // Cancel = "no order ever happened": the order flips to cancelled (hidden
  // from the orders list), wallet credit returns, and the buyer lands back on
  // the checkout page, the exact pre-order state.
  const handleCancelOrder = useCallback(async () => {
    setCancelling(true)
    try {
      const res = await cancelOrder(orderId)
      if (res.success) {
        toast.success('Order Cancelled. Nothing was charged.')
        router.replace(listingId ? `/checkout/${listingId}` : '/')
        return
      }
      toast.error(res.error || 'Could not cancel. Please try again.')
      setCancelling(false)
      setConfirmingCancel(false)
    } catch {
      toast.error('Could not cancel. Please try again.')
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }, [orderId, listingId, router])

  const openInWallet = useCallback(async () => {
    const link = selected ? walletDeepLink(selected) : null
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (link && coarse) {
      window.location.href = link
      return
    }
    // Desktop fallback: copy the address instead.
    if (selected) {
      if (await copyText(selected.address, 'Address', { toast: true })) {
        toast.info('Open your wallet app on your phone and paste the address.')
      }
    }
  }, [selected])

  const livePay = view === 'waiting' || view === 'seen' || view === 'partial'
  const phase: 'pay' | 'confirming' | 'paid' | 'expired' | 'unreachable' =
    livePay ? 'pay' : view
  const canCancel = view === 'waiting' || view === 'unreachable'
  // The chain label, unless it only repeats the coin ("Bitcoin" on Bitcoin).
  const netName = selected?.networkName ?? selected?.network ?? null
  const netChip = netName && netName !== selected?.label ? netName : null
  const announce =
    view === 'paid'
      ? 'Payment confirmed.'
      : view === 'confirming'
        ? 'Payment received. Confirming.'
        : view === 'seen'
          ? 'Payment seen on the network.'
          : view === 'partial'
            ? `Partial payment received. ${dueDisplay} ${selected?.short ?? ''} remaining.`
            : view === 'expired'
              ? 'Invoice expired.'
              : view === 'unreachable'
                ? 'Payment service unreachable.'
                : ''

  const fade = {
    initial: reduce ? false : { opacity: 0 },
    animate: { opacity: 1 },
    exit: reduce ? { opacity: 1 } : { opacity: 0 },
    transition: { duration: reduce ? 0 : 0.18, ease: 'easeOut' },
  } as const


  // Progress under the card: created → sent → seen → confirmed.
  const steps: PayStep[] = [
    { label: 'Created' },
    view === 'partial' ? { label: 'Partial', warn: true } : { label: 'Sent' },
    { label: 'Seen' },
    { label: 'Confirmed' },
  ]
  const stepNow = view === 'paid' ? 4 : view === 'confirming' ? 3 : view === 'seen' ? 2 : 1

  // ── Card bodies ───────────────────────────────────────────────────
  const payBody = selected ? (
    // Phones: one column (coin, amount, QR, address). Desktop (owner
    // 2026-10-22: "too long and narrow"): QR on the left, the rest beside it.
    <div className="grid grid-cols-1 gap-5 px-5 pb-6 pt-5 sm:px-6 lg:grid-cols-[minmax(0,296px)_minmax(0,1fr)] lg:gap-x-8 lg:px-8 lg:py-7">
      <div className="space-y-5 lg:col-start-2">
      {/* Coin + network, and the clock */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {selected.icon && <Image src={selected.icon} alt="" width={24} height={24} unoptimized className="h-6 w-6 shrink-0" />}
          <span className="truncate text-[14px] font-semibold text-[#0E1116]">{selected.label}</span>
          {netChip && (
            <span className="shrink-0 rounded-md bg-[#F6F7F9] px-2 py-0.5 text-[12px] font-medium text-[#4B5563]">{netChip}</span>
          )}
        </span>
        {expiresAt && <ExpiryChip remainingMs={remainingMs} />}
      </div>

      {/* Exact amount to send */}
      <div>
        <p className="text-[12.5px] font-medium text-[#8A94A3]">{view === 'partial' ? 'Remaining To Send' : 'Send Exactly'}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[#0E1116]">
            <span className="select-all break-all text-[26px] font-bold leading-tight tracking-[-0.01em] tabular-nums">{dueDisplay}</span>{' '}
            <span className="text-[16px] font-semibold text-[#4B5563]">{selected.short}</span>
          </p>
          <CopyButton value={dueDisplay} label="Amount" />
        </div>
        {rateLine && <p className="mt-1 text-[12.5px] tabular-nums text-[#8A94A3]">Rate locked at {rateLine}</p>}
      </div>

      {view === 'seen' && (
        <Note tone="live" icon={<CheckCircleIcon className="h-4 w-4" weight="fill" aria-hidden />}>
          Payment seen on the network{seenTx ? ` (Tx ${shortTx(seenTx)})` : ''}. Confirming now.
        </Note>
      )}
      {view === 'partial' && (
        <Note tone="warn" icon={<WarningCircleIcon className="h-4 w-4" weight="fill" aria-hidden />}>
          Partial payment received. Send the remaining{' '}
          <span className="font-semibold tabular-nums">
            {dueDisplay} {selected.short}
          </span>{' '}
          to the same address. Exchange fees often cause this, nothing is lost.
        </Note>
      )}
      </div>

      {/* QR */}
      <div className="flex justify-center lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:items-start">
        <div className="rounded-xl border border-[#E6E8EC] p-3">
          <PaymentQr
            payload={qrPayload(selected)}
            logo={selected.icon}
            label={`QR code to pay ${dueDisplay} ${selected.short}${selected.networkName ? ` on ${selected.networkName}` : ''}`}
          />
        </div>
      </div>

      <div className="space-y-5 lg:col-start-2">
      {/* Address */}
      <div>
        <p className="text-[12.5px] font-medium text-[#8A94A3]">
          {selected.short} Address{netChip ? ` (${netChip})` : ''}
        </p>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#E6E8EC] bg-[#F6F7F9] py-1.5 pl-3 pr-1.5">
          <p className="min-w-0 flex-1 select-all break-all font-mono text-[13px] leading-relaxed text-[#0E1116]">{selected.address}</p>
          <CopyButton value={selected.address} label="Address" compact />
        </div>
      </div>

      <button type="button" onClick={() => void openInWallet()} className={cn(btn.primary, 'h-11 w-full')}>
        <WalletIcon className="h-4 w-4" aria-hidden />
        Open In Wallet
      </button>

      {selected.networkWarning && (
        <Note tone="info" icon={<InfoIcon className="h-4 w-4" aria-hidden />}>
          {selected.networkWarning}
        </Note>
      )}
      </div>
    </div>
  ) : (
    <StatePanel
      icon={<WarningCircleIcon className="h-6 w-6 text-[#4B5563]" aria-hidden />}
      title="Payment Details Unavailable"
      action={
        <button type="button" onClick={() => router.refresh()} className={cn(btn.secondary, 'h-11 px-5')}>
          <ArrowClockwiseIcon className="h-4 w-4" aria-hidden />
          Reload
        </button>
      }
    >
      We couldn’t load the payment address. Nothing was charged.
    </StatePanel>
  )

  const confirmingBody = (
    <StatePanel
      tone="live"
      icon={<CircleNotchIcon className="h-6 w-6 text-[#2563EB] motion-safe:animate-spin" aria-hidden />}
      title="Payment Received, Confirming"
    >
      {selected?.confirmEta
        ? `${selected.confirmEta.charAt(0).toUpperCase()}${selected.confirmEta.slice(1)}${selected.networkName ? ` on ${selected.networkName}` : ''}.`
        : 'Usually just a few minutes.'}{' '}
      Your funds are safe either way. You can close this page, we email you the moment it confirms.
    </StatePanel>
  )

  const paidBody = (
    <StatePanel
      tone="good"
      icon={<CheckCircleIcon className="h-8 w-8 text-[#1F7A4D]" weight="fill" aria-hidden />}
      title="Payment Confirmed"
      action={
        <>
          <button
            type="button"
            onClick={() => router.replace(`/account/orders/${orderId}?paid=1`)}
            className={cn(btn.primary, 'h-11 w-full')}
          >
            View Your Order
          </button>
          <span className="text-[13px] text-[#8A94A3]">Taking you to your order…</span>
        </>
      }
    >
      {listingTitle} is paid. Receipt emailed.
    </StatePanel>
  )

  const retryBody = (
    <StatePanel
      icon={
        view === 'unreachable' ? (
          <WarningCircleIcon className="h-6 w-6 text-[#4B5563]" aria-hidden />
        ) : (
          <ClockIcon className="h-6 w-6 text-[#4B5563]" aria-hidden />
        )
      }
      title={view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
      action={
        <>
          <button type="button" onClick={() => void freshInvoice()} disabled={retrying} className={cn(btn.primary, 'h-11 w-full')}>
            {retrying ? (
              <CircleNotchIcon className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <ArrowClockwiseIcon className="h-4 w-4" aria-hidden />
            )}
            {view === 'unreachable' ? 'Try Again' : 'Get A Fresh Invoice'}
          </button>
          <Link href="/support" className={btn.link}>
            Already Sent? Contact Support
          </Link>
        </>
      }
    >
      {view === 'unreachable'
        ? 'We couldn’t reach the payment server. Nothing was charged. Try again in a moment.'
        : 'No charge was made and nothing was lost. Rates move, so we start fresh.'}
    </StatePanel>
  )

  const body = phase === 'pay' ? payBody : phase === 'confirming' ? confirmingBody : phase === 'paid' ? paidBody : retryBody
  const showSteps = phase === 'pay' || phase === 'confirming' || phase === 'paid'

  return (
    <div className="min-h-[100dvh] bg-[#F4F5F7] text-[#0E1116]">
      {/* Light header: logo + a secure-payment mark (no menu on a payment page) */}
      <header className="border-b border-[#E6E8EC] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[960px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className={cn('inline-flex items-center gap-2 rounded-sm', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/50')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark-ink.png" alt="" width={24} height={24} className="h-6 w-6" />
            <span className="text-[15px] font-bold">DropMarket</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4B5563]">
            <LockKeyIcon className="h-4 w-4 text-[#2563EB]" weight="duotone" aria-hidden />
            Secure Payment
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6 sm:pt-10 lg:max-w-[880px]">
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <section
          aria-label="Payment"
          className="overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_rgba(16,24,40,0.06)]"
        >
          {/* Order total heads the card */}
          <div className="border-b border-[#E6E8EC] px-5 pb-4 pt-6 text-center sm:px-6 lg:px-8 lg:pb-5 lg:text-left">
            <div className="lg:flex lg:items-end lg:justify-between lg:gap-6">
            <div>
            <p className="text-[12.5px] text-[#8A94A3]">
              DropMarket{orderNumber ? ` · Order ${orderNumber}` : ''}
            </p>
            <p className="mt-1 text-[30px] font-bold leading-tight tracking-[-0.02em] tabular-nums">
              {money(invoiceAmount)} <span className="text-[16px] font-semibold text-[#4B5563]">{currency.toUpperCase()}</span>
            </p>
            {phase === 'pay' && selected && (
              <p className="mt-0.5 text-[13px] tabular-nums text-[#4B5563]">
                ≈ {dueDisplay} {selected.short}
              </p>
            )}
            </div>
            <button
              type="button"
              onClick={() => setOrderOpen((v) => !v)}
              aria-expanded={orderOpen}
              className={cn(btn.secondary, 'mt-3 h-8 shrink-0 px-3 text-[12.5px] lg:mt-0')}
            >
              <InfoIcon className="h-3.5 w-3.5" aria-hidden />
              Order Info
              <CaretDownIcon className={cn('h-3.5 w-3.5 transition-transform', orderOpen && 'rotate-180')} aria-hidden />
            </button>
            </div>
            <AnimatePresence initial={false}>
              {orderOpen && (
                <motion.div
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
                  className="overflow-hidden text-left"
                >
                  <div className="mt-4 rounded-xl bg-[#F6F7F9] p-4">
                    <div className="flex items-start gap-3">
                      {itemImage ? (
                        <Image src={itemImage} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-md bg-white object-cover" />
                      ) : (
                        <span aria-hidden className="h-11 w-11 shrink-0 rounded-md bg-white" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[#0E1116]">{listingTitle}</p>
                        {gameName && <p className="mt-0.5 truncate text-[12.5px] text-[#4B5563]">{gameName}</p>}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-[#E6E8EC] pt-2">
                      {summary.itemPrice != null && (
                        <SummaryRow label={summary.quantity > 1 ? `Item Price × ${summary.quantity}` : 'Item Price'}>
                          {money(summary.itemPrice)}
                        </SummaryRow>
                      )}
                      {summary.serviceFee != null && summary.serviceFee > 0 && <SummaryRow label="Service Fee">{money(summary.serviceFee)}</SummaryRow>}
                      {summary.promoDiscount > 0 && <SummaryRow label="Discount">−{money(summary.promoDiscount)}</SummaryRow>}
                      {summary.storeCredit > 0 && <SummaryRow label="Store Credit">−{money(summary.storeCredit)}</SummaryRow>}
                      <SummaryRow label="Total" strong>
                        {money(invoiceAmount)}
                      </SummaryRow>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={phase} {...fade}>
              {body}
            </motion.div>
          </AnimatePresence>

          {showSteps && (
            <div className="border-t border-[#E6E8EC] px-5 py-4 sm:px-6">
              <PayStepper steps={steps} current={stepNow} />
            </div>
          )}

          {(livePay || canCancel) && (
            <div className="flex flex-col gap-3 border-t border-[#E6E8EC] bg-[#FBFBFC] px-5 py-4 sm:px-6">
              {livePay && (
                <p className="text-[12.5px] leading-relaxed text-[#8A94A3]">
                  Safe to close this page. We keep watching and email you the moment it confirms.
                </p>
              )}
              {canCancel &&
                (!confirmingCancel ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className={cn('-mx-1 self-start rounded-md px-1 py-1 text-[13px] font-semibold text-[#4B5563] transition-colors hover:text-[#B42318]', btn.link)}
                  >
                    Cancel Order
                  </button>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[13px] text-[#4B5563]">Cancel this order? Nothing has been charged.</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmingCancel(false)} disabled={cancelling} className={cn(btn.secondary, 'h-10 flex-1')}>
                        Keep Waiting
                      </button>
                      <button type="button" onClick={() => void handleCancelOrder()} disabled={cancelling} className={cn(btn.danger, 'h-10 flex-1')}>
                        {cancelling && <CircleNotchIcon className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
                        Yes, Cancel It
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Under the card: protection, help and the legal links */}
        <div className="mt-5 flex flex-col items-center gap-3 text-center">
          <p className="flex items-center gap-1.5 text-[12.5px] text-[#4B5563]">
            <ShieldCheckIcon className="h-4 w-4 text-[#2563EB]" weight="duotone" aria-hidden />
            Covered by <span className="font-semibold text-[#0E1116]">SafeDrop Protection</span>
          </p>
          <nav aria-label="Help And Policies" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            <HelpDrawer
              trigger={
                <button type="button" className={btn.link}>
                  Payment Help
                </button>
              }
            />
            <Link href="/terms" className={btn.link}>
              Terms of Use
            </Link>
            <Link href="/refunds" className={btn.link}>
              Refund Policy
            </Link>
          </nav>
          <p className="text-[11.5px] text-[#8A94A3]">© {new Date().getFullYear()} DropMarket Ltd · Company No. 17309867</p>
        </div>
      </main>
    </div>
  )
}
