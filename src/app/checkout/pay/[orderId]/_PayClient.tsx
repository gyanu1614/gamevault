'use client'

/**
 * PayClient — "Ivory Receipt" (design A2) payment card.
 *
 * Library parts, per the house rule: Radix Tabs (coin switch), qr-code-styling
 * (rounded QR with the coin logo embedded), sonner (copy toasts), Framer
 * Motion (state transitions), canvas-confetti (confirmed celebration), vaul
 * (Need Help drawer), lucide icons. Display-only state machine:
 *
 *   awaiting → seen (instant chain-watch) → confirming → paid → redirect
 *   awaiting → partial (underpay banner, live remaining due)
 *   awaiting → expired / unreachable → fresh invoice via retryOrderPayment
 *
 * The verified webhook is the sole authority for marking the order paid; this
 * component only ever reads.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import * as Tabs from '@radix-ui/react-tabs'
import { Drawer } from 'vaul'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Copy,
  LifeBuoy,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { retryOrderPayment } from '@/lib/actions/checkout'

export interface PayMethod {
  id: string
  label: string
  short: string
  icon: string | null
  network: string | null
  networkWarning: string | null
  address: string
  paymentLink: string | null
  due: string
  totalPaid: string
  rate: string | null
}

type ViewState = 'awaiting' | 'seen' | 'confirming' | 'paid' | 'expired' | 'unreachable'

const POLL_MS = 4000

// ── Ivory Receipt palette (Forest Ledger system) ─────────────────────
const C = {
  ivory: '#FAFAF7',
  ivory2: '#F3F3ED',
  ink: '#1A1D19',
  ink2: '#5B6157',
  forest: '#14432A',
  forest2: '#1B5E3A',
  lime: '#A3E635',
  line: '#E4E5DE',
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Fiat symbol for the order currency (USD is the platform default). */
function fiatSymbol(currency: string): string {
  const c = currency.toUpperCase()
  return c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : `${c} `
}

/** Trim a crypto decimal string for display (drop trailing zeros, keep ≤8 dp). */
function fmtCrypto(v: string | undefined): string {
  if (!v) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toFixed(8).replace(/\.?0+$/, '')
}

// ── Small pieces ─────────────────────────────────────────────────────

function CopyChip({
  value,
  display,
  mono = true,
  grow = false,
  toastLabel,
}: {
  value: string
  display?: string
  mono?: boolean
  grow?: boolean
  toastLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${toastLabel} Copied`)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Copy Failed — Select The Text Manually')
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`inline-flex min-h-[42px] items-center justify-between gap-2.5 rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-[#1B5E3A66] ${grow ? 'w-full' : ''}`}
      style={{ borderColor: C.line, color: C.ink }}
      title={`Copy ${toastLabel}`}
    >
      <span
        className={`min-w-0 break-all text-[12.5px] font-semibold leading-snug ${mono ? 'font-mono' : ''}`}
      >
        {display ?? value}
      </span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0" style={{ color: C.forest2 }} strokeWidth={2.5} />
      ) : (
        <Copy className="h-4 w-4 shrink-0 opacity-45" />
      )}
    </button>
  )
}

/** qr-code-styling canvas — rounded modules, coin logo embedded center. */
function StyledQr({ data, logo }: { data: string; logo: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const qrRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { default: QRCodeStyling } = await import('qr-code-styling')
      if (cancelled || !ref.current) return
      const options = {
        width: 196,
        height: 196,
        type: 'svg' as const,
        data,
        margin: 6,
        image: logo ?? undefined,
        dotsOptions: { type: 'rounded' as const, color: C.ink },
        cornersSquareOptions: { type: 'extra-rounded' as const, color: C.forest },
        backgroundOptions: { color: '#FFFFFF' },
        imageOptions: { margin: 5, imageSize: 0.32, hideBackgroundDots: true },
        qrOptions: { errorCorrectionLevel: 'M' as const },
      }
      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(options)
        ref.current.innerHTML = ''
        qrRef.current.append(ref.current)
      } else {
        qrRef.current.update(options)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, logo])

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1"
      style={{ ['--tw-ring-color' as any]: C.line }}
      aria-label="Payment QR Code"
    />
  )
}

const STEPS = ['Amount', 'Pay', 'Confirming', 'Done'] as const

function Stepper({ view }: { view: ViewState }) {
  // Step index: Amount is always done (checkout finished). Pay is current
  // until the network sees money; Confirming while verifying; Done when paid.
  const current = view === 'paid' ? 3 : view === 'seen' || view === 'confirming' ? 2 : 1
  return (
    <div className="flex items-center px-5 pt-3.5 sm:px-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center" style={{ flex: i === STEPS.length - 1 ? '0 0 auto' : '1 1 0%' }}>
          <div className="flex items-center gap-1.5">
            <span
              className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full text-[9.5px] font-extrabold transition-colors"
              style={
                i < current
                  ? { background: C.forest, color: '#fff' }
                  : i === current
                    ? { background: C.lime, color: C.forest }
                    : { background: '#fff', color: C.ink2, boxShadow: `inset 0 0 0 1.5px ${C.line}` }
              }
            >
              {i < current ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className="text-[10.5px] font-bold"
              style={{ color: i <= current ? C.forest : C.ink2 }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-2 h-[2px] flex-1 rounded-full transition-colors"
              style={{ background: i < current ? C.forest : C.line }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────

export default function PayClient({
  orderId,
  orderNumber,
  listingTitle,
  gameName,
  totalAmount,
  currency,
  invoiceAmount,
  initialInvoiceStatus,
  expiresAt,
  methods,
}: {
  orderId: string
  orderNumber: string | null
  listingTitle: string
  gameName: string | null
  totalAmount: number
  currency: string
  invoiceAmount: number
  initialInvoiceStatus: string
  expiresAt: string | null
  methods: PayMethod[]
}) {
  const router = useRouter()

  const initialView: ViewState =
    initialInvoiceStatus === 'Processing'
      ? 'confirming'
      : initialInvoiceStatus === 'New'
        ? 'awaiting'
        : initialInvoiceStatus === 'Unreachable'
          ? 'unreachable'
          : 'expired'

  const [view, setView] = useState<ViewState>(initialView)
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? '')
  const [liveDue, setLiveDue] = useState<Record<string, { due?: string; totalPaid?: string }>>({})
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  )
  const [retrying, setRetrying] = useState(false)
  const initialRemaining = useRef(Math.max(1, remainingMs))
  const confettiFired = useRef(false)

  const selected = useMemo(
    () => methods.find((m) => m.id === selectedId) ?? methods[0],
    [methods, selectedId]
  )
  const live = selected ? liveDue[selected.id] : undefined
  const dueDisplay = fmtCrypto(live?.due ?? selected?.due)
  const partiallyPaid =
    Number(live?.totalPaid ?? selected?.totalPaid ?? 0) > 0 &&
    (view === 'awaiting' || view === 'seen')
  const sym = fiatSymbol(currency)
  const walletCredit = Math.max(0, totalAmount - invoiceAmount)

  // ── Countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt || (view !== 'awaiting' && view !== 'seen')) return
    const t = setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now()
      setRemainingMs(left)
      // Local expiry is a display hint; the poll confirms the real state.
      if (left <= 0) setView((v) => (v === 'awaiting' || v === 'seen' ? 'expired' : v))
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt, view])

  // ── Status poll (webhook-driven truth + chain-watch sugar) ────────
  useEffect(() => {
    if (view === 'paid') return
    const t = setInterval(async () => {
      const res = await getPaymentPageStatus(orderId)
      if (!res.success) return
      if (res.orderStatus && res.orderStatus !== 'pending') {
        setView('paid')
        setTimeout(() => router.replace(`/account/orders/${orderId}?paid=1`), 2400)
        return
      }
      if (res.methods?.length) {
        setLiveDue((prev) => {
          const next = { ...prev }
          for (const m of res.methods!) next[m.paymentMethodId] = { due: m.due, totalPaid: m.totalPaid }
          return next
        })
      }
      switch (res.invoiceStatus) {
        case 'Processing':
          setView('confirming')
          break
        case 'Expired':
        case 'Invalid':
          setView((v) => (v === 'confirming' ? v : 'expired'))
          break
        case 'New':
          setView((v) => {
            if (v === 'confirming') return v
            if (res.seenOnNetwork) return 'seen'
            return v === 'unreachable' ? 'awaiting' : v
          })
          break
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [orderId, router, view])

  // ── Confirmed celebration ─────────────────────────────────────────
  useEffect(() => {
    if (view !== 'paid' || confettiFired.current) return
    confettiFired.current = true
    ;(async () => {
      const { default: confetti } = await import('canvas-confetti')
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.55 },
        colors: [C.lime, C.forest2, '#ffffff', C.forest],
      })
    })()
  }, [view])

  const freshInvoice = useCallback(async () => {
    setRetrying(true)
    const res = await retryOrderPayment(orderId)
    if (res.success && res.fullyPaidByWallet) {
      router.replace(`/account/orders/${orderId}?paid=1`)
      return
    }
    // New invoice minted (or the old one is still valid) — re-render the
    // server page so address/QR/expiry reflect it.
    router.refresh()
    setRetrying(false)
    setView('awaiting')
  }, [orderId, router])

  const timerPct = Math.max(0, Math.min(100, (remainingMs / initialRemaining.current) * 100))

  return (
    <div className="flex min-h-[80vh] w-full items-start justify-center px-3 py-8 sm:items-center sm:px-6 sm:py-12">
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-2xl shadow-[0_24px_60px_-18px_rgba(0,0,0,0.75)] ring-1 ring-white/10"
        style={{ background: C.ivory, color: C.ink }}
      >
        {/* ── Forest header: merchant identity ── */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"
          style={{ background: C.forest }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-[15px] font-extrabold"
              style={{ background: C.lime, color: C.forest }}
            >
              M
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
                Paying
              </span>
              <span className="flex items-center gap-1.5 text-[14px] font-bold leading-tight text-white">
                DropMarket
                <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: C.lime }} />
              </span>
            </span>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-[10px] font-bold tracking-[0.05em]"
            style={{ color: C.lime }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            SAFEDROP
          </span>
        </div>

        <Stepper view={view} />

        <AnimatePresence mode="wait" initial={false}>
          {/* ═══════════ PAID ═══════════ */}
          {view === 'paid' ? (
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 px-6 py-14 text-center"
            >
              <motion.span
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="grid h-16 w-16 place-items-center rounded-full"
                style={{ background: C.forest }}
              >
                <Check className="h-8 w-8" style={{ color: C.lime }} strokeWidth={3} />
              </motion.span>
              <div>
                <p className="text-[18px] font-extrabold" style={{ color: C.forest }}>
                  Payment Confirmed
                </p>
                <p className="mt-1 text-[13px]" style={{ color: C.ink2 }}>
                  Order Placed — taking you to your order…
                </p>
              </div>
            </motion.div>
          ) : view === 'expired' || view === 'unreachable' ? (
            /* ═══════════ EXPIRED / UNREACHABLE ═══════════ */
            <motion.div
              key="expired"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 px-6 py-12 text-center"
            >
              <span
                className="grid h-13 w-13 h-[52px] w-[52px] place-items-center rounded-full"
                style={{ background: '#FEF3C7' }}
              >
                <CircleAlert className="h-6 w-6" style={{ color: '#B45309' }} />
              </span>
              <div>
                <p className="text-[15.5px] font-extrabold">
                  {view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
                </p>
                <p className="mx-auto mt-1.5 max-w-[330px] text-[12.5px] leading-relaxed" style={{ color: C.ink2 }}>
                  {view === 'unreachable'
                    ? 'We couldn’t reach the payment server. Nothing was charged — try again in a moment.'
                    : 'No charge was made. Get a fresh invoice at the current rate — any coins already sent will be credited to you.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void freshInvoice()}
                disabled={retrying}
                className="inline-flex h-[46px] items-center gap-2 rounded-lg px-5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-70"
                style={{ background: C.forest }}
              >
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {view === 'unreachable' ? 'Try Again' : 'Get A Fresh Invoice'}
              </button>
            </motion.div>
          ) : (
            /* ═══════════ ACTIVE PAYMENT ═══════════ */
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-5 pb-4 pt-3 sm:px-6"
            >
              {/* Order line */}
              <div className="flex items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">{listingTitle}</p>
                  <p className="mt-0.5 font-mono text-[10.5px]" style={{ color: C.ink2 }}>
                    {orderNumber ? `#${orderNumber}` : ''}
                    {orderNumber && gameName ? ' · ' : ''}
                    {gameName ?? ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[19px] font-extrabold leading-none tracking-tight" style={{ color: C.forest }}>
                    {sym}
                    {invoiceAmount.toFixed(2)}{' '}
                    <span className="text-[10px] font-semibold" style={{ color: C.ink2 }}>
                      {currency}
                    </span>
                  </p>
                  {walletCredit > 0.004 && (
                    <p className="mt-0.5 text-[10.5px]" style={{ color: C.ink2 }}>
                      −{sym}
                      {walletCredit.toFixed(2)} Wallet Credit Applied
                    </p>
                  )}
                </div>
              </div>

              {/* Coin + network (Radix Tabs when several) */}
              <Tabs.Root value={selected?.id ?? ''} onValueChange={setSelectedId}>
                {methods.length > 1 && (
                  <Tabs.List
                    className="mb-2.5 flex gap-1.5 rounded-lg p-1"
                    style={{ background: C.ivory2 }}
                    aria-label="Choose Coin"
                  >
                    {methods.map((m) => (
                      <Tabs.Trigger
                        key={m.id}
                        value={m.id}
                        className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-bold transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                        style={{ color: C.ink }}
                      >
                        {m.icon && <Image src={m.icon} alt="" width={16} height={16} unoptimized />}
                        {m.short}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                )}

                {selected && (
                  <div
                    className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
                    style={{ background: C.ivory2, borderColor: C.line }}
                  >
                    {selected.icon && (
                      <Image src={selected.icon} alt={selected.label} width={30} height={30} unoptimized className="shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                        {selected.label}
                        {selected.network && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-[2px] text-[9.5px] font-extrabold"
                            style={{ borderColor: C.line, color: '#B91C1C' }}
                          >
                            {selected.network.includes('TRON') && (
                              <Image src="/crypto/trx.svg" alt="" width={11} height={11} unoptimized />
                            )}
                            {selected.network}
                          </span>
                        )}
                      </p>
                      {selected.networkWarning && (
                        <p className="mt-0.5 text-[10.5px] leading-snug" style={{ color: C.ink2 }}>
                          {selected.networkWarning}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </Tabs.Root>

              {selected && (
                <>
                  {/* Send Exactly */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className="text-[10.5px] font-bold uppercase tracking-[0.07em]"
                      style={{ color: C.ink2 }}
                    >
                      Send Exactly
                    </span>
                    <CopyChip
                      value={dueDisplay}
                      display={`${dueDisplay} ${selected.short}`}
                      toastLabel="Amount"
                    />
                  </div>

                  {/* Partial banner */}
                  <AnimatePresence>
                    {partiallyPaid && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold leading-snug"
                          style={{ background: '#FEF3C7', color: '#92400E' }}
                        >
                          <TriangleAlert className="mt-[1px] h-4 w-4 shrink-0" />
                          <span>
                            Partial Payment Received — send the remaining {dueDisplay}{' '}
                            {selected.short} to the same address.
                            <span className="mt-0.5 block font-medium opacity-80">
                              Exchange withdrawal fees often cause this.
                            </span>
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* QR */}
                  <div className="mt-3.5 flex justify-center">
                    <StyledQr data={selected.paymentLink || selected.address} logo={selected.icon} />
                  </div>

                  {/* Expiry bar */}
                  <div className="mt-3.5">
                    <div className="h-[5px] overflow-hidden rounded-full" style={{ background: C.line }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${C.forest2}, ${C.lime})` }}
                        animate={{ width: `${timerPct}%` }}
                        transition={{ ease: 'linear', duration: 1 }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                      <span style={{ color: C.ink2 }}>Rate Locked For This Invoice</span>
                      <span className="font-bold tabular-nums" style={{ color: C.forest }}>
                        Expires In {fmtCountdown(remainingMs)}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="mt-3">
                    <p
                      className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em]"
                      style={{ color: C.ink2 }}
                    >
                      {selected.label} Address{selected.network ? ` · ${selected.network}` : ''}
                    </p>
                    <CopyChip value={selected.address} grow toastLabel="Address" />
                    {selected.paymentLink && (
                      <a
                        href={selected.paymentLink}
                        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold transition-opacity hover:opacity-75"
                        style={{ color: C.forest2 }}
                      >
                        Open In Wallet App ↗
                      </a>
                    )}
                  </div>

                  {/* Status strip */}
                  <div className="mt-3.5">
                    <AnimatePresence mode="wait" initial={false}>
                      {view === 'confirming' ? (
                        <motion.div
                          key="confirming"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
                          style={{ background: '#ECFCCB', color: '#3F6212' }}
                        >
                          <Loader2 className="mt-[1px] h-4 w-4 shrink-0 animate-spin" />
                          <p className="text-[12.5px] font-bold leading-snug">
                            Payment Detected — Confirming
                            <span className="mt-0.5 block text-[11.5px] font-medium opacity-80">
                              Waiting for network confirmation. Safe to close — we’ll email you.
                            </span>
                          </p>
                        </motion.div>
                      ) : view === 'seen' ? (
                        <motion.div
                          key="seen"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
                          style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                        >
                          <Zap className="mt-[1px] h-4 w-4 shrink-0" />
                          <p className="text-[12.5px] font-bold leading-snug">
                            Payment Seen On Network
                            <span className="mt-0.5 block text-[11.5px] font-medium opacity-80">
                              Your transfer is on the {selected.network ?? 'network'} — verifying
                              with the payment server…
                            </span>
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="waiting"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3"
                          style={{ background: C.ivory2, borderColor: C.line }}
                        >
                          <span className="relative mt-[3px] flex h-2.5 w-2.5 shrink-0">
                            <span
                              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                              style={{ background: '#65A30D' }}
                            />
                            <span
                              className="relative inline-flex h-2.5 w-2.5 rounded-full"
                              style={{ background: '#65A30D' }}
                            />
                          </span>
                          <p className="text-[12.5px] font-bold leading-snug">
                            Waiting For Payment
                            <span
                              className="mt-0.5 block text-[11.5px] font-medium"
                              style={{ color: C.ink2 }}
                            >
                              We watch the network live — you’ll see it here seconds after you send.
                            </span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Receipt footer ── */}
        <div className="border-t-2 border-dashed px-5 sm:px-6" style={{ borderColor: C.line }} />
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <p className="text-[10.5px] leading-snug" style={{ color: C.ink2 }}>
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
            Safe To Close This Page —{' '}
            <b style={{ color: C.forest }}>we’ll email you when it’s confirmed.</b>
          </p>
          <Drawer.Root>
            <Drawer.Trigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold transition-opacity hover:opacity-75"
                style={{ color: C.forest2 }}
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                Need Help?
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
              <Drawer.Content
                className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] rounded-t-2xl p-6 pb-9"
                style={{ background: C.ivory, color: C.ink }}
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full" style={{ background: C.line }} />
                <Drawer.Title className="text-[15px] font-extrabold">Payment Help</Drawer.Title>
                <div className="mt-3 space-y-3 text-[12.5px] leading-relaxed" style={{ color: C.ink2 }}>
                  <p>
                    <b style={{ color: C.ink }}>How long does it take?</b> Crypto payments are
                    usually detected within seconds of sending and confirmed within a few minutes.
                  </p>
                  <p>
                    <b style={{ color: C.ink }}>Sent slightly too little?</b> Exchange withdrawal
                    fees can shave the amount — this page will show the small remainder to send.
                  </p>
                  <p>
                    <b style={{ color: C.ink }}>Invoice expired after you paid?</b> Don’t worry —
                    payments are never lost. Contact us and we’ll sort it right away.
                  </p>
                  <a
                    href="mailto:support@dropmarket.gg"
                    className="inline-flex h-[42px] items-center rounded-lg px-4 text-[13px] font-bold text-white"
                    style={{ background: C.forest }}
                  >
                    Contact Support
                  </a>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      </div>
    </div>
  )
}
